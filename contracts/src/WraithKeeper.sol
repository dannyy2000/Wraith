// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Types.sol";
import "./MarketFactory.sol";

/// @title WraithKeeper
/// @notice Chainlink Automation-compatible keeper that triggers settlement for
///         expired Wraith markets.
///
///         Flow:
///           1. Chainlink Automation nodes call checkUpkeep() every block
///           2. If any OPEN, non-OPTIMISTIC market is past deadline → upkeepNeeded = true
///           3. Automation calls performUpkeep(performData) with the market ID
///           4. Keeper calls factory.requestSettlement(marketId) → emits SettlementRequested
///           5. CRE log trigger fires, reads the market, and posts the settlement report
///
///         Batch mode: checkUpkeep returns the first eligible market found.
///         One market is settled per upkeep call — Automation handles the cadence.
contract WraithKeeper {
    // ================================================================
    // │                         Storage                              │
    // ================================================================

    MarketFactory public immutable factory;

    // ================================================================
    // │                          Events                              │
    // ================================================================

    event SettlementTriggered(uint256 indexed marketId);

    // ================================================================
    // │                          Errors                              │
    // ================================================================

    error NoEligibleMarket();

    // ================================================================
    // │                        Constructor                           │
    // ================================================================

    constructor(address _factory) {
        factory = MarketFactory(_factory);
    }

    // ================================================================
    // │              Chainlink Automation Interface                  │
    // ================================================================

    /// @notice Called off-chain by Chainlink Automation nodes every block.
    ///         Scans all markets for the first one eligible for settlement.
    ///
    /// @return upkeepNeeded True if at least one market is ready.
    /// @return performData  ABI-encoded marketId to pass to performUpkeep.
    function checkUpkeep(bytes calldata /* checkData */)
        external
        view
        returns (bool upkeepNeeded, bytes memory performData)
    {
        uint256[] memory ids = factory.getAllMarketIds();
        uint256 count = ids.length;

        for (uint256 i = 0; i < count; i++) {
            uint256 id = ids[i];
            Market memory m = factory.getMarket(id);

            if (_isEligible(m)) {
                return (true, abi.encode(id));
            }
        }

        return (false, bytes(""));
    }

    /// @notice Called on-chain by Chainlink Automation when checkUpkeep returns true.
    ///         Re-validates eligibility to guard against race conditions, then calls
    ///         requestSettlement on the factory.
    ///
    /// @param performData ABI-encoded uint256 marketId.
    function performUpkeep(bytes calldata performData) external {
        uint256 marketId = abi.decode(performData, (uint256));

        Market memory m = factory.getMarket(marketId);
        if (!_isEligible(m)) revert NoEligibleMarket();

        factory.requestSettlement(marketId);
        emit SettlementTriggered(marketId);
    }

    // ================================================================
    // │                       Internal Helper                        │
    // ================================================================

    /// @dev A market is eligible for keeper settlement when:
    ///       - It is OPEN (not already resolved or in dispute)
    ///       - Its deadline has passed
    ///       - It is NOT OPTIMISTIC (those use proposeOutcome() by the creator)
    function _isEligible(Market memory m) internal view returns (bool) {
        return (
            m.status == MarketStatus.OPEN &&
            block.timestamp >= m.config.deadline &&
            m.config.resolutionType != ResolutionType.OPTIMISTIC
        );
    }
}
