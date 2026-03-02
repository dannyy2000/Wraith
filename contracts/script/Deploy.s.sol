// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/MarketFactory.sol";
import "../src/PrivacyPool.sol";
import "../src/ClaimRegistry.sol";
import "../src/WraithKeeper.sol";

/// @notice Deploys the full Wraith protocol and wires contracts together.
///
/// Required env vars:
///   PRIVATE_KEY              — deployer private key (0x-prefixed)
///   CRE_FORWARDER_ADDRESS    — Chainlink CRE Forwarder on target chain
///
/// Usage:
///   forge script script/Deploy.s.sol \
///     --rpc-url arbitrum_sepolia \
///     --broadcast \
///     --verify
contract DeployWraith is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address forwarder   = vm.envAddress("CRE_FORWARDER_ADDRESS");

        address deployer = vm.addr(deployerKey);
        console.log("Deployer:  ", deployer);
        console.log("Forwarder: ", forwarder);
        console.log("Chain ID:  ", block.chainid);
        console.log("---");

        vm.startBroadcast(deployerKey);

        // 1. MarketFactory — markets, resolution config, CRE entry point
        MarketFactory factory = new MarketFactory(forwarder);
        console.log("MarketFactory deployed:", address(factory));

        // 2. PrivacyPool — commitment-based bet intake, ETH custodian
        PrivacyPool pool = new PrivacyPool(address(factory));
        console.log("PrivacyPool deployed:  ", address(pool));

        // 3. ClaimRegistry — claim verification and payout
        ClaimRegistry claimRegistry = new ClaimRegistry(address(factory), address(pool));
        console.log("ClaimRegistry deployed:", address(claimRegistry));

        // 4. Wire PrivacyPool → ClaimRegistry (one-time, irreversible)
        pool.setClaimRegistry(address(claimRegistry));
        console.log("PrivacyPool wired to ClaimRegistry");

        // 5. WraithKeeper — Chainlink Automation keeper for settlement triggers
        WraithKeeper keeper = new WraithKeeper(address(factory));
        console.log("WraithKeeper deployed:  ", address(keeper));

        vm.stopBroadcast();

        console.log("---");
        console.log("Deployment complete.");
        console.log("");
        console.log("Add to your .env:");
        console.log("MARKET_FACTORY_ADDRESS=", address(factory));
        console.log("PRIVACY_POOL_ADDRESS=  ", address(pool));
        console.log("CLAIM_REGISTRY_ADDRESS=", address(claimRegistry));
        console.log("WRAITH_KEEPER_ADDRESS= ", address(keeper));
        console.log("");
        console.log("Register WRAITH_KEEPER_ADDRESS at automation.chain.link");
    }
}
