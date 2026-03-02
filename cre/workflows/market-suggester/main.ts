// wraith/cre/workflows/market-suggester/main.ts
//
// HTTP-triggered workflow.
// Flow:
//   1. Fetch trending posts from Reddit
//   2. Send to Claude — generate a prediction market question + resolution config
//   3. ABI-encode as 0x00 report → write to MarketFactory.onReport()
//
// Trigger: POST to the CRE workflow endpoint (can be called by a keeper or cron)

import {
  cre,
  Runner,
  ok,
  consensusIdenticalAggregation,
  getNetwork,
  hexToBase64,
  TxStatus,
  decodeJson,
  type Runtime,
  type HTTPPayload,
  type HTTPSendRequester,
} from "@chainlink/cre-sdk";
import { encodeAbiParameters, parseAbiParameters } from "viem";

// ================================================================
// │                           Types                              │
// ================================================================

type Config = {
  claudeModel: string;
  reddit: {
    subreddit: string;
    postLimit: number;
  };
  marketDeadlineDays: number;
  evms: Array<{
    marketFactoryAddress: string;
    chainSelectorName: string;
    gasLimit: string;
  }>;
};

interface RedditPost {
  title: string;
  score: number;
  num_comments: number;
}

interface RedditApiResponse {
  data: {
    children: Array<{
      data: RedditPost;
    }>;
  };
}

interface MarketSuggestion {
  question: string;
  resolutionType: number; // 0=PRICE_FEED 1=API_POLL 2=AI_VERDICT 3=OPTIMISTIC
  source: string;
  endpoint: string;
  field: string;
  condition: string;
  resolutionPrompt: string;
  deadline: number; // unix timestamp
}

interface ClaudeResponse {
  content: Array<{ type: string; text: string }>;
}

// ================================================================
// │                      System Prompt                           │
// ================================================================

const SYSTEM_PROMPT = `You are a prediction market question generator for Wraith, a private on-chain prediction market protocol.

Given trending Reddit posts, generate ONE high-quality prediction market question.

OUTPUT FORMAT (CRITICAL):
Respond with a single minified JSON object — no markdown, no backticks, no prose:
{"question":"...","resolutionType":2,"source":"...","endpoint":"","field":"","condition":"","resolutionPrompt":"...","deadline":0}

FIELD RULES:
- question: Binary YES/NO question, specific and objectively verifiable. E.g. "Will ETH exceed $5000 by March 30 2026?"
- resolutionType: 0=PRICE_FEED (crypto prices), 1=API_POLL (measurable metrics), 2=AI_VERDICT (news events)
- source:
    PRICE_FEED → Chainlink feed address on Arbitrum Sepolia (e.g. "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612" for ETH/USD)
    API_POLL   → API base URL (e.g. "https://api.coingecko.com")
    AI_VERDICT → Comma-separated news domains (e.g. "reuters.com,bloomberg.com,coindesk.com")
- endpoint: API_POLL only — path (e.g. "/api/v3/simple/price?ids=ethereum&vs_currencies=usd")
- field: API_POLL only — dot-notation JSON path (e.g. "ethereum.usd")
- condition: PRICE_FEED/API_POLL only — comparison string (e.g. ">= 5000")
- resolutionPrompt: AI_VERDICT only — exact prompt for Claude at settlement time
- deadline: leave as 0 — will be replaced with the correct timestamp

QUALITY RULES:
- Questions must be clearly answerable YES or NO
- Avoid questions about prices unless using PRICE_FEED
- Prefer AI_VERDICT for regulatory events, project launches, exchange listings
- resolutionPrompt must be unambiguous and specify the exact condition`;

// ================================================================
// │                     Reddit Fetcher                           │
// ================================================================

function fetchRedditTrends(runtime: Runtime<Config>): RedditPost[] {
  const httpClient = new cre.capabilities.HTTPClient();

  return httpClient
    .sendRequest(
      runtime,
      (sendRequester: HTTPSendRequester, config: Config): RedditPost[] => {
        const url = `https://www.reddit.com/r/${config.reddit.subreddit}/hot.json?limit=${config.reddit.postLimit}`;

        const resp = sendRequester
          .sendRequest({
            url,
            method: "GET",
            headers: { "User-Agent": "Wraith-CRE/1.0" },
            cacheSettings: { store: true, maxAge: "300s" },
          })
          .result();

        if (!ok(resp)) {
          throw new Error(`Reddit API error: ${resp.statusCode}`);
        }

        const body = new TextDecoder().decode(resp.body);
        const data = JSON.parse(body) as RedditApiResponse;

        return data.data.children.map((child) => ({
          title: child.data.title,
          score: child.data.score,
          num_comments: child.data.num_comments,
        }));
      },
      consensusIdenticalAggregation<RedditPost[]>()
    )(runtime.config)
    .result();
}

