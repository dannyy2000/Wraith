// wraith/cre/workflows/settlement/main.ts
//
// Two Log Trigger workflow:
//
//   Trigger 1: SettlementRequested(uint256 indexed marketId)
//     → Read market config from chain
//     → Execute resolution by type:
//         PRICE_FEED  — Read Chainlink price feed, compare condition
//         API_POLL    — HTTP call to API endpoint, read field, compare condition
//         AI_VERDICT  — Fetch news + ask OpenAI, return YES/NO + reasoning
//     → Write 0x01 report to MarketFactory.onReport()
//
//   Trigger 2: DisputeEscalated(uint256 indexed marketId)
//     → Read market question from chain
//     → Run AI_VERDICT (OpenAI)
//     → Write 0x02 report (settleDispute route)

import {
  cre,
  Runner,
  ok,
  consensusIdenticalAggregation,
  getNetwork,
  bytesToHex,
  hexToBase64,
  TxStatus,
  encodeCallMsg,
  type Runtime,
  type EVMLog,
  type HTTPSendRequester,
} from "@chainlink/cre-sdk";
import {
  decodeEventLog,
  parseAbi,
  encodeFunctionData,
  decodeFunctionResult,
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  toHex,
  zeroAddress,
} from "viem";
import { getAiVerdict } from "./openai.js";

// ================================================================
// │                           Types                              │
// ================================================================

type Config = {
  openaiModel: string;
  evms: Array<{
    marketFactoryAddress: string;
    chainSelectorName: string;
    gasLimit: string;
  }>;
};

// Mirrors MarketFactory ResolutionType enum
const ResolutionType = {
  PRICE_FEED: 0,
  API_POLL: 1,
  AI_VERDICT: 2,
  OPTIMISTIC: 3,
} as const;

// Mirrors MarketFactory Outcome enum
const Outcome = { YES: 0, NO: 1, UNRESOLVED: 2 } as const;

// ================================================================
// │                       Contract ABIs                          │
// ================================================================

const SETTLEMENT_REQUESTED_ABI = parseAbi([
  "event SettlementRequested(uint256 indexed marketId)",
]);

const DISPUTE_ESCALATED_ABI = parseAbi([
  "event DisputeEscalated(uint256 indexed marketId)",
]);

const GET_MARKET_ABI = [
  {
    name: "getMarket",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "creator", type: "address" },
          { name: "question", type: "string" },
          {
            name: "config",
            type: "tuple",
            components: [
              { name: "resolutionType", type: "uint8" },
              { name: "source", type: "string" },
              { name: "endpoint", type: "string" },
              { name: "field", type: "string" },
              { name: "condition", type: "string" },
              { name: "resolutionPrompt", type: "string" },
              { name: "deadline", type: "uint256" },
            ],
          },
          { name: "status", type: "uint8" },
          { name: "outcome", type: "uint8" },
          { name: "reasoning", type: "string" },
          { name: "createdAt", type: "uint256" },
          { name: "settledAt", type: "uint256" },
          { name: "creatorBond", type: "uint256" },
          { name: "challenger", type: "address" },
          { name: "challengerBond", type: "uint256" },
          { name: "disputeDeadline", type: "uint256" },
          { name: "proposedOutcome", type: "uint8" },
        ],
      },
    ],
  },
] as const;

// Minimal price feed ABI
const PRICE_FEED_ABI = [
  {
    name: "latestRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

// Settlement report ABI — matches MarketFactory._settleMarket / _settleDispute
const SETTLEMENT_PARAMS = parseAbiParameters("uint256 marketId, uint8 outcome, string reasoning");

// ================================================================
// │                      Helper: Read Market                     │
// ================================================================

function readMarket(runtime: Runtime<Config>, marketId: bigint) {
  const evmConfig = runtime.config.evms[0];
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmConfig.chainSelectorName,
    isTestnet: true,
  });
  if (!network) throw new Error(`Unknown chain: ${evmConfig.chainSelectorName}`);

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

  const callData = encodeFunctionData({
    abi: GET_MARKET_ABI,
    functionName: "getMarket",
    args: [marketId],
  });

  const result = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: evmConfig.marketFactoryAddress as `0x${string}`,
        data: callData,
      }),
    })
    .result();

  return decodeFunctionResult({
    abi: GET_MARKET_ABI,
    functionName: "getMarket",
    data: bytesToHex(result.data),
  });
}

