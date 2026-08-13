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
    if (!block || typeof block !== "object") continue;
    const b = block as { type?: string; content?: unknown };
    if (b.type !== "web_search_tool_result" || !Array.isArray(b.content)) continue;
    for (const item of b.content) {
      if (!item || typeof item !== "object") continue;
      const r = item as { type?: string; url?: string; title?: string };
      if (r.type === "web_search_result" && typeof r.url === "string" && !seen.has(r.url)) {
        seen.add(r.url);
        sources.push({ url: r.url, ...(r.title ? { title: r.title } : {}) });
        if (sources.length >= MAX_SOURCES) return sources;
      }
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
    const provider = (await getConfiguredProvider("inference")) as {
      sendMessage?: (
        messages: unknown[],
        options?: Record<string, unknown>,
      ) => Promise<{ content?: unknown[] }>;
    } | null;
    if (!provider?.sendMessage) {
      return unavailable("Web fallback unavailable: no inference provider is configured.");
    }

    const prompt =
      `Search the web to answer this board-game question about ${options.gameTitle}: ` +
      `"${options.query}". Reply with a short factual answer (a few sentences), ` +
      `mention which sources say so, and note any printing/edition caveats. ` +
      `If the search is inconclusive, say so plainly.`;

    const response = await provider.sendMessage(
      [{ role: "user", content: [{ type: "text", text: prompt }] }],
      {
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
      },
    );

    const content = Array.isArray(response?.content) ? response.content : [];
    const clientToolCall = content.some(
      (b) => (b as { type?: string })?.type === "tool_use",
    );
    const answer = content
      .filter((b): b is { type: "text"; text: string } => {
        const t = b as { type?: string; text?: unknown };
        return t.type === "text" && typeof t.text === "string";
      })
      .map((b) => b.text)
      .join("\n")
      .trim()
      .slice(0, MAX_ANSWER_CHARS);
    const sources = collectSources(content);

    if (clientToolCall || (!answer && sources.length === 0)) {
      return unavailable(
        "Web fallback unavailable: the configured provider does not support server-side web search.",
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
