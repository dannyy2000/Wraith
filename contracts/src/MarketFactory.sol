// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Types.sol";

/// @title MarketFactory
/// @notice Creates and manages Wraith prediction markets.
///
///         Resolution logic is locked at creation — no one can change it after deployment.
///         Automated settlement is performed by Chainlink CRE via onReport().
///
///         Four resolution paths:
///           PRICE_FEED  — CRE reads Chainlink feed, compares condition
///           API_POLL    — CRE makes Confidential HTTP call, reads a field
///           AI_VERDICT  — CRE fetches news sources, asks Claude, posts YES/NO + reasoning
///           OPTIMISTIC  — Creator proposes, 48hr dispute window, disputed → AI_VERDICT
contract MarketFactory {
    // ================================================================
    // │                         Constants                            │
    // ================================================================

    uint256 public constant DISPUTE_WINDOW = 48 hours;
    uint256 public constant MIN_OPTIMISTIC_BOND = 0.01 ether;

    // ================================================================
    // │                          Storage                             │
    // ================================================================

    /// @notice Chainlink CRE Forwarder — the only address allowed to call onReport.
    address public immutable forwarder;

    uint256 private _nextMarketId;
    mapping(uint256 => Market) private _markets;
    uint256[] private _allMarketIds;

    // ================================================================
    // │                           Events                             │
    // ================================================================

    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        ResolutionType indexed resolutionType,
        string question,
        uint256 deadline
    );
    event OutcomeProposed(uint256 indexed marketId, address indexed proposer, Outcome outcome);
    event MarketChallenged(uint256 indexed marketId, address indexed challenger, uint256 bond);
    /// @dev CRE listens for this event via Log Trigger to execute automated settlement.
    event SettlementRequested(uint256 indexed marketId);
    /// @dev CRE listens for this event via Log Trigger to run AI_VERDICT on the dispute.
    event DisputeEscalated(uint256 indexed marketId);
    event MarketSettled(uint256 indexed marketId, Outcome outcome, string reasoning);
    event BondSlashed(uint256 indexed marketId, address indexed loser, uint256 amount);

    // ================================================================
    // │                           Errors                             │
    // ================================================================

    error MarketNotFound();
    error MarketAlreadySettled();
    error NotCreator();
    error DeadlineNotReached();
    error DeadlinePassed();
    error InsufficientBond();
    error NotOptimisticMarket();
    error DisputeWindowOpen();
    error DisputeWindowClosed();
    error NotForwarder();
    error MarketNotDisputed();
    error MarketNotPendingResolution();
    error InvalidOutcome();

    // ================================================================
    // │                        Constructor                           │
    // ================================================================

    constructor(address _forwarder) {
        forwarder = _forwarder;
    }

    // ================================================================
    // │                      Create Market                           │
    // ================================================================

    /// @notice Create a new prediction market with locked resolution config.
    ///         OPTIMISTIC markets require msg.value >= MIN_OPTIMISTIC_BOND.
    function createMarket(
        string calldata question,
        ResolutionConfig calldata config
    ) external payable returns (uint256 marketId) {
        if (config.deadline <= block.timestamp) revert DeadlinePassed();
        if (config.resolutionType == ResolutionType.OPTIMISTIC) {
            if (msg.value < MIN_OPTIMISTIC_BOND) revert InsufficientBond();
        }

        marketId = _nextMarketId++;

        _markets[marketId] = Market({
            id: marketId,
            creator: msg.sender,
            question: question,
            config: config,
            status: MarketStatus.OPEN,
            outcome: Outcome.UNRESOLVED,
            reasoning: "",
            createdAt: block.timestamp,
            settledAt: 0,
            creatorBond: msg.value,
            challenger: address(0),
            challengerBond: 0,
            disputeDeadline: 0,
            proposedOutcome: Outcome.UNRESOLVED
        });

        _allMarketIds.push(marketId);

        emit MarketCreated(marketId, msg.sender, config.resolutionType, question, config.deadline);
    }

    // ================================================================
    // │            OPTIMISTIC: Propose / Challenge / Finalize        │
    // ================================================================

    /// @notice OPTIMISTIC only. Creator submits YES or NO after deadline.
    ///         Opens a 48hr dispute window. Creator's bond is now at risk.
    function proposeOutcome(uint256 marketId, Outcome outcome) external {
        if (outcome == Outcome.UNRESOLVED) revert InvalidOutcome();
        Market storage m = _requireMarket(marketId);
        if (m.status != MarketStatus.OPEN) revert MarketAlreadySettled();
        if (m.config.resolutionType != ResolutionType.OPTIMISTIC) revert NotOptimisticMarket();
        if (m.creator != msg.sender) revert NotCreator();
        if (block.timestamp < m.config.deadline) revert DeadlineNotReached();

        m.proposedOutcome = outcome;
        m.status = MarketStatus.PENDING_RESOLUTION;
        m.disputeDeadline = block.timestamp + DISPUTE_WINDOW;

        emit OutcomeProposed(marketId, msg.sender, outcome);
    }

    /// @notice Challenge a proposed outcome by staking a counter-bond >= creator's bond.
    ///         Moves the market to DISPUTED and emits DisputeEscalated for CRE.
    function challenge(uint256 marketId) external payable {
        Market storage m = _requireMarket(marketId);
        if (m.status != MarketStatus.PENDING_RESOLUTION) revert MarketNotPendingResolution();
        if (block.timestamp > m.disputeDeadline) revert DisputeWindowClosed();
        if (msg.value < m.creatorBond) revert InsufficientBond();

        // Once challenged the market becomes DISPUTED — further challenges revert at the status check above
        m.challenger = msg.sender;
        m.challengerBond = msg.value;
        m.status = MarketStatus.DISPUTED;

        emit MarketChallenged(marketId, msg.sender, msg.value);
        emit DisputeEscalated(marketId);
    }

    /// @notice Finalize an OPTIMISTIC market after the dispute window closes with no challenge.
    ///         Returns the creator's bond. Anyone can call this.
    function finalizeOptimistic(uint256 marketId) external {
        Market storage m = _requireMarket(marketId);
        if (m.status != MarketStatus.PENDING_RESOLUTION) revert MarketNotPendingResolution();
        if (m.config.resolutionType != ResolutionType.OPTIMISTIC) revert NotOptimisticMarket();
        if (block.timestamp <= m.disputeDeadline) revert DisputeWindowOpen();

        _settle(m, m.proposedOutcome, "Optimistic: unchallenged within dispute window");

        uint256 bond = m.creatorBond;
        m.creatorBond = 0;

        (bool ok,) = m.creator.call{value: bond}("");
        require(ok);
    }

    // ================================================================
    // │                   Request Settlement                         │
    // ================================================================

    /// @notice Anyone can call this after a market's deadline to trigger CRE settlement.
    ///         Emits SettlementRequested which a CRE Log Trigger listens for.
    ///         Not applicable to OPTIMISTIC markets — those use proposeOutcome().
    function requestSettlement(uint256 marketId) external {
        Market storage m = _requireMarket(marketId);
        if (m.status != MarketStatus.OPEN) revert MarketAlreadySettled();
        if (block.timestamp < m.config.deadline) revert DeadlineNotReached();
        if (m.config.resolutionType == ResolutionType.OPTIMISTIC) revert NotOptimisticMarket();
        emit SettlementRequested(marketId);
    }

    // ================================================================
    // │                     CRE Entry Point                          │
    // ================================================================

    /// @notice Called by the Chainlink CRE Forwarder to post settlement results.
    ///
    /// Report byte prefix routing:
    ///   0x01 → settle market (PRICE_FEED / API_POLL / AI_VERDICT)
    ///   0x02 → settle disputed OPTIMISTIC market after AI_VERDICT
    ///
    /// Note: market creation is NOT done via CRE. The market-suggester workflow
    /// returns a suggestion to the frontend; the creator reviews it and calls
    /// createMarket() directly, staking their own bond.
    function onReport(bytes calldata /* metadata */, bytes calldata rawReport) external {
        if (msg.sender != forwarder) revert NotForwarder();
        _processReport(rawReport);
    }

    function _processReport(bytes calldata report) internal {
        uint8 prefix = uint8(report[0]);
        bytes calldata payload = report[1:];

        if (prefix == 0x01) {
            _settleMarket(payload);
        } else if (prefix == 0x02) {
            _settleDispute(payload);
        }
    }

    /// @dev Settles a PRICE_FEED, API_POLL, or AI_VERDICT market.
    ///      report payload: abi.encode(uint256 marketId, uint8 outcome, string reasoning)
    function _settleMarket(bytes calldata payload) internal {
        (uint256 marketId, uint8 outcomeVal, string memory reasoning) =
            abi.decode(payload, (uint256, uint8, string));

        Market storage m = _requireMarket(marketId);
        if (m.status == MarketStatus.SETTLED) revert MarketAlreadySettled();

        _settle(m, Outcome(outcomeVal), reasoning);
    }

    /// @dev Settles a DISPUTED OPTIMISTIC market after CRE runs AI_VERDICT.
    ///      Slashes the loser's bond and pays the winner both bonds.
    ///      report payload: abi.encode(uint256 marketId, uint8 outcome, string reasoning)
    function _settleDispute(bytes calldata payload) internal {
        (uint256 marketId, uint8 outcomeVal, string memory reasoning) =
            abi.decode(payload, (uint256, uint8, string));

        Market storage m = _requireMarket(marketId);
        if (m.status != MarketStatus.DISPUTED) revert MarketNotDisputed();

        Outcome outcome = Outcome(outcomeVal);
        _settle(m, outcome, reasoning);

        bool creatorWon = (outcome == m.proposedOutcome);
        address winner = creatorWon ? m.creator : m.challenger;
        address loser  = creatorWon ? m.challenger : m.creator;
        uint256 totalBonds = m.creatorBond + m.challengerBond;
        uint256 loserBond  = creatorWon ? m.challengerBond : m.creatorBond;

        m.creatorBond = 0;
        m.challengerBond = 0;

        emit BondSlashed(marketId, loser, loserBond);

        (bool ok,) = winner.call{value: totalBonds}("");
        require(ok);
    }

    // ================================================================
    // │                      Internal Helpers                        │
    // ================================================================

    function _settle(Market storage m, Outcome outcome, string memory reasoning) internal {
        m.status = MarketStatus.SETTLED;
        m.outcome = outcome;
        m.reasoning = reasoning;
        m.settledAt = block.timestamp;
        emit MarketSettled(m.id, outcome, reasoning);
    }

    function _requireMarket(uint256 marketId) internal view returns (Market storage m) {
        m = _markets[marketId];
        if (m.creator == address(0)) revert MarketNotFound();
    }

    // ================================================================
    // │                          Getters                             │
    // ================================================================

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return _markets[marketId];
    }

    function getMarketCount() external view returns (uint256) {
        return _nextMarketId;
    }

    function getAllMarketIds() external view returns (uint256[] memory) {
        return _allMarketIds;
    }
}
