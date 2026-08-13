import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import { listEditions, searchCorpus } from "../src/search.ts";

export default {
  description:
    "Search the local, versioned Cribbage rules reference corpus. Returns concise original paraphrases of rule atoms, scoring atoms, board mechanics, worked examples, and variant notes with source URL, corpus version, rights status, and edition scope. It does not contain full publisher rulebook text. Use edition_id to filter to the base game or to a specific variant (muggins-variant, shorter-61-en, skunk-rule-variant). Use live lookup as a fallback when the question concerns a multi-player form (three-hand, four-hand partnership) or a tournament-body clarification not represented here.",
  defaultRiskLevel: "low" as const,
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Rule, scoring, pegging, counting, crib, starter, muggins, skunk, board, or other Cribbage concept to search for. Empty query lists the corpus entries.",
      },
      edition_id: {
        type: "string",
        description: "Optional edition filter. One of: two-player-standard-en, muggins-variant, shorter-61-en, skunk-rule-variant.",
      },
      topic: {
        type: "string",
        description: "Optional exact topic filter, for example play, counting, pegging, crib, starter, flush, his-nobs, variant, or strategy.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 10,
        description: "Maximum number of matches to return. Defaults to 5.",
        default: 5,
      },
    },
    required: ["query"],
  },
  async execute(input: Record<string, unknown>, _ctx: ToolContext): Promise<ToolExecutionResult> {
    const query = String(input.query ?? "").trim();
    const editionId = input.edition_id == null ? undefined : String(input.edition_id).trim();
    const topic = input.topic == null ? undefined : String(input.topic).trim();
    const limit = input.limit == null ? 5 : Number(input.limit);

    if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
      return { content: "Error: limit must be an integer from 1 to 10.", isError: true };
    }
    if (editionId && !listEditions().some((edition) => edition.edition_id === editionId)) {
      return {
        content: `Error: unknown edition_id "${editionId}". Available edition IDs: ${listEditions().map((edition) => edition.edition_id).join(", ")}`,
        isError: true,
      };
    }

    const result = searchCorpus({ query, editionId, topic, limit });
    const payload = {
      ...result,
      query,
      filters: { edition_id: editionId ?? null, topic: topic ?? null, limit },
      fallback: {
        live_lookup_recommended: result.matches.length === 0,
        reason: result.matches.length === 0
          ? "No local match. Cribbage's core rules are stable and public domain; a general reference such as bicyclecards.com/how-to-play/cribbage or the American Cribbage Congress tournament rules can resolve edge cases."
          : "Local matches found. Use live lookup if the question concerns a multi-player form (three-hand, four-hand partnership, six-card, seven-card) or a specific tournament-body clarification not represented here.",
        url: "https://bicyclecards.com/how-to-play/cribbage",
      },
    };

    return { content: JSON.stringify(payload, null, 2), isError: false };
  },
};
