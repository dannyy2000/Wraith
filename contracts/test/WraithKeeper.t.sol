// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/MarketFactory.sol";
import "../src/WraithKeeper.sol";
import "../src/Types.sol";

contract WraithKeeperTest is Test {
    MarketFactory factory;
    WraithKeeper  keeper;

    address forwarder = makeAddr("forwarder");
    address creator   = makeAddr("creator");
    address anyone    = makeAddr("anyone");

    // ================================================================
    // │                            Setup                             │
    // ================================================================

    function setUp() public {
        factory = new MarketFactory(forwarder);
        keeper  = new WraithKeeper(address(factory));
        vm.deal(creator, 1 ether);
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

    function _aiConfig(uint256 deadline) internal pure returns (ResolutionConfig memory) {
        return ResolutionConfig({
            resolutionType: ResolutionType.AI_VERDICT,
            source: "reuters.com,coindesk.com",
            endpoint: "",
            field: "",
            condition: "",
            resolutionPrompt: "Has X happened?",
            deadline: deadline
        });
    }

    function _apiConfig(uint256 deadline) internal pure returns (ResolutionConfig memory) {
        return ResolutionConfig({
            resolutionType: ResolutionType.API_POLL,
            source: "https://api.example.com",
            endpoint: "/v1/price",
            field: "eth.usd",
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
    // │                        Constructor                           │
    // ================================================================

    function test_constructor_setsFactory() public view {
        assertEq(address(keeper.factory()), address(factory));
    }

    // ================================================================
    // │                    checkUpkeep — no markets                  │
    // ================================================================

    function test_checkUpkeep_noMarkets_returnsFalse() public view {
        (bool needed, bytes memory data) = keeper.checkUpkeep("");
        assertFalse(needed);
        assertEq(data, bytes(""));
    }

    // ================================================================
    // │               checkUpkeep — market not yet expired           │
    // ================================================================

    function test_checkUpkeep_marketNotExpired_returnsFalse() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(creator);
        factory.createMarket("Will ETH reach $5k?", _priceFeedConfig(deadline));

        (bool needed,) = keeper.checkUpkeep("");
        assertFalse(needed);
    }

    // ================================================================
    // │               checkUpkeep — OPTIMISTIC market expired         │
    // ================================================================

    function test_checkUpkeep_optimisticMarket_returnsFalse() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(creator);
        factory.createMarket{value: 0.01 ether}(
            "Optimistic question",
            _optimisticConfig(deadline)
        );

        // Warp past deadline
        vm.warp(block.timestamp + 2 days);

        (bool needed,) = keeper.checkUpkeep("");
        assertFalse(needed);
    }

    // ================================================================
    // │               checkUpkeep — expired PRICE_FEED market        │
    // ================================================================

    function test_checkUpkeep_expiredPriceFeed_returnsTrue() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(creator);
        uint256 id = factory.createMarket("Will ETH reach $5k?", _priceFeedConfig(deadline));

        vm.warp(block.timestamp + 2 days);

        (bool needed, bytes memory data) = keeper.checkUpkeep("");
        assertTrue(needed);
        assertEq(abi.decode(data, (uint256)), id);
    }

    // ================================================================
    // │               checkUpkeep — expired AI_VERDICT market        │
    // ================================================================

    function test_checkUpkeep_expiredAiVerdict_returnsTrue() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(creator);
        uint256 id = factory.createMarket("Has exchange listed token?", _aiConfig(deadline));

        vm.warp(block.timestamp + 2 days);

        (bool needed, bytes memory data) = keeper.checkUpkeep("");
        assertTrue(needed);
        assertEq(abi.decode(data, (uint256)), id);
    }

    // ================================================================
    // │               checkUpkeep — expired API_POLL market          │
    // ================================================================

    function test_checkUpkeep_expiredApiPoll_returnsTrue() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(creator);
        uint256 id = factory.createMarket("Is ETH above $5k via API?", _apiConfig(deadline));

        vm.warp(block.timestamp + 2 days);

        (bool needed, bytes memory data) = keeper.checkUpkeep("");
        assertTrue(needed);
        assertEq(abi.decode(data, (uint256)), id);
    }

    // ================================================================
    // │       checkUpkeep — settled market is skipped                │
    // ================================================================

    function test_checkUpkeep_settledMarket_returnsFalse() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(creator);
        uint256 id = factory.createMarket("Will ETH reach $5k?", _priceFeedConfig(deadline));

        vm.warp(block.timestamp + 2 days);

        // Settle via forwarder
        bytes memory payload = abi.encode(id, uint8(0), "YES via feed");
        bytes memory report  = abi.encodePacked(uint8(0x01), payload);
        vm.prank(forwarder);
        factory.onReport("", report);

        (bool needed,) = keeper.checkUpkeep("");
        assertFalse(needed);
    }

    // ================================================================
    // │  checkUpkeep — mixed markets, returns first eligible         │
    // ================================================================

    function test_checkUpkeep_mixedMarkets_returnsFirstEligible() public {
        uint256 deadline = block.timestamp + 1 days;

        // Market 0: OPTIMISTIC — not eligible
        vm.prank(creator);
        factory.createMarket{value: 0.01 ether}("Optimistic", _optimisticConfig(deadline));

        // Market 1: PRICE_FEED — eligible after warp
        vm.prank(creator);
        uint256 eligibleId = factory.createMarket("Price feed market", _priceFeedConfig(deadline));

        // Market 2: AI_VERDICT — also eligible, but 1 comes first
        vm.prank(creator);
        factory.createMarket("AI market", _aiConfig(deadline));

        vm.warp(block.timestamp + 2 days);

        (bool needed, bytes memory data) = keeper.checkUpkeep("");
        assertTrue(needed);
        assertEq(abi.decode(data, (uint256)), eligibleId);
    }

    // ================================================================
    // │                    performUpkeep — happy path                │
    // ================================================================

    function test_performUpkeep_emitsSettlementRequested() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(creator);
        uint256 id = factory.createMarket("Will ETH reach $5k?", _priceFeedConfig(deadline));

        vm.warp(block.timestamp + 2 days);

        vm.expectEmit(true, false, false, false, address(factory));
        emit MarketFactory.SettlementRequested(id);

        vm.prank(anyone);
        keeper.performUpkeep(abi.encode(id));
    }

    function test_performUpkeep_emitsKeeperEvent() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(creator);
        uint256 id = factory.createMarket("Will ETH reach $5k?", _priceFeedConfig(deadline));

        vm.warp(block.timestamp + 2 days);

        vm.expectEmit(true, false, false, false, address(keeper));
        emit WraithKeeper.SettlementTriggered(id);

        keeper.performUpkeep(abi.encode(id));
    }

    // ================================================================
    // │          performUpkeep — revert if not eligible              │
    // ================================================================

    function test_performUpkeep_revert_marketNotExpiredYet() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(creator);
        uint256 id = factory.createMarket("Will ETH reach $5k?", _priceFeedConfig(deadline));

        // Do NOT warp — market is still live
        vm.expectRevert(WraithKeeper.NoEligibleMarket.selector);
        keeper.performUpkeep(abi.encode(id));
    }

    function test_performUpkeep_revert_optimisticMarket() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(creator);
        uint256 id = factory.createMarket{value: 0.01 ether}(
            "Optimistic question",
            _optimisticConfig(deadline)
        );

        vm.warp(block.timestamp + 2 days);

        vm.expectRevert(WraithKeeper.NoEligibleMarket.selector);
        keeper.performUpkeep(abi.encode(id));
    }

    function test_performUpkeep_revert_alreadySettled() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(creator);
        uint256 id = factory.createMarket("Will ETH reach $5k?", _priceFeedConfig(deadline));

        vm.warp(block.timestamp + 2 days);

        // Settle it
        bytes memory payload = abi.encode(id, uint8(0), "YES");
        bytes memory report  = abi.encodePacked(uint8(0x01), payload);
        vm.prank(forwarder);
        factory.onReport("", report);

        vm.expectRevert(WraithKeeper.NoEligibleMarket.selector);
        keeper.performUpkeep(abi.encode(id));
    }

    // ================================================================
    // │              performUpkeep — callable by anyone              │
    // ================================================================

    function test_performUpkeep_anyCallerAllowed() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(creator);
        uint256 id = factory.createMarket("Will ETH reach $5k?", _priceFeedConfig(deadline));

        vm.warp(block.timestamp + 2 days);

        // A random address can trigger it
        address random = makeAddr("random");
        vm.prank(random);
        keeper.performUpkeep(abi.encode(id));

        // Market is now PENDING_RESOLUTION (SettlementRequested emitted)
        Market memory m = factory.getMarket(id);
        assertEq(uint8(m.status), uint8(MarketStatus.OPEN)); // status unchanged on-chain — CRE settles it
    }

    // ================================================================
    // │            checkUpkeep + performUpkeep round-trip            │
    // ================================================================

    function test_roundtrip_checkThenPerform() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(creator);
        factory.createMarket("Will ETH reach $5k?", _priceFeedConfig(deadline));

        vm.warp(block.timestamp + 2 days);

        (bool needed, bytes memory data) = keeper.checkUpkeep("");
        assertTrue(needed);

        // performUpkeep succeeds with data from checkUpkeep
        keeper.performUpkeep(data);
    }
}
