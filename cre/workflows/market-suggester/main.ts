// wraith/cre/workflows/market-suggester/main.ts
//
// HTTP-triggered workflow.
// Flow:
//   1. Fetch trending posts from r/CryptoCurrency
//   2. Send to OpenAI — generate a prediction market question + resolution config
//   3. Return the suggestion as JSON — nothing is written to chain
//
// The frontend receives the suggestion, displays it to the creator for review.
// If the creator accepts, they call createMarket() themselves and stake a bond.
// This keeps humans in the loop for market creation.
//
// Trigger: POST to the CRE workflow endpoint

import {
  cre,
  Runner,
  ok,
  consensusIdenticalAggregation,
  decodeJson,
  type Runtime,
  type HTTPPayload,
  type HTTPSendRequester,
} from "@chainlink/cre-sdk";

// ================================================================
// │                           Types                              │
// ================================================================

type Config = {
  openaiModel: string;
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

// What CRE returns to the frontend — the frontend uses this to populate
// the createMarket() call once the creator approves
export interface MarketSuggestion {
  question: string;
  resolutionType: number; // 0=PRICE_FEED 1=API_POLL 2=AI_VERDICT
  source: string;
  endpoint: string;
  field: string;
  condition: string;
  resolutionPrompt: string;
  deadlineTimestamp: number; // unix timestamp, calculated from marketDeadlineDays
  redditSource: string;      // the subreddit post title that inspired this
}

interface OpenAIResponse {
  choices: Array<{ message: { content: string } }>;
}

// ================================================================
// │                      System Prompt                           │
// ================================================================

const SYSTEM_PROMPT = `You are a prediction market question generator for Wraith, a private on-chain prediction market protocol.

Given trending Reddit posts, generate ONE high-quality prediction market question.

OUTPUT FORMAT (CRITICAL):
Respond with a single minified JSON object — no markdown, no backticks, no prose:
{"question":"...","resolutionType":2,"source":"...","endpoint":"","field":"","condition":"","resolutionPrompt":"...","redditSource":"..."}

FIELD RULES:
- question: Binary YES/NO question, specific and objectively verifiable
- resolutionType: 0=PRICE_FEED (crypto prices only), 1=API_POLL (measurable metrics), 2=AI_VERDICT (news/regulatory events)
- source:
    PRICE_FEED → Chainlink feed address on Arbitrum Sepolia
    API_POLL   → API base URL (e.g. "https://api.coingecko.com")
    AI_VERDICT → Comma-separated news domains (e.g. "reuters.com,coindesk.com")
- endpoint: API_POLL only — full path with query params
- field: API_POLL only — dot-notation JSON path (e.g. "ethereum.usd")
- condition: PRICE_FEED/API_POLL only — comparison operator + value (e.g. ">= 5000")
- resolutionPrompt: AI_VERDICT only — exact prompt OpenAI will receive at settlement
- redditSource: the post title that inspired this question

QUALITY RULES:
- Questions must be clearly answerable YES or NO by a specific deadline
- Prefer AI_VERDICT for regulatory events, product launches, exchange listings
- resolutionPrompt must specify the exact condition and be unambiguous`;

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
// │                      OpenAI Caller                           │
// ================================================================

function generateSuggestion(
  runtime: Runtime<Config>,
  posts: RedditPost[]
): Omit<MarketSuggestion, "deadlineTimestamp"> {
  const httpClient = new cre.capabilities.HTTPClient();
  const apiKey = runtime.getSecret({ id: "OPENAI_API_KEY" }).result();

  const postsText = posts
    .map((p, i) => `${i + 1}. "${p.title}" (${p.score} upvotes, ${p.num_comments} comments)`)
    .join("\n");

  const userMessage = `Here are the top trending posts from r/CryptoCurrency right now:\n\n${postsText}\n\nGenerate one prediction market question from the most interesting trend.`;

  return httpClient
    .sendRequest(
      runtime,
      (
        sendRequester: HTTPSendRequester,
        config: Config
      ): Omit<MarketSuggestion, "deadlineTimestamp"> => {
        const body = new TextEncoder().encode(
          JSON.stringify({
            model: config.openaiModel,
            max_tokens: 1024,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userMessage },
            ],
          })
        );

        const resp = sendRequester
          .sendRequest({
            url: "https://api.openai.com/v1/chat/completions",
            method: "POST",
            body: Buffer.from(body).toString("base64"),
            headers: {
              "content-type": "application/json",
              "authorization": `Bearer ${apiKey.value}`,
            },
          })
          .result();

        if (!ok(resp)) {
          const errBody = new TextDecoder().decode(resp.body);
          throw new Error(`OpenAI API error: ${resp.statusCode} - ${errBody}`);
        }

        const responseText = new TextDecoder().decode(resp.body);
        const openaiResponse = JSON.parse(responseText) as OpenAIResponse;
        const text = openaiResponse.choices[0]?.message?.content;

        if (!text) throw new Error("OpenAI returned empty response");

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error(`No JSON in OpenAI response: ${text}`);

        return JSON.parse(jsonMatch[0]) as Omit<MarketSuggestion, "deadlineTimestamp">;
      },
      consensusIdenticalAggregation<Omit<MarketSuggestion, "deadlineTimestamp">>()
    )(runtime.config)
    .result();
}

// ================================================================
// │                   HTTP Trigger Handler                       │
// ================================================================

function onHttpTrigger(runtime: Runtime<Config>, _payload: HTTPPayload): string {
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("Wraith CRE: Market Suggester");
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Step 1: Fetch Reddit trends
  runtime.log("[Step 1] Fetching trending posts from Reddit...");
  const posts = fetchRedditTrends(runtime);
  runtime.log(`[Step 1] Fetched ${posts.length} trending posts`);

  // Step 2: Ask OpenAI to generate a market question
  runtime.log("[Step 2] Asking OpenAI to generate market suggestion...");
  const raw = generateSuggestion(runtime, posts);
  runtime.log(`[Step 2] Question: "${raw.question}"`);
  runtime.log(`[Step 2] Resolution type: ${raw.resolutionType}`);
  runtime.log(`[Step 2] Inspired by: "${raw.redditSource}"`);

  // Step 3: Calculate deadline and return to frontend — nothing written to chain
  const deadlineTimestamp =
    Math.floor(Date.now() / 1000) + runtime.config.marketDeadlineDays * 24 * 60 * 60;

  const suggestion: MarketSuggestion = { ...raw, deadlineTimestamp };

  runtime.log("[Step 3] Returning suggestion to frontend for creator review");
  runtime.log("         Creator must approve and call createMarket() to deploy");
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Return JSON — CRE sends this as the HTTP response body back to the caller
  return JSON.stringify(suggestion);
}

// ================================================================
// │                      Workflow Init                           │
// ================================================================

const initWorkflow = (_config: Config) => {
  const httpCapability = new cre.capabilities.HTTPCapability();
  const httpTrigger = httpCapability.trigger({
    authorizedKeys: [
      {
        type: "KEY_TYPE_ECDSA_EVM",
        publicKey: "0x02AF376f613938A58c9567128E82bf3536a76F27",
      },
    ],
  });
  return [cre.handler(httpTrigger, onHttpTrigger)];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

main();
