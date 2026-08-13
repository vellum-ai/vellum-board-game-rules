import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import { listEditions, searchCorpus } from "../src/search.ts";

export default {
  description:
    "Search the local, versioned Wingspan rules reference corpus. Returns concise original paraphrases or official metadata with source URL, corpus version, rights status, and edition scope. It does not contain full rulebook text. Use edition_id when a printing or expansion matters; use live lookup as a fallback when the local corpus does not answer the question.",
  defaultRiskLevel: "low" as const,
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Rule, FAQ topic, component, birdfeeder, Automa, expansion, or other Wingspan concept to search for. Empty query lists the corpus entries.",
      },
      edition_id: {
        type: "string",
        description: "Optional edition filter, for example base-en-current-printing, european-expansion-en, or oceania-expansion-en.",
      },
      topic: {
        type: "string",
        description: "Optional exact topic filter, for example food, setup, automa, migration, or expansions.",
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
          ? "No local match. Consult the official Stonemaier Rules & FAQ page and verify the relevant edition before answering."
          : "Local matches found. Use live lookup if the question concerns a newer printing, an expansion not represented here, or exact rulebook/card wording.",
        url: "https://stonemaiergames.com/games/wingspan/rules/",
      },
    };

    return { content: JSON.stringify(payload, null, 2), isError: false };
  },
};
