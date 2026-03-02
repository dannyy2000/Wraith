// wraith/cre/workflows/settlement/openai.ts
//
// OpenAI helper for AI_VERDICT resolution.
// Fetches news articles from configured sources, sends to OpenAI,
// returns a structured YES/NO verdict with reasoning.

import {
  cre,
  ok,
  consensusIdenticalAggregation,
  type Runtime,
  type HTTPSendRequester,
} from "@chainlink/cre-sdk";

type Config = {
  openaiModel: string;
  evms: Array<{
    marketFactoryAddress: string;
    chainSelectorName: string;
    gasLimit: string;
  }>;
};

interface NewsArticle {
  title: string;
  description: string;
  publishedAt: string;
}

interface NewsApiResponse {
  articles: NewsArticle[];
}

interface OpenAIResponse {
  choices: Array<{ message: { content: string } }>;
}

export interface Verdict {
  verdict: "YES" | "NO";
  reason: string;
}

const SETTLEMENT_SYSTEM_PROMPT = `You are a prediction market resolver for Wraith protocol.

Your job: determine whether a prediction market question has resolved YES or NO.

RESPONSE FORMAT (CRITICAL):
Respond with ONLY this minified JSON — no markdown, no prose, no backticks:
{"verdict":"YES","reason":"One sentence explaining your decision based on facts."}

RULES:
- Base your verdict ONLY on the provided articles and verifiable facts
- If evidence is insufficient or conflicting, default to NO
- The "reason" must be a single sentence referencing specific evidence
- Do not speculate beyond what the articles state`;

// ================================================================
// │                    Fetch News Articles                       │
// ================================================================

function fetchNewsArticles(
  runtime: Runtime<Config>,
  sources: string[],
  query: string
): string {
  const httpClient = new cre.capabilities.HTTPClient();
  const newsApiKey = runtime.getSecret({ id: "NEWS_API_KEY" }).result();

  return httpClient
    .sendRequest(
      runtime,
      (sendRequester: HTTPSendRequester, _config: Config): string => {
        const sourcesParam = sources.join(",");
        const encodedQuery = encodeURIComponent(query.slice(0, 100));
        const url = `https://newsapi.org/v2/everything?q=${encodedQuery}&sources=${sourcesParam}&sortBy=publishedAt&pageSize=5&apiKey=${newsApiKey.value}`;

        const resp = sendRequester
          .sendRequest({
            url,
            method: "GET",
            cacheSettings: { store: true, maxAge: "300s" },
          })
          .result();

        if (!ok(resp)) {
          runtime.log(`[News] API error ${resp.statusCode} — proceeding with OpenAI knowledge only`);
          return "";
        }

        const body = new TextDecoder().decode(resp.body);
        const data = JSON.parse(body) as NewsApiResponse;

        if (!data.articles?.length) {
          runtime.log("[News] No articles found");
          return "";
        }

        return data.articles
          .map(
            (a, i) =>
              `Article ${i + 1} (${a.publishedAt.slice(0, 10)}):\n${a.title}\n${a.description ?? ""}`
          )
          .join("\n\n---\n\n");
      },
      consensusIdenticalAggregation<string>()
    )(runtime.config)
    .result();
}

// ================================================================
// │                      Ask OpenAI                              │
// ================================================================

export function getAiVerdict(
  runtime: Runtime<Config>,
  question: string,
  resolutionPrompt: string,
  sources: string[]
): Verdict {
  runtime.log("[OpenAI] Fetching news articles...");
  const articles = fetchNewsArticles(runtime, sources, question);

  const userContent = articles
    ? `${resolutionPrompt}\n\nHere are relevant news articles:\n\n${articles}`
    : `${resolutionPrompt}\n\n(No recent articles found — use your knowledge to answer.)`;

  runtime.log("[OpenAI] Requesting AI verdict...");

  const httpClient = new cre.capabilities.HTTPClient();
  const apiKey = runtime.getSecret({ id: "OPENAI_API_KEY" }).result();

  return httpClient
    .sendRequest(
      runtime,
      (sendRequester: HTTPSendRequester, config: Config): Verdict => {
        const body = new TextEncoder().encode(
          JSON.stringify({
            model: config.openaiModel,
            max_tokens: 512,
            messages: [
              { role: "system", content: SETTLEMENT_SYSTEM_PROMPT },
              { role: "user", content: userContent },
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

        const jsonMatch = text.match(/\{[\s\S]*"verdict"[\s\S]*"reason"[\s\S]*\}/);
        if (!jsonMatch) throw new Error(`No JSON in OpenAI response: ${text}`);

        const parsed = JSON.parse(jsonMatch[0]) as Verdict;
        if (!["YES", "NO"].includes(parsed.verdict)) {
          throw new Error(`Invalid verdict: ${parsed.verdict}`);
        }

        return parsed;
      },
      consensusIdenticalAggregation<Verdict>()
    )(runtime.config)
    .result();
}
