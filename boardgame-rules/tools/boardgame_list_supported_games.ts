import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import { listSupportedGames } from "../src/corpus.ts";

export default {
  description:
    "List installed board games, editions, coverage limits, and corpus versions. Use this before asking a rules question so you know which games and editions are actually supported.",
  defaultRiskLevel: "low" as const,
  input_schema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  async execute(_input: Record<string, unknown>, _ctx: ToolContext): Promise<ToolExecutionResult> {
    const games = listSupportedGames();
    return {
      content: JSON.stringify(
        {
          games,
          count: games.length,
          note: "Only listed games can be answered. Unlisted games must be refused.",
        },
        null,
        2,
      ),
      isError: false,
    };
  },
};