// ================================================================
// │              Helper: Write Settlement Report                  │
// ================================================================

function writeSettlementReport(
  runtime: Runtime<Config>,
  marketId: bigint,
  outcome: number,
  reasoning: string,
  prefix: "0x01" | "0x02"
): string {
  const evmConfig = runtime.config.evms[0];
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmConfig.chainSelectorName,
    isTestnet: true,
  });
  if (!network) throw new Error(`Unknown chain: ${evmConfig.chainSelectorName}`);

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

  const encoded = encodeAbiParameters(SETTLEMENT_PARAMS, [
    marketId,
    outcome,
    reasoning,
  ]);

  const reportData = (prefix + encoded.slice(2)) as `0x${string}`;

  const report = runtime
    .report({
      encodedPayload: hexToBase64(reportData),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: evmConfig.marketFactoryAddress,
      report,
      gasConfig: { gasLimit: evmConfig.gasLimit },
    })
    .result();

  if (writeResult.txStatus !== TxStatus.SUCCESS) {
    throw new Error(`Transaction failed: ${writeResult.txStatus}`);
  }

  return bytesToHex(writeResult.txHash || new Uint8Array(32));
}

// ================================================================
// │          Helper: Evaluate Condition (PRICE_FEED / API_POLL)  │
// ================================================================

function evaluateCondition(value: number, condition: string): boolean {
  const match = condition.trim().match(/^(>=|<=|>|<|==)\s*(\d+(?:\.\d+)?)$/);
  if (!match) throw new Error(`Cannot parse condition: "${condition}"`);

  const [, operator, threshold] = match;
  const thresholdNum = parseFloat(threshold);

  switch (operator) {
    case ">=": return value >= thresholdNum;
    case "<=": return value <= thresholdNum;
    case ">":  return value > thresholdNum;
    case "<":  return value < thresholdNum;
    case "==": return value === thresholdNum;
    default:   throw new Error(`Unknown operator: ${operator}`);
  }
}

// ================================================================
// │           Resolution: PRICE_FEED                             │
// ================================================================

function settlePriceFeed(
  runtime: Runtime<Config>,
  marketId: bigint,
  source: string,
  condition: string,
  question: string
): string {
  runtime.log("[PRICE_FEED] Reading Chainlink price feed...");

  const evmConfig = runtime.config.evms[0];
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmConfig.chainSelectorName,
    isTestnet: true,
  });
  if (!network) throw new Error(`Unknown chain: ${evmConfig.chainSelectorName}`);

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

  // Read decimals
  const decimalsCall = encodeFunctionData({ abi: PRICE_FEED_ABI, functionName: "decimals" });
  const decimalsResult = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({ from: zeroAddress, to: source as `0x${string}`, data: decimalsCall }),
    })
    .result();
  const decimals = Number(
    decodeFunctionResult({ abi: PRICE_FEED_ABI, functionName: "decimals", data: bytesToHex(decimalsResult.data) })
  );

  // Read latest price
  const priceCall = encodeFunctionData({ abi: PRICE_FEED_ABI, functionName: "latestRoundData" });
  const priceResult = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({ from: zeroAddress, to: source as `0x${string}`, data: priceCall }),
    })
    .result();
  const [, answer] = decodeFunctionResult({
    abi: PRICE_FEED_ABI,
    functionName: "latestRoundData",
    data: bytesToHex(priceResult.data),
  }) as [bigint, bigint, bigint, bigint, bigint];

  const price = Number(answer) / Math.pow(10, decimals);
  runtime.log(`[PRICE_FEED] Price: ${price}, Condition: ${condition}`);

  const outcome = evaluateCondition(price, condition) ? Outcome.YES : Outcome.NO;
  const reasoning = `Price feed returned ${price}. Condition "${condition}" evaluated to ${outcome === Outcome.YES ? "YES" : "NO"}.`;

  runtime.log(`[PRICE_FEED] Outcome: ${outcome === Outcome.YES ? "YES" : "NO"}`);
  return writeSettlementReport(runtime, marketId, outcome, reasoning, "0x01");
}