// ================================================================
// │                      Claude Caller                           │
// ================================================================

function askClaude(runtime: Runtime<Config>, posts: RedditPost[]): MarketSuggestion {
  const httpClient = new cre.capabilities.HTTPClient();
  const apiKey = runtime.getSecret({ id: "ANTHROPIC_API_KEY" }).result();

  const postsText = posts
    .map((p, i) => `${i + 1}. "${p.title}" (${p.score} upvotes, ${p.num_comments} comments)`)
    .join("\n");

  const userMessage = `Here are the top trending posts from r/CryptoCurrency right now:\n\n${postsText}\n\nGenerate a prediction market question based on the most interesting trend. Set deadline to 0 — it will be calculated automatically.`;

  return httpClient
    .sendRequest(
      runtime,
      (sendRequester: HTTPSendRequester, config: Config): MarketSuggestion => {
        const body = new TextEncoder().encode(
          JSON.stringify({
            model: config.claudeModel,
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userMessage }],
          })
        );

        const resp = sendRequester
          .sendRequest({
            url: "https://api.anthropic.com/v1/messages",
            method: "POST",
            body: Buffer.from(body).toString("base64"),
            headers: {
              "content-type": "application/json",
              "x-api-key": apiKey.value,
              "anthropic-version": "2023-06-01",
            },
          })
          .result();

        if (!ok(resp)) {
          const errBody = new TextDecoder().decode(resp.body);
          throw new Error(`Claude API error: ${resp.statusCode} - ${errBody}`);
        }

        const responseText = new TextDecoder().decode(resp.body);
        const claudeResponse = JSON.parse(responseText) as ClaudeResponse;
        const text = claudeResponse.content[0]?.text;

        if (!text) throw new Error("Claude returned empty response");

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error(`Could not find JSON in Claude response: ${text}`);

        return JSON.parse(jsonMatch[0]) as MarketSuggestion;
      },
      consensusIdenticalAggregation<MarketSuggestion>()
    )(runtime.config)
    .result();
}

// ================================================================
// │                     HTTP Trigger Handler                     │
// ================================================================

export function onHttpTrigger(runtime: Runtime<Config>, _payload: HTTPPayload): string {
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("Wraith CRE: Market Suggester");
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const evmConfig = runtime.config.evms[0];

  // Step 1: Fetch Reddit trends
  runtime.log("[Step 1] Fetching trending posts from Reddit...");
  const posts = fetchRedditTrends(runtime);
  runtime.log(`[Step 1] Fetched ${posts.length} trending posts`);

  // Step 2: Ask Claude to generate a market question
  runtime.log("[Step 2] Asking Claude to generate market question...");
  const suggestion = askClaude(runtime, posts);
  runtime.log(`[Step 2] Question: "${suggestion.question}"`);
  runtime.log(`[Step 2] Resolution type: ${suggestion.resolutionType}`);

  // Step 3: Calculate deadline
  const deadline =
    Math.floor(Date.now() / 1000) + runtime.config.marketDeadlineDays * 24 * 60 * 60;
  suggestion.deadline = deadline;
  runtime.log(`[Step 3] Deadline: ${new Date(deadline * 1000).toISOString()}`);

  // Step 4: ABI-encode the market creation report
  // Matches MarketFactory._createMarketFromCRE() decode:
  // abi.decode(payload, (string, uint8, string, string, string, string, string, uint256))
  runtime.log("[Step 4] Encoding market creation report...");
  const encoded = encodeAbiParameters(
    parseAbiParameters("string, uint8, string, string, string, string, string, uint256"),
    [
      suggestion.question,
      suggestion.resolutionType,
      suggestion.source,
      suggestion.endpoint,
      suggestion.field,
      suggestion.condition,
      suggestion.resolutionPrompt,
      BigInt(deadline),
    ]
  );

  // Prefix 0x00 → _createMarketFromCRE route in MarketFactory._processReport()
  const reportData = ("0x00" + encoded.slice(2)) as `0x${string}`;

  // Step 5: Get network and write to chain
  runtime.log("[Step 5] Writing market to MarketFactory...");
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmConfig.chainSelectorName,
    isTestnet: true,
  });

  if (!network) throw new Error(`Unknown chain: ${evmConfig.chainSelectorName}`);

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

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

  const txHash = Buffer.from(writeResult.txHash || new Uint8Array(32)).toString("hex");
  runtime.log(`[Step 5] Market created: 0x${txHash}`);
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return `Market created: 0x${txHash}`;
}

// ================================================================
// │                       Workflow Init                          │
// ================================================================

const initWorkflow = (config: Config) => {
  const httpCapability = new cre.capabilities.HTTPCapability();
  const httpTrigger = httpCapability.trigger({});

  return [cre.handler(httpTrigger, onHttpTrigger)];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main();
