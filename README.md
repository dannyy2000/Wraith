# Wraith

Wraith is an on-chain prediction market protocol with end-to-end position privacy.

A CRE workflow scrapes Reddit for trending topics and passes them to OpenAI, which generates structured prediction market questions. Resolution logic is locked at deployment and executed autonomously by Chainlink CRE workflows — reading price feeds, polling APIs, or invoking AI verdict — with no manual intervention at settlement. Bets are submitted as on-chain commitments; amounts, directions, and identities remain private until a winner chooses to claim.

---

## The Problem

Existing prediction markets have two fundamental issues:

1. **No privacy** — every bet is public on-chain. Wallets get profiled, strategies get front-run, participation drops.
2. **Manual resolution** — someone has to decide the outcome. That someone can be bribed, pressured, or wrong.

Wraith fixes both.

---

## How It Works

### 1. Market Creation (AI-Assisted)

A Chainlink CRE workflow monitors Reddit trending topics and passes them to OpenAI. OpenAI generates:

- A well-formed prediction question
- The resolution type (price feed, API poll, AI verdict, or optimistic)
- The exact data source, endpoint, field, and condition to check at resolution
- A sensible deadline

The market creator reviews the suggestion, stakes a bond, and deploys the market on-chain. The resolution instructions are locked in at creation — no one can change them later.

### 2. Betting (Private via Commitments)

Users place bets through a privacy pool using a commitment scheme:

- Off-chain: user generates a secret + nullifier
- On-chain: only the commitment hash `keccak256(secret, nullifier, outcome, amount)` is stored
- The actual position (YES/NO, amount) is never revealed on-chain
- Bets are routed through Chainlink CRE's TEE (Trusted Execution Environment) for confidential execution

### 3. Resolution (Fully Automated)

At deadline, a Chainlink CRE workflow reads the resolution instructions locked at market creation and executes them. Four resolution types are supported:

| Type | How it resolves |
|---|---|
| `PRICE_FEED` | CRE reads a Chainlink price feed. Compares against stored condition. Fully trustless. |
| `API_POLL` | CRE makes a Confidential HTTP call to a specified API endpoint. Reads a field, checks a condition. |
| `AI_VERDICT` | CRE fetches articles from specified news sources, sends them + a predetermined prompt to OpenAI. OpenAI returns YES/NO + one-sentence reasoning. Result posted on-chain with a 48hr dispute window. |
| `OPTIMISTIC` | Market creator submits YES/NO. 48hr challenge window. Anyone can stake a counter-bond to dispute. Disputed markets escalate automatically to AI_VERDICT. |

### 4. Claiming (Private Payouts)

Winners reveal their secret to generate a claim credential. The claim is verified against the stored commitment. Payout is processed without linking the claim to any historical bet on-chain.

---

## Architecture

```
wraith/
├── contracts/              # Solidity — Foundry project
│   ├── src/
│   │   ├── MarketFactory.sol       # Deploys markets, stores resolution config
│   │   ├── Market.sol              # Individual market logic + state machine
│   │   ├── PrivacyPool.sol         # Commitment-based private bet intake
│   │   └── ClaimRegistry.sol       # Nullifier tracking, payout verification
│   ├── test/
│   └── script/
│
├── cre/                    # Chainlink CRE TypeScript workflows
│   ├── workflows/
│   │   ├── market-suggester.ts     # Reddit → OpenAI → market suggestion
│   │   ├── bet-intake.ts           # Private bet routing via TEE
│   │   ├── settlement.ts           # Automated resolution at deadline
│   │   └── payout.ts               # Private claim verification + payout
│   └── package.json
│
└── frontend/               # Next.js UI
    ├── app/
    ├── components/
    └── lib/
```

---

## Resolution in Detail

### PRICE_FEED

```
Market created with:
  condition: "ETH/USD >= 5000"
  source: Chainlink ETH/USD feed (Arbitrum)
  deadline: March 30

At deadline:
  CRE reads Chainlink feed → price = 4800
  4800 >= 5000? → NO
  Posts NO on-chain → settlement triggered
```

Zero humans. Zero AI. Pure on-chain data.

### API_POLL

```
Market created with:
  condition: "subscribers >= 10000000"
  source: Reddit API
  endpoint: /r/cryptocurrency/about
  field: data.subscribers
  deadline: March 30

At deadline:
  CRE calls Reddit API (Confidential HTTP)
  response.data.subscribers = 9800000
  9800000 >= 10000000? → NO
  Posts NO on-chain
```

### AI_VERDICT

