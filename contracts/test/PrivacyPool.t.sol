// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/PrivacyPool.sol";
import "../src/MarketFactory.sol";
import "../src/Types.sol";

contract PrivacyPoolTest is Test {
    MarketFactory factory;
    PrivacyPool   pool;

    address forwarder = makeAddr("forwarder");
    address creator   = makeAddr("creator");
    address bettor    = makeAddr("bettor");
    address claimReg  = makeAddr("claimReg");
    address anyone    = makeAddr("anyone");

    uint256 marketId;

    // ================================================================
    // │                            Setup                             │
    // ================================================================

    function setUp() public {
        factory = new MarketFactory(forwarder);
        pool    = new PrivacyPool(address(factory));

        vm.prank(creator);
        marketId = factory.createMarket(
            "Will ETH hit $5k?",
            ResolutionConfig({
                resolutionType: ResolutionType.PRICE_FEED,
                source: "0xFakeFeed",
                endpoint: "",
                field: "",
                condition: ">= 5000",
                resolutionPrompt: "",
                deadline: block.timestamp + 7 days
            })
        );
    }

    // ================================================================
    // │                        placeBet                              │
    // ================================================================

    function test_placeBet_success() public {
        uint256 amount  = 1 ether;
        bytes32 commitment = _commitment(marketId, Outcome.YES, amount, keccak256("s1"), keccak256("n1"));

        vm.deal(bettor, 2 ether);
        vm.prank(bettor);
        pool.placeBet{value: amount}(marketId, Outcome.YES, commitment);

        assertTrue(pool.commitmentExists(commitment));
        assertEq(pool.getCommitmentAmount(commitment), amount);
        assertEq(pool.getPool(marketId, Outcome.YES), amount);
        assertEq(pool.getPool(marketId, Outcome.NO), 0);
        assertEq(pool.getTotalPool(marketId), amount);
        assertEq(pool.betCount(marketId), 1);
    }

    function test_placeBet_tracksBothSides() public {
        vm.deal(bettor, 10 ether);

        bytes32 c1 = _commitment(marketId, Outcome.YES, 2 ether, keccak256("s1"), keccak256("n1"));
        bytes32 c2 = _commitment(marketId, Outcome.NO,  3 ether, keccak256("s2"), keccak256("n2"));

        vm.startPrank(bettor);
        pool.placeBet{value: 2 ether}(marketId, Outcome.YES, c1);
        pool.placeBet{value: 3 ether}(marketId, Outcome.NO,  c2);
        vm.stopPrank();

        assertEq(pool.getPool(marketId, Outcome.YES), 2 ether);
        assertEq(pool.getPool(marketId, Outcome.NO),  3 ether);
        assertEq(pool.getTotalPool(marketId), 5 ether);
        assertEq(pool.betCount(marketId), 2);
    }

    function test_placeBet_multipleMarkets() public {
        vm.prank(creator);
        uint256 marketId2 = factory.createMarket(
            "Will BTC hit $100k?",
            ResolutionConfig({
                resolutionType: ResolutionType.PRICE_FEED,
                source: "0xBTCFeed",
                endpoint: "",
                field: "",
                condition: ">= 100000",
                resolutionPrompt: "",
                deadline: block.timestamp + 7 days
            })
        );

        vm.deal(bettor, 10 ether);
        bytes32 c1 = _commitment(marketId,  Outcome.YES, 1 ether, keccak256("s1"), keccak256("n1"));
        bytes32 c2 = _commitment(marketId2, Outcome.NO,  2 ether, keccak256("s2"), keccak256("n2"));

        vm.startPrank(bettor);
        pool.placeBet{value: 1 ether}(marketId,  Outcome.YES, c1);
        pool.placeBet{value: 2 ether}(marketId2, Outcome.NO,  c2);
        vm.stopPrank();

        assertEq(pool.getTotalPool(marketId),  1 ether);
        assertEq(pool.getTotalPool(marketId2), 2 ether);
    }

    function test_placeBet_revertZeroAmount() public {
        bytes32 c = _commitment(marketId, Outcome.YES, 1 ether, keccak256("s"), keccak256("n"));

        vm.expectRevert(PrivacyPool.ZeroAmount.selector);
        vm.prank(bettor);
        pool.placeBet{value: 0}(marketId, Outcome.YES, c);
    }

    function test_placeBet_revertDuplicateCommitment() public {
        bytes32 c = _commitment(marketId, Outcome.YES, 1 ether, keccak256("s"), keccak256("n"));

        vm.deal(bettor, 10 ether);
        vm.startPrank(bettor);
        pool.placeBet{value: 1 ether}(marketId, Outcome.YES, c);

        vm.expectRevert(PrivacyPool.CommitmentExists.selector);
        pool.placeBet{value: 1 ether}(marketId, Outcome.YES, c);
        vm.stopPrank();
    }

    function test_placeBet_revertZeroCommitment() public {
        vm.deal(bettor, 2 ether);
        vm.expectRevert(PrivacyPool.InvalidCommitment.selector);
        vm.prank(bettor);
        pool.placeBet{value: 1 ether}(marketId, Outcome.YES, bytes32(0));
    }

    function test_placeBet_revertUnresolvedOutcome() public {
        bytes32 c = _commitment(marketId, Outcome.UNRESOLVED, 1 ether, keccak256("s"), keccak256("n"));

        vm.deal(bettor, 2 ether);
        vm.expectRevert(PrivacyPool.InvalidCommitment.selector);
        vm.prank(bettor);
        pool.placeBet{value: 1 ether}(marketId, Outcome.UNRESOLVED, c);
    }

    function test_placeBet_revertAfterDeadline() public {
        uint256 deadline = factory.getMarket(marketId).config.deadline;
        vm.warp(deadline + 1);

        bytes32 c = _commitment(marketId, Outcome.YES, 1 ether, keccak256("s"), keccak256("n"));
        vm.deal(bettor, 2 ether);
        vm.expectRevert(PrivacyPool.MarketDeadlinePassed.selector);
        vm.prank(bettor);
        pool.placeBet{value: 1 ether}(marketId, Outcome.YES, c);
    }

    function test_placeBet_revertMarketSettled() public {
        // Settle the market via CRE
        bytes memory report = abi.encodePacked(
            bytes1(0x01),
            abi.encode(marketId, uint8(Outcome.YES), "settled")
        );
        vm.prank(forwarder);
        factory.onReport("", report);

        bytes32 c = _commitment(marketId, Outcome.YES, 1 ether, keccak256("s"), keccak256("n"));
        vm.deal(bettor, 2 ether);
        vm.expectRevert(PrivacyPool.MarketNotOpen.selector);
        vm.prank(bettor);
        pool.placeBet{value: 1 ether}(marketId, Outcome.YES, c);
    }

    function test_placeBet_revertMarketNotFound() public {
        bytes32 c = _commitment(999, Outcome.YES, 1 ether, keccak256("s"), keccak256("n"));
        vm.deal(bettor, 2 ether);
        vm.expectRevert(PrivacyPool.MarketNotOpen.selector);
        vm.prank(bettor);
        pool.placeBet{value: 1 ether}(999, Outcome.YES, c);
    }

    // ================================================================
    // │                     setClaimRegistry                         │
    // ================================================================

    function test_setClaimRegistry_success() public {
        pool.setClaimRegistry(claimReg);
        assertEq(pool.claimRegistry(), claimReg);
    }

    function test_setClaimRegistry_revertIfAlreadySet() public {
        pool.setClaimRegistry(claimReg);
        vm.expectRevert(PrivacyPool.ClaimRegistryAlreadySet.selector);
        pool.setClaimRegistry(anyone);
    }

    // ================================================================
    // │                          payout                              │
    // ================================================================

    function test_payout_success() public {
        pool.setClaimRegistry(claimReg);
        vm.deal(address(pool), 2 ether);

        uint256 balBefore = anyone.balance;
        vm.prank(claimReg);
        pool.payout(anyone, 1 ether);

        assertEq(anyone.balance, balBefore + 1 ether);
        assertEq(address(pool).balance, 1 ether);
    }

    function test_payout_revertNotClaimRegistry() public {
        pool.setClaimRegistry(claimReg);
        vm.deal(address(pool), 2 ether);

        vm.expectRevert(PrivacyPool.NotClaimRegistry.selector);
        vm.prank(anyone);
        pool.payout(anyone, 1 ether);
    }

    // ================================================================
    // │                         Helpers                              │
    // ================================================================

    /// @dev Mirrors the commitment formula used in ClaimRegistry.claim()
    function _commitment(
        uint256 _marketId,
        Outcome _outcome,
        uint256 _amount,
        bytes32 _secret,
        bytes32 _nullifier
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_marketId, _outcome, _amount, _secret, _nullifier));
    }
}
