// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ClaimRegistry.sol";
import "../src/PrivacyPool.sol";
import "../src/MarketFactory.sol";
import "../src/Types.sol";

contract ClaimRegistryTest is Test {
    MarketFactory  factory;
    PrivacyPool    pool;
    ClaimRegistry  claimReg;

    address forwarder = makeAddr("forwarder");
    address creator   = makeAddr("creator");
    address bettor1   = makeAddr("bettor1");
    address bettor2   = makeAddr("bettor2");
    address claimer   = makeAddr("claimer"); // different wallet from bettor1

    // Bettor1 secrets (YES, 2 ETH)
    bytes32 secret1   = keccak256("bettor1_secret");
    bytes32 nullifier1 = keccak256("bettor1_nullifier");

    // Bettor2 secrets (NO, 1 ETH)
    bytes32 secret2   = keccak256("bettor2_secret");
    bytes32 nullifier2 = keccak256("bettor2_nullifier");

    uint256 marketId;

    // ================================================================
    // │                            Setup                             │
    // ================================================================

    function setUp() public {
        factory  = new MarketFactory(forwarder);
        pool     = new PrivacyPool(address(factory));
        claimReg = new ClaimRegistry(address(factory), address(pool));

        pool.setClaimRegistry(address(claimReg));

        // Create market
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

        // Place bets
        vm.deal(bettor1, 10 ether);
        vm.deal(bettor2, 10 ether);

        bytes32 c1 = _commitment(marketId, Outcome.YES, 2 ether, secret1, nullifier1);
        bytes32 c2 = _commitment(marketId, Outcome.NO,  1 ether, secret2, nullifier2);

        vm.prank(bettor1);
        pool.placeBet{value: 2 ether}(marketId, Outcome.YES, c1);

        vm.prank(bettor2);
        pool.placeBet{value: 1 ether}(marketId, Outcome.NO, c2);

        // Settle: YES wins
        _settleMarket(marketId, Outcome.YES, "ETH confirmed >= 5000");
    }

    // ================================================================
    // │                      claim — happy path                      │
    // ================================================================

    function test_claim_fullPayout() public {
        // YES pool = 2 ETH, NO pool = 1 ETH, total = 3 ETH
        // bettor1 staked 2 ETH on YES
        // payout = (2 / 2) * 3 = 3 ETH
        uint256 balBefore = claimer.balance;

        vm.prank(claimer);
        claimReg.claim(marketId, Outcome.YES, 2 ether, secret1, nullifier1);

        assertEq(claimer.balance, balBefore + 3 ether);
    }

    function test_claim_partialPool() public {
        // Add a second YES bettor to split the YES side
        bytes32 secret3    = keccak256("bettor3_secret");
        bytes32 nullifier3 = keccak256("bettor3_nullifier");

        // Create fresh market for this test
        vm.prank(creator);
        uint256 mid = factory.createMarket(
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

        address bettor3 = makeAddr("bettor3");
        address bettor4 = makeAddr("bettor4");
        vm.deal(bettor3, 10 ether);
        vm.deal(bettor4, 10 ether);

        // YES: 2 ETH (bettor3) + 2 ETH (bettor4) = 4 ETH
        // NO:  2 ETH
        // Total: 6 ETH
        bytes32 c3 = _commitment(mid, Outcome.YES, 2 ether, secret3, nullifier3);
        bytes32 c4 = _commitment(mid, Outcome.YES, 2 ether, keccak256("s4"), keccak256("n4"));
        bytes32 c5 = _commitment(mid, Outcome.NO,  2 ether, keccak256("s5"), keccak256("n5"));

        vm.prank(bettor3);
        pool.placeBet{value: 2 ether}(mid, Outcome.YES, c3);
        vm.prank(bettor4);
        pool.placeBet{value: 2 ether}(mid, Outcome.YES, c4);
        vm.prank(bettor4);
        pool.placeBet{value: 2 ether}(mid, Outcome.NO, c5);

        _settleMarket(mid, Outcome.YES, "confirmed");

        // bettor3 payout: (2 / 4) * 6 = 3 ETH
        uint256 balBefore = bettor3.balance;
        vm.prank(bettor3);
        claimReg.claim(mid, Outcome.YES, 2 ether, secret3, nullifier3);
        assertEq(bettor3.balance, balBefore + 3 ether);
    }

    function test_claim_fromDifferentWallet() public {
        // bettor1 placed the bet but claimer (completely different address) claims
        assertNotEq(claimer, bettor1);

        vm.prank(claimer);
        claimReg.claim(marketId, Outcome.YES, 2 ether, secret1, nullifier1);

        assertGt(claimer.balance, 0);
        // bettor1 balance unchanged
        assertEq(bettor1.balance, 8 ether); // started with 10, bet 2
    }

    function test_claim_marksNullifierUsed() public {
        vm.prank(claimer);
        claimReg.claim(marketId, Outcome.YES, 2 ether, secret1, nullifier1);

        assertTrue(claimReg.isNullifierUsed(nullifier1));
    }

    // ================================================================
    // │                   claim — error cases                        │
    // ================================================================

    function test_claim_revertDoubleClaimSameWallet() public {
        vm.startPrank(claimer);
        claimReg.claim(marketId, Outcome.YES, 2 ether, secret1, nullifier1);

        vm.expectRevert(ClaimRegistry.NullifierAlreadyUsed.selector);
        claimReg.claim(marketId, Outcome.YES, 2 ether, secret1, nullifier1);
        vm.stopPrank();
    }

    function test_claim_revertDoubleClaimDifferentWallet() public {
        // First claim from claimer
        vm.prank(claimer);
        claimReg.claim(marketId, Outcome.YES, 2 ether, secret1, nullifier1);

        // Second attempt from a totally different wallet with the same nullifier
        address thief = makeAddr("thief");
        vm.expectRevert(ClaimRegistry.NullifierAlreadyUsed.selector);
        vm.prank(thief);
        claimReg.claim(marketId, Outcome.YES, 2 ether, secret1, nullifier1);
    }

    function test_claim_revertWrongOutcome() public {
        // bettor1 bet YES but tries to claim NO
        vm.expectRevert(ClaimRegistry.NotWinningSide.selector);
        vm.prank(claimer);
        claimReg.claim(marketId, Outcome.NO, 2 ether, secret1, nullifier1);
    }

    function test_claim_revertLosingBet() public {
        // bettor2 bet NO, market settled YES — they lost
        vm.expectRevert(ClaimRegistry.NotWinningSide.selector);
        vm.prank(bettor2);
        claimReg.claim(marketId, Outcome.NO, 1 ether, secret2, nullifier2);
    }

    function test_claim_revertMarketNotSettled() public {
        // Create a new unsettled market
        vm.prank(creator);
        uint256 unsettledId = factory.createMarket(
            "Unsettled market",
            ResolutionConfig({
                resolutionType: ResolutionType.PRICE_FEED,
                source: "0xFakeFeed",
                endpoint: "",
                field: "",
                condition: ">= 9999",
                resolutionPrompt: "",
                deadline: block.timestamp + 7 days
            })
        );

        vm.expectRevert(ClaimRegistry.MarketNotSettled.selector);
        vm.prank(claimer);
        claimReg.claim(unsettledId, Outcome.YES, 1 ether, secret1, nullifier1);
    }

    function test_claim_revertWrongSecret() public {
        bytes32 wrongSecret = keccak256("wrong_secret");

        vm.expectRevert(ClaimRegistry.InvalidProof.selector);
        vm.prank(claimer);
        claimReg.claim(marketId, Outcome.YES, 2 ether, wrongSecret, nullifier1);
    }

    function test_claim_revertWrongNullifier() public {
        bytes32 wrongNullifier = keccak256("wrong_nullifier");

        vm.expectRevert(ClaimRegistry.InvalidProof.selector);
        vm.prank(claimer);
        claimReg.claim(marketId, Outcome.YES, 2 ether, secret1, wrongNullifier);
    }

    function test_claim_revertWrongAmount() public {
        // Commitment was for 2 ETH; claiming with 1 ETH won't match
        vm.expectRevert(ClaimRegistry.InvalidProof.selector);
        vm.prank(claimer);
        claimReg.claim(marketId, Outcome.YES, 1 ether, secret1, nullifier1);
    }

    function test_claim_revertMarketNotFound() public {
        vm.expectRevert(ClaimRegistry.MarketNotFound.selector);
        vm.prank(claimer);
        claimReg.claim(999, Outcome.YES, 2 ether, secret1, nullifier1);
    }

    // ================================================================
    // │                      previewPayout                           │
    // ================================================================

    function test_previewPayout_correct() public view {
        // YES pool = 2 ETH, NO pool = 1 ETH, total = 3 ETH
        // 2 ETH bet on YES → payout = (2/2) * 3 = 3
        uint256 preview = claimReg.previewPayout(marketId, Outcome.YES, 2 ether);
        assertEq(preview, 3 ether);
    }

    function test_previewPayout_partial() public view {
        // 1 ETH bet on YES → payout = (1/2) * 3 = 1.5 ETH
        uint256 preview = claimReg.previewPayout(marketId, Outcome.YES, 1 ether);
        assertEq(preview, 1.5 ether);
    }

    function test_previewPayout_emptyPool() public view {
        // NO pool won but nobody bet on it — returns 0 safely
        uint256 preview = claimReg.previewPayout(999, Outcome.YES, 1 ether);
        assertEq(preview, 0);
    }

    // ================================================================
    // │                         Helpers                              │
    // ================================================================

    function _commitment(
        uint256 _marketId,
        Outcome _outcome,
        uint256 _amount,
        bytes32 _secret,
        bytes32 _nullifier
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_marketId, _outcome, _amount, _secret, _nullifier));
    }

    function _settleMarket(uint256 _marketId, Outcome _outcome, string memory _reasoning) internal {
        bytes memory report = abi.encodePacked(
            bytes1(0x01),
            abi.encode(_marketId, uint8(_outcome), _reasoning)
        );
        vm.prank(forwarder);
        factory.onReport("", report);
    }

    receive() external payable {}
}
