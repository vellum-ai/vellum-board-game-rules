import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import { listCorpora, searchCorpora } from "../src/search.ts";

export default {
  description: "Search separate original-interpretation corpora for the uploaded board games. Returns source-bounded summaries, coverage limits, edition scope, confidence, source locators, and rights flags. It does not contain rulebook text. Use live lookup for exact wording, cards, scenarios, newer printings, or uncovered questions.",
  defaultRiskLevel: "low" as const,
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Rule topic, setup, turn, timing, scoring, component, or other board-game concept." },
      game_id: { type: "string", description: "Optional corpus ID or exact game title." },
      edition_id: { type: "string", description: "Optional edition/document scope filter." },
      topic: { type: "string", description: "Optional exact topic filter." },
      limit: { type: "integer", minimum: 1, maximum: 25, default: 10, description: "Maximum results, up to 25." }
    },
    required: ["query"]
  },
  async execute(input: Record<string, unknown>, _ctx: ToolContext): Promise<ToolExecutionResult> {
    const query = String(input.query ?? "").trim();
    const gameId = input.game_id == null ? undefined : String(input.game_id).trim();
    const editionId = input.edition_id == null ? undefined : String(input.edition_id).trim();
    const topic = input.topic == null ? undefined : String(input.topic).trim();
    const limit = input.limit == null ? 10 : Number(input.limit);
    if (!query) return { content: JSON.stringify({ available_games: listCorpora(), error: "query is required" }, null, 2), isError: true };
    if (!Number.isInteger(limit) || limit < 1 || limit > 25) return { content: "Error: limit must be an integer from 1 to 25.", isError: true };
    return { content: JSON.stringify(searchCorpora({ query, gameId, editionId, topic, limit }), null, 2), isError: false };
  }
};