// ================================================================
// │           Resolution: API_POLL                               │
// ================================================================

function settleApiPoll(
  runtime: Runtime<Config>,
  marketId: bigint,
  source: string,
  endpoint: string,
  field: string,
  condition: string
): string {
  runtime.log(`[API_POLL] Calling ${source}${endpoint}...`);

  const httpClient = new cre.capabilities.HTTPClient();

  const result = httpClient
    .sendRequest(
      runtime,
      (sendRequester: HTTPSendRequester, _config: Config): { value: number; raw: string } => {
        const resp = sendRequester
          .sendRequest({
            url: `${source}${endpoint}`,
            method: "GET",
            cacheSettings: { store: true, maxAge: "60s" },
          })
          .result();

        if (!ok(resp)) throw new Error(`API error: ${resp.statusCode}`);

        const body = new TextDecoder().decode(resp.body);
        const data = JSON.parse(body) as Record<string, unknown>;

        // Resolve dot-notation field path (e.g. "ethereum.usd")
        const keys = field.split(".");
        let current: unknown = data;
        for (const key of keys) {
          current = (current as Record<string, unknown>)[key];
          if (current === undefined) throw new Error(`Field "${field}" not found in response`);
        }

        return { value: Number(current), raw: String(current) };
      },
      consensusIdenticalAggregation<{ value: number; raw: string }>()
    )(runtime.config)
    .result();

  runtime.log(`[API_POLL] Field "${field}" = ${result.raw}, Condition: ${condition}`);

  const outcome = evaluateCondition(result.value, condition) ? Outcome.YES : Outcome.NO;
  const reasoning = `API returned ${field} = ${result.raw}. Condition "${condition}" evaluated to ${outcome === Outcome.YES ? "YES" : "NO"}.`;

  runtime.log(`[API_POLL] Outcome: ${outcome === Outcome.YES ? "YES" : "NO"}`);
  return writeSettlementReport(runtime, marketId, outcome, reasoning, "0x01");
}

// ================================================================
// │           Resolution: AI_VERDICT                             │
// ================================================================

function settleAiVerdict(
  runtime: Runtime<Config>,
  marketId: bigint,
  question: string,
  resolutionPrompt: string,
  source: string,
  reportPrefix: "0x01" | "0x02"
): string {
  runtime.log("[AI_VERDICT] Running OpenAI verdict...");

  const sources = source.split(",").map((s) => s.trim()).filter(Boolean);
  const verdict = getAiVerdict(runtime, question, resolutionPrompt, sources);

  runtime.log(`[AI_VERDICT] Verdict: ${verdict.verdict}`);
  runtime.log(`[AI_VERDICT] Reason:  ${verdict.reason}`);

  const outcome = verdict.verdict === "YES" ? Outcome.YES : Outcome.NO;
  return writeSettlementReport(runtime, marketId, outcome, verdict.reason, reportPrefix);
}

// ================================================================
// │        Log Trigger 1: SettlementRequested                    │
// ================================================================

