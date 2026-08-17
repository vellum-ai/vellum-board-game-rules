/**
 * Live web-search fallback for coverage abstentions.
 *
 * When the corpus abstains because a question is outside its coverage (setup
 * detail it lacks, strategy, later printings), the table previously had to
 * wait for a second turn while the assistant pivoted to its own web_search
 * tool. This module lets boardgame_ask_rules run that search inline and
 * return the results in the same payload.
 *
 * Mechanism: the plugin runs a small bounded inference call through the
 * host's configured provider (`getConfiguredProvider("inference")` from
 * @vellumai/plugin-api) with a tool named `web_search` declared — providers
 * with native server-side search (Anthropic) map that to their web-search
 * server tool and return text plus `web_search_tool_result` blocks.
 *
 * Fail-open by design: outside the daemon (eval harness), on providers
 * without native search, on timeout, or on any error, the caller gets
 * `{ attempted: true, used: false, note }` and the plain abstention stands.
 *
 * Invariants preserved: `abstention` stays true, `analog_hooks` stay empty,
 * and every fallback payload carries a disclaimer — web results are table
 * guidance, never a corpus-cited ruling.
 */

import type { WebFallback, WebFallbackSource } from "./types.ts";

export const WEB_FALLBACK_DISCLAIMER =
  "Live web results, not corpus-backed. The corpus abstained on this question; treat these as unverified pointers, never as a cited ruling.";

const TIMEOUT_MS = 20_000;
const MAX_ANSWER_CHARS = 2_000;
const MAX_SOURCES = 8;
const MAX_QUERY_CHARS = 300;

/** Narrowing guard: a non-null object record, without runtime-boundary casts. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function blockType(block: unknown): string | null {
  return isRecord(block) && typeof block.type === "string" ? block.type : null;
}

function unavailable(note: string): WebFallback {
  return {
    attempted: true,
    used: false,
    note,
    answer: null,
    sources: [],
    disclaimer: WEB_FALLBACK_DISCLAIMER,
  };
}

function collectSources(content: unknown[]): WebFallbackSource[] {
  const sources: WebFallbackSource[] = [];
  const seen = new Set<string>();
  for (const block of content) {
    if (blockType(block) !== "web_search_tool_result" || !isRecord(block)) continue;
    const inner = block.content;
    if (!Array.isArray(inner)) continue;
    for (const item of inner) {
      if (blockType(item) !== "web_search_result" || !isRecord(item)) continue;
      const url = item.url;
      if (typeof url !== "string" || seen.has(url)) continue;
      seen.add(url);
      const title = typeof item.title === "string" ? item.title : undefined;
      sources.push({ url, ...(title ? { title } : {}) });
      if (sources.length >= MAX_SOURCES) return sources;
    }
  }
  return sources;
}

/**
 * Run the fallback search. Never throws.
 */
export async function webFallbackSearch(options: {
  gameTitle: string;
  query: string;
}): Promise<WebFallback> {
  let api: Record<string, unknown>;
  try {
    api = (await import("@vellumai/plugin-api")) as Record<string, unknown>;
  } catch {
    return unavailable(
      "Web fallback is unavailable outside the assistant runtime (plugin API not loadable).",
    );
  }

  const getConfiguredProvider = api.getConfiguredProvider;
  if (typeof getConfiguredProvider !== "function") {
    return unavailable("Web fallback unavailable: host plugin API does not expose getConfiguredProvider.");
  }

  try {
    const providerRaw: unknown = await getConfiguredProvider("inference");
    if (!isRecord(providerRaw) || typeof providerRaw.sendMessage !== "function") {
      return unavailable("Web fallback unavailable: no inference provider is configured.");
    }
    const sendMessage = providerRaw.sendMessage.bind(providerRaw) as (
      messages: unknown[],
      options?: Record<string, unknown>,
    ) => Promise<unknown>;

    // Bound and flatten the interpolated user text: the query is the user's
    // own question relayed on their behalf, but it must not be able to smuggle
    // multi-line prompt structure or unbounded content into the search prompt.
    const boundedQuery = options.query.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_CHARS);

    const prompt =
      `Search the web to answer this board-game question about ${options.gameTitle}: ` +
      `"${boundedQuery}". Reply with a short factual answer (a few sentences), ` +
      `mention which sources say so, and note any printing/edition caveats. ` +
      `If the search is inconclusive, say so plainly.`;

    // Belt on top of the abort signal: signal is part of the typed
    // SendMessageOptions contract, but a provider that ignores mid-flight
    // aborts must still not hang the tool call.
    const raceTimeout = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), TIMEOUT_MS + 1_000).unref?.();
    });
    const response: unknown = await Promise.race([
      sendMessage([{ role: "user", content: [{ type: "text", text: prompt }] }], {
        systemPrompt:
          "You are a board-game rules researcher. Answer only from web search results; do not answer from memory. Be brief and cite which source supports each claim.",
        tools: [
          {
            name: "web_search",
            description: "Search the web for current information.",
            input_schema: {
              type: "object",
              properties: { query: { type: "string" } },
              required: ["query"],
            },
          },
        ],
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
      raceTimeout,
    ]);
    if (response === null) {
      return unavailable("Web fallback timed out; the plain abstention stands.");
    }

    const content: unknown[] =
      isRecord(response) && Array.isArray(response.content) ? response.content : [];
    const clientToolCall = content.some((b) => blockType(b) === "tool_use");
    const answer = content
      .flatMap((b) => {
        if (blockType(b) !== "text" || !isRecord(b)) return [];
        return typeof b.text === "string" ? [b.text] : [];
      })
      .join("\n")
      .trim()
      .slice(0, MAX_ANSWER_CHARS);
    const sources = collectSources(content);

    if (clientToolCall) {
      return unavailable(
        "Web fallback unavailable: the configured provider does not support server-side web search.",
      );
    }
    // Sources are the gate. Text without a single web_search_tool_result
    // means the model answered from memory while ignoring the search tool;
    // relaying that as "what the web says" would be exactly the fabrication
    // this feature must never produce. The plain abstention is strictly
    // better than an unverifiable answer at the table.
    if (sources.length === 0) {
      return unavailable(
        answer
          ? "Web fallback discarded a provider answer that carried no web sources (likely answered from memory)."
          : "Web fallback unavailable: the configured provider returned no web results.",
      );
    }

    return {
      attempted: true,
      used: true,
      note: "The corpus abstained; these are live web-search results returned in the same call.",
      answer: answer || null,
      sources,
      disclaimer: WEB_FALLBACK_DISCLAIMER,
    };
  } catch (error) {
    return unavailable(
      `Web fallback failed (${error instanceof Error ? error.message : String(error)}); the plain abstention stands.`,
    );
  }
}
