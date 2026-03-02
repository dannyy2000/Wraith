// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Types.sol";
import "./MarketFactory.sol";

/// @title PrivacyPool
/// @notice Accepts private bets as on-chain commitment hashes.
///
///         Privacy model:
///           - Bet placement (wallet, outcome, amount) is visible on-chain
///           - The commitment ties the bet to a secret+nullifier only the bettor knows
///           - At claim time, the bettor reveals their secret from ANY wallet
///           - This delinks the betting identity from the claiming identity
///
///         Commitment scheme:
///           commitment = keccak256(abi.encodePacked(marketId, outcome, amount, secret, nullifier))
///           Generate secret and nullifier off-chain. Store them privately.
///           Anyone who knows (marketId, outcome, amount, secret, nullifier) can claim.
///
///         ClaimRegistry is the only contract authorised to trigger payouts.
contract PrivacyPool {
    // ================================================================
    // │                          Storage                             │
    // ================================================================

    MarketFactory public immutable factory;

    /// @notice Set once after deployment. Only ClaimRegistry may call payout().
    address public claimRegistry;

    /// @dev commitment => amount staked (wei)
    mapping(bytes32 => uint256) private _commitmentAmounts;

    /// @dev commitment => exists flag
    mapping(bytes32 => bool) public commitmentExists;

    /// @dev marketId => outcome => total ETH in that side's pool
    mapping(uint256 => mapping(Outcome => uint256)) public pools;

    /// @dev marketId => number of bets placed
    mapping(uint256 => uint256) public betCount;

    // ================================================================
    // │                           Events                             │
    // ================================================================

    event BetCommitted(
        uint256 indexed marketId,
        Outcome indexed outcome,
        bytes32 indexed commitment,
        uint256 amount
    );
    event ClaimRegistrySet(address claimRegistry);

    // ================================================================
    // │                           Errors                             │
    // ================================================================

    error MarketNotOpen();
    error MarketDeadlinePassed();
    error CommitmentExists();
    error ZeroAmount();
    error InvalidCommitment();
    error NotClaimRegistry();
    error ClaimRegistryAlreadySet();
    error TransferFailed();

    // ================================================================
    // │                        Constructor                           │
    // ================================================================

    constructor(address _factory) {
        factory = MarketFactory(_factory);
    }

    /// @notice Set the ClaimRegistry address. Can only be called once.
    function setClaimRegistry(address _claimRegistry) external {
        if (claimRegistry != address(0)) revert ClaimRegistryAlreadySet();
        claimRegistry = _claimRegistry;
        emit ClaimRegistrySet(_claimRegistry);
    }

    // ================================================================
    // │                        Place Bet                             │
    // ================================================================

    /// @notice Place a private bet by submitting a commitment hash.
    ///
    /// @param marketId   The market to bet on.
    /// @param outcome    YES or NO. Visible on-chain; required for pool tracking.
    /// @param commitment keccak256(abi.encodePacked(marketId, outcome, msg.value, secret, nullifier))
    ///                   Compute off-chain. Keep secret and nullifier private.
    function placeBet(
        uint256 marketId,
        Outcome outcome,
        bytes32 commitment
    ) external payable {
        if (msg.value == 0) revert ZeroAmount();
        if (commitment == bytes32(0)) revert InvalidCommitment();
        if (outcome == Outcome.UNRESOLVED) revert InvalidCommitment();
        if (commitmentExists[commitment]) revert CommitmentExists();

        Market memory m = factory.getMarket(marketId);
        if (m.creator == address(0)) revert MarketNotOpen();
        if (m.status != MarketStatus.OPEN) revert MarketNotOpen();
        if (block.timestamp >= m.config.deadline) revert MarketDeadlinePassed();

        _commitmentAmounts[commitment] = msg.value;
        commitmentExists[commitment] = true;
        pools[marketId][outcome] += msg.value;
        betCount[marketId]++;

        emit BetCommitted(marketId, outcome, commitment, msg.value);
    }

    // ================================================================
    // │                         Payout                               │
    // ================================================================

    /// @notice Transfer ETH to a winning claimant.
    ///         Only callable by ClaimRegistry after it has verified the claim.
    function payout(address recipient, uint256 amount) external {
        if (msg.sender != claimRegistry) revert NotClaimRegistry();
        (bool ok,) = recipient.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ================================================================
    // │                          Getters                             │
    // ================================================================

    /// @notice Amount staked for a given commitment.
    function getCommitmentAmount(bytes32 commitment) external view returns (uint256) {
        return _commitmentAmounts[commitment];
    }

    /// @notice Total ETH in one side of a market's pool.
    function getPool(uint256 marketId, Outcome outcome) external view returns (uint256) {
        return pools[marketId][outcome];
    }

    /// @notice Combined YES + NO pool for a market.
    function getTotalPool(uint256 marketId) external view returns (uint256) {
        return pools[marketId][Outcome.YES] + pools[marketId][Outcome.NO];
    }
}
