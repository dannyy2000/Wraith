// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice How a market's outcome is determined at deadline.
enum ResolutionType {
    PRICE_FEED, // 0 — Chainlink price feed vs. a stored condition
    API_POLL,   // 1 — CRE HTTP call to external API, reads a field
    AI_VERDICT, // 2 — Claude reads news sources and determines YES/NO
    OPTIMISTIC  // 3 — Creator proposes; disputes escalate to AI_VERDICT
}

/// @notice Lifecycle state of a market.
enum MarketStatus {
    OPEN,               // 0 — Accepting bets
    PENDING_RESOLUTION, // 1 — Past deadline, awaiting or in dispute window
    DISPUTED,           // 2 — OPTIMISTIC market challenged; CRE will run AI_VERDICT
    SETTLED             // 3 — Final outcome recorded
}

/// @notice The two possible outcomes of a market, plus the initial unresolved state.
enum Outcome {
    YES,       // 0
    NO,        // 1
    UNRESOLVED // 2
}

/// @notice Resolution instructions locked at market creation. Never changed after deployment.
struct ResolutionConfig {
    ResolutionType resolutionType;
    /// @dev PRICE_FEED: Chainlink feed address
    ///      API_POLL:   API base URL
    ///      AI_VERDICT: Comma-separated news source URLs
    ///      OPTIMISTIC: Empty
    string source;
    string endpoint;         // API_POLL only — path to call
    string field;            // API_POLL only — JSON field to extract
    string condition;        // PRICE_FEED / API_POLL — e.g. ">= 5000"
    string resolutionPrompt; // AI_VERDICT only — prompt sent to Claude at settlement
    uint256 deadline;        // Unix timestamp when resolution triggers
}

/// @notice Full market state.
struct Market {
    uint256 id;
    address creator;
    string question;
    ResolutionConfig config;
    MarketStatus status;
    Outcome outcome;
    string reasoning;   // AI reasoning or resolution notes posted on-chain
    uint256 createdAt;
    uint256 settledAt;
    // OPTIMISTIC dispute fields
    uint256 creatorBond;
    address challenger;
    uint256 challengerBond;
    uint256 disputeDeadline;
    Outcome proposedOutcome;
}