function onSettlementRequested(runtime: Runtime<Config>, log: EVMLog): string {
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("Wraith CRE: Settlement Requested");

  const topics = log.topics.map((t) => bytesToHex(t)) as [`0x${string}`, ...`0x${string}`[]];
  const decoded = decodeEventLog({
    abi: SETTLEMENT_REQUESTED_ABI,
    data: bytesToHex(log.data),
    topics,
  });
  const marketId = decoded.args.marketId as bigint;
  runtime.log(`Market ID: ${marketId}`);

  // Read full market from chain
  runtime.log("[Step 1] Reading market from chain...");
  const market = readMarket(runtime, marketId);
  const { resolutionType, source, endpoint, field, condition, resolutionPrompt } = market.config;
  runtime.log(`[Step 1] Question: "${market.question}"`);
  runtime.log(`[Step 1] Resolution type: ${resolutionType}`);

  let txHash: string;

  switch (resolutionType) {
    case ResolutionType.PRICE_FEED:
      txHash = settlePriceFeed(runtime, marketId, source, condition, market.question);
      break;

    case ResolutionType.API_POLL:
      txHash = settleApiPoll(runtime, marketId, source, endpoint, field, condition);
      break;

    case ResolutionType.AI_VERDICT:
      txHash = settleAiVerdict(runtime, marketId, market.question, resolutionPrompt, source, "0x01");
      break;

    default:
      throw new Error(`Unexpected resolution type ${resolutionType} — OPTIMISTIC markets use proposeOutcome()`);
  }

  runtime.log(`Settled: ${txHash}`);
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return `Settled market ${marketId}: ${txHash}`;
}

// ================================================================
// │        Log Trigger 2: DisputeEscalated                       │
// ================================================================

function onDisputeEscalated(runtime: Runtime<Config>, log: EVMLog): string {
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("Wraith CRE: Dispute Escalated — running AI_VERDICT");

  const topics = log.topics.map((t) => bytesToHex(t)) as [`0x${string}`, ...`0x${string}`[]];
  const decoded = decodeEventLog({
    abi: DISPUTE_ESCALATED_ABI,
    data: bytesToHex(log.data),
    topics,
  });
  const marketId = decoded.args.marketId as bigint;
  runtime.log(`Market ID: ${marketId}`);

  runtime.log("[Step 1] Reading disputed market from chain...");
  const market = readMarket(runtime, marketId);
  runtime.log(`[Step 1] Question: "${market.question}"`);

  // Disputed OPTIMISTIC markets escalate to AI_VERDICT via OpenAI
  // Use the market question as the resolution prompt if none is stored
  const resolutionPrompt =
    market.config.resolutionPrompt ||
    `Based on available evidence, has the following occurred? "${market.question}" Answer YES or NO.`;

  const txHash = settleAiVerdict(
    runtime,
    marketId,
    market.question,
    resolutionPrompt,
    market.config.source,
    "0x02" // routes to _settleDispute in MarketFactory
  );

  runtime.log(`Dispute settled: ${txHash}`);
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  return `Dispute settled for market ${marketId}: ${txHash}`;
}

// ================================================================
// │                      Workflow Init                           │
// ================================================================

const initWorkflow = (config: Config) => {
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: config.evms[0].chainSelectorName,
    isTestnet: true,
  });

  if (!network) throw new Error(`Unknown chain: ${config.evms[0].chainSelectorName}`);

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);
  const factoryAddress = config.evms[0].marketFactoryAddress;

  const settlementHash = keccak256(toHex("SettlementRequested(uint256)"));
  const disputeHash    = keccak256(toHex("DisputeEscalated(uint256)"));

  return [
    // Handle settlement requests (PRICE_FEED, API_POLL, AI_VERDICT)
    cre.handler(
      evmClient.logTrigger({
        addresses: [factoryAddress],
        topics: [{ values: [settlementHash] }],
        confidence: "CONFIDENCE_LEVEL_FINALIZED",
      }),
      onSettlementRequested
    ),
    // Handle disputed OPTIMISTIC markets
    cre.handler(
      evmClient.logTrigger({
        addresses: [factoryAddress],
        topics: [{ values: [disputeHash] }],
        confidence: "CONFIDENCE_LEVEL_FINALIZED",
      }),
      onDisputeEscalated
    ),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main();
