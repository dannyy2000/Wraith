# Wraith — Contracts

Solidity contracts for the Wraith prediction market protocol. Built with Foundry, targeting Arbitrum.

## Structure

```
src/
├── MarketFactory.sol     # Deploys markets, stores resolution config
├── Market.sol            # Individual market logic + state machine
├── PrivacyPool.sol       # Commitment-based private bet intake
└── ClaimRegistry.sol     # Nullifier tracking, payout verification
```

## Setup

```bash
forge install
forge build
forge test
```

## Deploy

```bash
forge script script/Deploy.s.sol --rpc-url <rpc_url> --private-key <key> --broadcast
```
