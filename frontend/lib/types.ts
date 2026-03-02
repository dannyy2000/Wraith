export enum ResolutionType {
  PRICE_FEED = 0,
  API_POLL = 1,
  AI_VERDICT = 2,
  OPTIMISTIC = 3,
}

export enum MarketStatus {
  OPEN = 0,
  PENDING_RESOLUTION = 1,
  DISPUTED = 2,
  SETTLED = 3,
}

export enum Outcome {
  YES = 0,
  NO = 1,
  UNRESOLVED = 2,
}

export interface ResolutionConfig {
  resolutionType: ResolutionType
  source: string
  endpoint: string
  field: string
  condition: string
  resolutionPrompt: string
  deadline: bigint
}

export interface Market {
  id: bigint
  creator: `0x${string}`
  question: string
  config: ResolutionConfig
  status: MarketStatus
  outcome: Outcome
  reasoning: string
  createdAt: bigint
  settledAt: bigint
  creatorBond: bigint
  challenger: `0x${string}`
  challengerBond: bigint
  disputeDeadline: bigint
  proposedOutcome: Outcome
}

// Stored in localStorage after a bet is placed.
// bigint fields are serialized as strings since JSON.stringify can't handle bigint.
export interface StoredBet {
  marketId: string       // bigint as string
  outcome: Outcome
  amount: string         // wei as string
  secret: `0x${string}`
  nullifier: `0x${string}`
  placedAt: number       // unix ms
  question: string       // denormalized for display without a chain read
}

export interface MarketSuggestion {
  question: string
  resolutionType: number
  source: string
  endpoint: string
  field: string
  condition: string
  resolutionPrompt: string
  deadlineTimestamp: number
  redditSource: string
}