```
Market created with:
  question: "Will the SEC approve a Solana ETF in Q1 2026?"
  sources: ["newsapi.org", "reuters.com"]
  resolution_prompt: "Based on these articles, as of March 30 2026,
                      has the SEC formally approved a Solana ETF?
                      Answer YES or NO with one sentence of reasoning."
  deadline: March 30

At deadline:
  CRE fetches articles from sources (Confidential HTTP)
  Sends articles + prompt to OpenAI
  OpenAI returns: { verdict: "NO", reason: "No formal approval found" }
  CRE posts NO + reasoning on-chain
  48hr dispute window → if no challenge → settled
```

### OPTIMISTIC

```
Market created with:
  question: "Will Vitalik post a new L3 blog post before April?"
  creator_bond: 50 USDC (locked)
  deadline: March 30

At deadline:
  Creator submits YES or NO
  48hr window → anyone can challenge by staking counter-bond
  If challenged → escalates to AI_VERDICT automatically
  Loser of dispute loses bond
  If no challenge → settles as proposed
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity, Foundry |
| Automation & Oracles | Chainlink CRE (Workflows, Confidential HTTP, TEE) |
| Price Feeds | Chainlink Data Feeds |
| AI | OpenAI (GPT-4o-mini) via CRE |
| Privacy | Commitment scheme (keccak256), nullifier pattern |
| Frontend | Next.js, wagmi, viem |
| Target Chain | Arbitrum |

---

## Key Design Decisions

**Why CRE for privacy?**
CRE workflows run inside a TEE — bets processed through CRE are not visible to anyone, including Chainlink node operators. This gives us off-chain privacy with on-chain finality.

**Why lock resolution instructions at creation?**
The AI's only job is at market creation. Once deployed, the resolution path is deterministic and tamper-proof. Nobody — not the creator, not the AI, not Chainlink — can change how a market resolves after it's live.

**Why four resolution types?**
Different questions need different trust assumptions. Price feed markets need zero trust. API markets need trusted HTTP (handled by CRE TEE). Subjective questions need reasoning (AI verdict). Long-tail questions where data is hard to source need economic accountability (optimistic).

**Why does optimistic escalate to AI_VERDICT?**
Disputes need resolution. AI_VERDICT with a predetermined prompt is more consistent and cheaper than on-chain arbitration. The bond mechanism ensures neither side lies cheaply.

---

## Getting Started

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+
- A Chainlink CRE account

### Contracts

```bash
cd contracts
forge install
forge build
forge test
```

### CRE Workflows

```bash
cd cre
npm install
# configure secrets.yaml with OPENAI_API_KEY, NEWS_API_KEY
npm run deploy:workflows
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# fill in .env.local with deployed contract addresses and your WalletConnect project ID
npm run dev
```

**Environment variables** (`.env.local`):

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_FACTORY_ADDRESS` | Deployed `MarketFactory` address |
| `NEXT_PUBLIC_POOL_ADDRESS` | Deployed `PrivacyPool` address |
| `NEXT_PUBLIC_REGISTRY_ADDRESS` | Deployed `ClaimRegistry` address |
| `NEXT_PUBLIC_CRE_SUGGESTER_URL` | Chainlink CRE `market-suggester` HTTP endpoint |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect cloud project ID |

**Bet privacy model**: When you place a bet, a secret and nullifier are generated client-side and stored only in your browser's `localStorage`. The on-chain commitment is a hash — your position is never revealed. To claim winnings, you reveal the secret + nullifier. Crucially, the claim can be submitted from any wallet, breaking the link between your betting wallet and your claiming wallet.

---

## WraithKeeper — Chainlink Automation

`WraithKeeper.sol` is a Chainlink Automation-compatible keeper that automatically triggers settlement for expired markets.

```
Chainlink Automation → checkUpkeep() every block
  → finds first OPEN, non-OPTIMISTIC market past deadline
  → calls performUpkeep(marketId)
  → calls factory.requestSettlement(marketId)
  → emits SettlementRequested
  → CRE log trigger fires → runs settlement workflow
```

After deployment, register the keeper at [automation.chain.link](https://automation.chain.link) with the `WraithKeeper` address as the upkeep contract.

---

## Status

Built for the Chainlink hackathon.

| Component | Status |
|---|---|
| Contracts | Complete — 77 tests passing |
| CRE Workflows | Complete — market-suggester + settlement |
| WraithKeeper | Complete — Chainlink Automation integration |
| Frontend | Complete — Next.js 14, RainbowKit, wagmi |

---

## License

MIT
