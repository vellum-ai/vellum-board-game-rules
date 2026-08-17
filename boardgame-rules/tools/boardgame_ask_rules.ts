import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import { webFallbackEnabled } from "../src/config.ts";
import { loadCorpus } from "../src/corpus.ts";
import { askRules } from "../src/retrieve.ts";
import { semanticScores } from "../src/semantic.ts";
import { getSitting, updateSitting } from "../src/sitting.ts";
import type { WebFallback } from "../src/types.ts";
import { WEB_FALLBACK_DISCLAIMER, webFallbackSearch } from "../src/web-fallback.ts";

/** Live searches an active sitting may spend; without a sitting each call stands alone. */
const WEB_FALLBACK_MAX_PER_SITTING = 5;

export default {
  description:
    "Answer a board-game rules question from the installed corpora, or abstain. Requires a game: pass game_id or have an active sitting — with neither, the tool abstains and lists the supported games. Returns game identity, corpus version, citations, rights flags, and an explicit abstention field; edition_id echoes the edition filter applied (null means all editions were in scope — read each ruling's own editions from evidence[].edition_ids). Filtering by an expansion edition also surfaces the base-edition rules it inherits. Do not invent a ruling when abstention is true. When this conversation has an active sitting (boardgame_start_sitting), the sitting's game is the default, the result may carry analog_hooks mapping the ruling to games the table already knows, and the cited ruling is recorded on the sitting. Cite first; analogize only from a returned hook. When the corpus abstains for lack of coverage (not for input errors), the result carries web_fallback: live web-search results fetched in the same call, clearly labeled as non-corpus guidance, so no second search turn is needed. abstention stays true in that case.",
  defaultRiskLevel: "low" as const,
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The rules question to answer. Empty queries abstain.",
      },
      game_id: {
        type: "string",
        description: "Game id or exact title (see boardgame_list_supported_games). Optional only when a sitting is active; otherwise omitting it abstains.",
      },
      edition_id: {
        type: "string",
        description: "Optional edition filter, for example base-en-1st-2020.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 10,
        default: 5,
        description: "Maximum evidence chunks to return. Defaults to 5.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  async execute(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolExecutionResult> {
    const query = String(input.query ?? "");
    let gameId = input.game_id == null ? undefined : String(input.game_id).trim();
    let editionId = input.edition_id == null ? undefined : String(input.edition_id).trim();
    const limit = input.limit == null ? 5 : Number(input.limit);

    if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
      return { content: "Error: limit must be an integer from 1 to 10.", isError: true };
    }

    // An active sitting supplies defaults ("wait, how do I play a bird?" mid-game
    // should not need the game restated) and the known-games filter for analogies.
    const sitting = getSitting(ctx.conversationId);
    if (sitting) {
      gameId ||= sitting.game_id;
      if (!editionId && gameId === sitting.game_id && sitting.edition_id) {
        editionId = sitting.edition_id;
      }
    }

    // Semantic similarity from the plugin's private index, when the host
    // provides one; empty (pure lexical) outside the daemon or on any error.
    // The index is keyed by canonical corpus_id, while game_id may be a
    // title ("Wingspan"), so resolve first or the lookup silently misses.
    const canonicalGameId = gameId ? loadCorpus(gameId)?.corpus_id : undefined;
    const semantic = canonicalGameId ? await semanticScores(canonicalGameId, query) : undefined;
    const result = askRules({
      query,
      gameId,
      editionId,
      limit,
      knownGames: sitting?.known_games,
      semanticScores: semantic,
    });

    // Coverage abstention: the corpus resolved the game and searched but
    // nothing matched. Fall back to a live web search inline so the table
    // doesn't wait for a second turn. Input-error abstentions (no game,
    // unknown game/edition, empty query) keep the plain abstention.
    // abstention stays true either way.
    //
    // Two gates keep the fallback from paying an inference round-trip on
    // every miss: (1) the query must be on-domain — a coverage abstention
    // with ZERO scored evidence means the question shares no vocabulary
    // with the game at all (off-domain or gibberish), and a web search on
    // it would not help the table; (2) an active sitting spends at most
    // WEB_FALLBACK_MAX_PER_SITTING searches, so a table that keeps asking
    // uncovered questions is bounded per night rather than per question.
    let webFallback: WebFallback | null = null;
    if (webFallbackEnabled() && result.abstention_kind === "coverage") {
      if (result.lexical_evidence_count === 0) {
        webFallback = {
          attempted: false,
          used: false,
          note: "Web fallback skipped: the question shares no vocabulary with this game's corpus, so it looks off-domain rather than uncovered.",
          answer: null,
          sources: [],
          disclaimer: WEB_FALLBACK_DISCLAIMER,
        };
      } else if (
        sitting &&
        (sitting.web_fallback_attempts ?? 0) >= WEB_FALLBACK_MAX_PER_SITTING
      ) {
        webFallback = {
          attempted: false,
          used: false,
          note: `Web fallback skipped: this sitting has used its ${WEB_FALLBACK_MAX_PER_SITTING} live searches. Ask the assistant to search directly if this one matters.`,
          answer: null,
          sources: [],
          disclaimer: WEB_FALLBACK_DISCLAIMER,
        };
      } else {
        if (sitting) {
          updateSitting({ conversationId: ctx.conversationId, countWebFallbackAttempt: true });
        }
        webFallback = await webFallbackSearch({
          gameTitle: result.game_title ?? gameId ?? "this board game",
          query,
        });
      }
    }

    // Record the cited ruling (and analog, when one was returned) on the
    // sitting so the next question picks up mid-game instead of restarting.
    if (sitting && !result.abstention && result.evidence.length > 0 && result.game_id === sitting.game_id) {
      const top = result.evidence[0];
      updateSitting({
        conversationId: ctx.conversationId,
        lastRuling: {
          entry_id: top.entry_id,
          title: top.title,
          locator: top.citation.locator,
        },
        lastAnalog: result.analog_hooks[0]
          ? { known_game_id: result.analog_hooks[0].known_game_id, entry_id: top.entry_id }
          : undefined,
      });
    }

    return {
      content: JSON.stringify({ ...result, web_fallback: webFallback }, null, 2),
      isError: false,
    };
  },
};
