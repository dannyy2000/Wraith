// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/MarketFactory.sol";
import "../src/Types.sol";

contract MarketFactoryTest is Test {
    MarketFactory factory;

    address forwarder  = makeAddr("forwarder");
    address creator    = makeAddr("creator");
    address challenger = makeAddr("challenger");
    address anyone     = makeAddr("anyone");

    // ================================================================
    // │                            Setup                             │
    // ================================================================

    function setUp() public {
        factory = new MarketFactory(forwarder);
    }

    // ================================================================
    // │                      Helper Configs                          │
    // ================================================================

    function _priceFeedConfig(uint256 deadline) internal pure returns (ResolutionConfig memory) {
        return ResolutionConfig({
            resolutionType: ResolutionType.PRICE_FEED,
            source: "0xFakeFeed",
            endpoint: "",
            field: "",
            condition: ">= 5000",
            resolutionPrompt: "",
            deadline: deadline
        });
    }

    function _optimisticConfig(uint256 deadline) internal pure returns (ResolutionConfig memory) {
        return ResolutionConfig({
            resolutionType: ResolutionType.OPTIMISTIC,
            source: "",
            endpoint: "",
            field: "",
            condition: "",
            resolutionPrompt: "",
            deadline: deadline
        });
    }

    // ================================================================
    // │                      createMarket                            │
    // ================================================================

    function test_createMarket_basic() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(creator);
        uint256 id = factory.createMarket("Will ETH reach $5k?", _priceFeedConfig(deadline));

        Market memory m = factory.getMarket(id);
        assertEq(id, 0);
        assertEq(m.creator, creator);
        assertEq(m.question, "Will ETH reach $5k?");
        assertEq(uint(m.status), uint(MarketStatus.OPEN));
        assertEq(uint(m.outcome), uint(Outcome.UNRESOLVED));
        assertEq(m.config.deadline, deadline);
        assertEq(m.createdAt, block.timestamp);
    }

    function test_createMarket_incrementsId() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.startPrank(creator);
        uint256 id0 = factory.createMarket("Q1", _priceFeedConfig(deadline));
        uint256 id1 = factory.createMarket("Q2", _priceFeedConfig(deadline));
        uint256 id2 = factory.createMarket("Q3", _priceFeedConfig(deadline));
        vm.stopPrank();

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(factory.getMarketCount(), 3);
        assertEq(factory.getAllMarketIds().length, 3);
    }

    function test_createMarket_revertDeadlinePassed() public {
        vm.expectRevert(MarketFactory.DeadlinePassed.selector);
        factory.createMarket("Q", _priceFeedConfig(block.timestamp - 1));
    }

    function test_createMarket_optimistic_requiresBond() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.expectRevert(MarketFactory.InsufficientBond.selector);
        vm.prank(creator);
        factory.createMarket("Q", _optimisticConfig(deadline));
    }

    function test_createMarket_optimistic_storesBond() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.deal(creator, 1 ether);
        vm.prank(creator);
        uint256 id = factory.createMarket{value: 0.01 ether}("Q", _optimisticConfig(deadline));

        Market memory m = factory.getMarket(id);
        assertEq(m.creatorBond, 0.01 ether);
        assertEq(address(factory).balance, 0.01 ether);
    }

    // ================================================================
    // │                     proposeOutcome                           │
    // ================================================================

    function test_proposeOutcome_success() public {
        uint256 id = _createOptimisticMarket();
        Market memory m = factory.getMarket(id);

        vm.warp(m.config.deadline + 1);
        vm.prank(creator);
        factory.proposeOutcome(id, Outcome.YES);

        m = factory.getMarket(id);
        assertEq(uint(m.status), uint(MarketStatus.PENDING_RESOLUTION));
        assertEq(uint(m.proposedOutcome), uint(Outcome.YES));
        assertEq(m.disputeDeadline, block.timestamp + factory.DISPUTE_WINDOW());
    }

    function test_proposeOutcome_revertNotCreator() public {
        uint256 id = _createOptimisticMarket();
        vm.warp(factory.getMarket(id).config.deadline + 1);

        vm.expectRevert(MarketFactory.NotCreator.selector);
        vm.prank(anyone);
        factory.proposeOutcome(id, Outcome.YES);
    }

    function test_proposeOutcome_revertDeadlineNotReached() public {
        uint256 id = _createOptimisticMarket();

        vm.expectRevert(MarketFactory.DeadlineNotReached.selector);
        vm.prank(creator);
        factory.proposeOutcome(id, Outcome.YES);
    }

    function test_proposeOutcome_revertNotOptimistic() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(creator);
        uint256 id = factory.createMarket("Q", _priceFeedConfig(deadline));

        vm.warp(deadline + 1);
        vm.expectRevert(MarketFactory.NotOptimisticMarket.selector);
        vm.prank(creator);
        factory.proposeOutcome(id, Outcome.YES);
    }

    function test_proposeOutcome_revertInvalidOutcome() public {
        uint256 id = _createOptimisticMarket();
        vm.warp(factory.getMarket(id).config.deadline + 1);

        vm.expectRevert(MarketFactory.InvalidOutcome.selector);
        vm.prank(creator);
        factory.proposeOutcome(id, Outcome.UNRESOLVED);
    }

    // ================================================================
    // │                        challenge                             │
    // ================================================================

    function test_challenge_success() public {
        uint256 id = _createPendingOptimisticMarket();

        vm.deal(challenger, 1 ether);
        vm.prank(challenger);
        factory.challenge{value: 0.01 ether}(id);

        Market memory m = factory.getMarket(id);
        assertEq(uint(m.status), uint(MarketStatus.DISPUTED));
        assertEq(m.challenger, challenger);
        assertEq(m.challengerBond, 0.01 ether);
    }

    function test_challenge_revertWindowClosed() public {
        uint256 id = _createPendingOptimisticMarket();
        vm.warp(factory.getMarket(id).disputeDeadline + 1);

        vm.deal(challenger, 1 ether);
        vm.expectRevert(MarketFactory.DisputeWindowClosed.selector);
        vm.prank(challenger);
        factory.challenge{value: 0.01 ether}(id);
    }

    function test_challenge_revertInsufficientBond() public {
        uint256 id = _createPendingOptimisticMarket();

        vm.deal(challenger, 1 ether);
        vm.expectRevert(MarketFactory.InsufficientBond.selector);
        vm.prank(challenger);
        factory.challenge{value: 0.001 ether}(id);
    }

    function test_challenge_revertAlreadyChallenged() public {
        uint256 id = _createPendingOptimisticMarket();

        vm.deal(challenger, 1 ether);
        vm.prank(challenger);
        factory.challenge{value: 0.01 ether}(id);

        // After the first challenge, status = DISPUTED, so any second attempt
        // fails at the status check rather than a separate AlreadyChallenged error.
        address challenger2 = makeAddr("challenger2");
        vm.deal(challenger2, 1 ether);
        vm.expectRevert(MarketFactory.MarketNotPendingResolution.selector);
        vm.prank(challenger2);
        factory.challenge{value: 0.01 ether}(id);
    }

    // ================================================================
    // │                   finalizeOptimistic                         │
    // ================================================================

    function test_finalizeOptimistic_settlesAndReturnsBond() public {
        uint256 id = _createPendingOptimisticMarket();
        uint256 disputeDeadline = factory.getMarket(id).disputeDeadline;

        vm.warp(disputeDeadline + 1);

        uint256 balBefore = creator.balance;
        factory.finalizeOptimistic(id);

        Market memory m = factory.getMarket(id);
        assertEq(uint(m.status), uint(MarketStatus.SETTLED));
        assertEq(uint(m.outcome), uint(Outcome.YES));
        assertEq(creator.balance, balBefore + 0.01 ether);
    }

    function test_finalizeOptimistic_revertWindowOpen() public {
        uint256 id = _createPendingOptimisticMarket();

        vm.expectRevert(MarketFactory.DisputeWindowOpen.selector);
        factory.finalizeOptimistic(id);
    }

    function test_finalizeOptimistic_anyoneCanCall() public {
        uint256 id = _createPendingOptimisticMarket();
        vm.warp(factory.getMarket(id).disputeDeadline + 1);

        vm.prank(anyone);
        factory.finalizeOptimistic(id); // should not revert

        assertEq(uint(factory.getMarket(id).status), uint(MarketStatus.SETTLED));
    }

    // ================================================================
    // │                  onReport — access control                   │
    // ================================================================

    function test_onReport_revertNotForwarder() public {
        vm.expectRevert(MarketFactory.NotForwarder.selector);
        vm.prank(anyone);
        factory.onReport("", "");
    }

    // ================================================================
    // │                  onReport — 0x01 settle                     │
    // ================================================================

    function test_onReport_settleMarket_yes() public {
        uint256 id = _createPriceFeedMarket();

        bytes memory report = abi.encodePacked(
            bytes1(0x01),
            abi.encode(id, uint8(Outcome.YES), "ETH price confirmed >= 5000")
        );

        vm.prank(forwarder);
        factory.onReport("", report);

        Market memory m = factory.getMarket(id);
        assertEq(uint(m.status), uint(MarketStatus.SETTLED));
        assertEq(uint(m.outcome), uint(Outcome.YES));
        assertEq(m.reasoning, "ETH price confirmed >= 5000");
        assertGt(m.settledAt, 0);
    }

    function test_onReport_settleMarket_no() public {
        uint256 id = _createPriceFeedMarket();

        bytes memory report = abi.encodePacked(
            bytes1(0x01),
            abi.encode(id, uint8(Outcome.NO), "ETH price was below 5000")
        );

        vm.prank(forwarder);
        factory.onReport("", report);

        assertEq(uint(factory.getMarket(id).outcome), uint(Outcome.NO));
    }

    function test_onReport_settleMarket_revertAlreadySettled() public {
        uint256 id = _createPriceFeedMarket();

        bytes memory report = abi.encodePacked(
            bytes1(0x01),
            abi.encode(id, uint8(Outcome.YES), "first settle")
        );

        vm.prank(forwarder);
        factory.onReport("", report);

        vm.expectRevert(MarketFactory.MarketAlreadySettled.selector);
        vm.prank(forwarder);
        factory.onReport("", report);
    }

    // ================================================================
    // │            onReport — unknown prefix (no-op)                │
    // ================================================================

    function test_onReport_unknownPrefixDoesNothing() public {
        // 0x00 was the old CRE create-market route — removed.
        // Markets are now created directly by creators via createMarket().
        // Unknown prefixes should be silently ignored (no revert).
        bytes memory report = abi.encodePacked(bytes1(0x00), abi.encode("ignored"));
        vm.prank(forwarder);
        factory.onReport("", report); // should not revert
        assertEq(factory.getMarketCount(), 0); // nothing created
    }

    // ================================================================
    // │                  onReport — 0x02 settle dispute              │
    // ================================================================

    function test_onReport_settleDispute_creatorWins() public {
        uint256 id = _createDisputedMarket(); // creator proposed YES

        uint256 creatorBalBefore    = creator.balance;
        uint256 challengerBalBefore = challenger.balance;

        bytes memory report = abi.encodePacked(
            bytes1(0x02),
            abi.encode(id, uint8(Outcome.YES), "AI confirmed YES - creator was right")
        );

        vm.prank(forwarder);
        factory.onReport("", report);

        Market memory m = factory.getMarket(id);
        assertEq(uint(m.status), uint(MarketStatus.SETTLED));
        assertEq(uint(m.outcome), uint(Outcome.YES));
        // Creator wins both bonds (0.01 + 0.01 = 0.02 ether)
        assertEq(creator.balance, creatorBalBefore + 0.02 ether);
        assertEq(challenger.balance, challengerBalBefore);
    }

    function test_onReport_settleDispute_challengerWins() public {
        uint256 id = _createDisputedMarket(); // creator proposed YES

        uint256 creatorBalBefore    = creator.balance;
        uint256 challengerBalBefore = challenger.balance;

        bytes memory report = abi.encodePacked(
            bytes1(0x02),
            abi.encode(id, uint8(Outcome.NO), "AI confirmed NO - challenger was right")
        );

        vm.prank(forwarder);
        factory.onReport("", report);

        // Challenger wins both bonds
        assertEq(challenger.balance, challengerBalBefore + 0.02 ether);
        assertEq(creator.balance, creatorBalBefore);
    }

    function test_onReport_settleDispute_revertIfNotDisputed() public {
        uint256 id = _createPriceFeedMarket();

        bytes memory report = abi.encodePacked(
            bytes1(0x02),
            abi.encode(id, uint8(Outcome.YES), "reason")
        );

        vm.expectRevert(MarketFactory.MarketNotDisputed.selector);
        vm.prank(forwarder);
        factory.onReport("", report);
    }

    // ================================================================
    // │                  onReport — market not found                 │
    // ================================================================

    function test_onReport_revertMarketNotFound() public {
        bytes memory report = abi.encodePacked(
            bytes1(0x01),
            abi.encode(uint256(999), uint8(Outcome.YES), "reason")
        );

        vm.expectRevert(MarketFactory.MarketNotFound.selector);
        vm.prank(forwarder);
        factory.onReport("", report);
    }

    // ================================================================
    // │                   requestSettlement                          │
    // ================================================================

    function test_requestSettlement_emitsEvent() public {
        uint256 id = _createPriceFeedMarket();
        vm.warp(factory.getMarket(id).config.deadline + 1);

        vm.expectEmit(true, false, false, false);
        emit MarketFactory.SettlementRequested(id);
        factory.requestSettlement(id);
    }

    function test_requestSettlement_anyoneCanCall() public {
        uint256 id = _createPriceFeedMarket();
        vm.warp(factory.getMarket(id).config.deadline + 1);

        vm.prank(anyone);
        factory.requestSettlement(id); // should not revert
    }

    function test_requestSettlement_revertDeadlineNotReached() public {
        uint256 id = _createPriceFeedMarket();

        vm.expectRevert(MarketFactory.DeadlineNotReached.selector);
        factory.requestSettlement(id);
    }

    function test_requestSettlement_revertIfOptimistic() public {
        uint256 id = _createOptimisticMarket();
        vm.warp(factory.getMarket(id).config.deadline + 1);

        vm.expectRevert(MarketFactory.NotOptimisticMarket.selector);
        factory.requestSettlement(id);
    }

    function test_requestSettlement_revertIfAlreadySettled() public {
        uint256 id = _createPriceFeedMarket();
        vm.warp(factory.getMarket(id).config.deadline + 1);
        factory.requestSettlement(id);

        // Settle it
        bytes memory report = abi.encodePacked(
            bytes1(0x01),
            abi.encode(id, uint8(Outcome.YES), "settled")
        );
        vm.prank(forwarder);
        factory.onReport("", report);

        vm.expectRevert(MarketFactory.MarketAlreadySettled.selector);
        factory.requestSettlement(id);
    }

    // ================================================================
    // │                         Helpers                              │
    // ================================================================

    function _createPriceFeedMarket() internal returns (uint256 id) {
        vm.prank(creator);
        id = factory.createMarket("Will ETH reach $5k?", _priceFeedConfig(block.timestamp + 1 days));
    }

    function _createOptimisticMarket() internal returns (uint256 id) {
        vm.deal(creator, 1 ether);
        vm.prank(creator);
        id = factory.createMarket{value: 0.01 ether}("Q", _optimisticConfig(block.timestamp + 1 days));
    }

    function _createPendingOptimisticMarket() internal returns (uint256 id) {
        id = _createOptimisticMarket();
        vm.warp(factory.getMarket(id).config.deadline + 1);
        vm.prank(creator);
        factory.proposeOutcome(id, Outcome.YES);
    }

    function _createDisputedMarket() internal returns (uint256 id) {
        id = _createPendingOptimisticMarket();
        vm.deal(challenger, 1 ether);
        vm.prank(challenger);
        factory.challenge{value: 0.01 ether}(id);
    }

    receive() external payable {}
}
