// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Types.sol";
import "./MarketFactory.sol";
import "./PrivacyPool.sol";

/// @title ClaimRegistry
/// @notice Verifies winning claims and processes payouts.
///
///         Claim flow:
///           1. Winner reveals: marketId, outcome, betAmount, secret, nullifier
///           2. Contract recomputes commitment hash
///           3. Verifies commitment exists in PrivacyPool
///           4. Verifies bet amount matches what was originally staked
///           5. Marks nullifier as used (prevents double-claim)
///           6. Calculates proportional payout from the total pool
///           7. Calls PrivacyPool.payout() — ETH sent to msg.sender (any wallet)
///
///         Privacy: the claimant wallet has no on-chain link to the original bet wallet.
contract ClaimRegistry {
    // ================================================================
    // │                          Storage                             │
    // ================================================================

    MarketFactory public immutable factory;
    PrivacyPool   public immutable pool;

    /// @dev Tracks spent nullifiers to prevent double-claiming.
    mapping(bytes32 => bool) public nullifierUsed;

    // ================================================================
    // │                           Events                             │
    // ================================================================

    event Claimed(
        uint256 indexed marketId,
        bytes32 indexed nullifier,
        address indexed recipient,
        uint256 payout
    );

    // ================================================================
    // │                           Errors                             │
    // ================================================================

    error MarketNotFound();
    error MarketNotSettled();
    error NotWinningSide();
    error NullifierAlreadyUsed();
    error InvalidProof();
    error ZeroPayout();

    // ================================================================
    // │                        Constructor                           │
    // ================================================================

    constructor(address _factory, address _pool) {
        factory = MarketFactory(_factory);
        pool    = PrivacyPool(_pool);
    }

    // ================================================================
    // │                           Claim                              │
    // ================================================================

    /// @notice Claim winnings by revealing your bet details.
    ///         Payout is sent to msg.sender — call from any wallet.
    ///
    /// @param marketId   The market you bet on.
    /// @param outcome    The outcome you bet on (must match the settled outcome).
    /// @param betAmount  The exact amount you staked in placeBet().
    /// @param secret     Your private secret (generated off-chain at bet time).
    /// @param nullifier  Your private nullifier (generated off-chain at bet time).
    function claim(
        uint256 marketId,
        Outcome outcome,
        uint256 betAmount,
        bytes32 secret,
        bytes32 nullifier
    ) external {
        // 1. Nullifier check — prevents double-claim
        if (nullifierUsed[nullifier]) revert NullifierAlreadyUsed();

        // 2. Market must be settled and outcome must match
        Market memory m = factory.getMarket(marketId);
        if (m.creator == address(0)) revert MarketNotFound();
        if (m.status != MarketStatus.SETTLED) revert MarketNotSettled();
        if (m.outcome != outcome) revert NotWinningSide();

        // 3. Recompute and verify commitment
        bytes32 commitment = keccak256(
            abi.encodePacked(marketId, outcome, betAmount, secret, nullifier)
        );
        if (!pool.commitmentExists(commitment)) revert InvalidProof();

        // 4. Amount consistency check
        uint256 storedAmount = pool.getCommitmentAmount(commitment);
        if (storedAmount != betAmount) revert InvalidProof();

        // 5. Mark nullifier used before any external calls (CEI pattern)
        nullifierUsed[nullifier] = true;

        // 6. Calculate proportional payout
        //    payout = (betAmount / winningPool) * totalPool
        uint256 winningPool = pool.getPool(marketId, outcome);
        uint256 totalPool   = pool.getTotalPool(marketId);
        if (winningPool == 0) revert ZeroPayout();

        uint256 payout = (betAmount * totalPool) / winningPool;
        if (payout == 0) revert ZeroPayout();

        emit Claimed(marketId, nullifier, msg.sender, payout);

        // 7. Trigger payout from PrivacyPool (which holds the ETH)
        pool.payout(msg.sender, payout);
    }

    // ================================================================
    // │                          Getters                             │
    // ================================================================

    /// @notice Check if a nullifier has already been used.
    function isNullifierUsed(bytes32 nullifier) external view returns (bool) {
        return nullifierUsed[nullifier];
    }

    /// @notice Preview payout for a given bet without submitting a claim.
    function previewPayout(
        uint256 marketId,
        Outcome outcome,
        uint256 betAmount
    ) external view returns (uint256) {
        uint256 winningPool = pool.getPool(marketId, outcome);
        uint256 totalPool   = pool.getTotalPool(marketId);
        if (winningPool == 0) return 0;
        return (betAmount * totalPool) / winningPool;
    }
}
