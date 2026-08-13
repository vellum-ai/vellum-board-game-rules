import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import { askRules } from "../src/retrieve.ts";

export default {
  description:
    "Answer a board-game rules question from the installed corpora, or abstain. Always returns game and edition identity, corpus version, citations, rights flags, and an explicit abstention field. Do not invent a ruling when abstention is true. Currently installed games: Wingspan, Cribbage. Call boardgame_list_supported_games first if you are not certain the game is installed; pass game_id explicitly rather than relying on the default.",
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
        description: "Optional game id or exact title. When omitted, resolves to the plugin's default game (currently wingspan). Pass this explicitly whenever the user names a game.",
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
  async execute(input: Record<string, unknown>, _ctx: ToolContext): Promise<ToolExecutionResult> {
    const query = String(input.query ?? "");
    const gameId = input.game_id == null ? undefined : String(input.game_id).trim();
    const editionId = input.edition_id == null ? undefined : String(input.edition_id).trim();
    const limit = input.limit == null ? 5 : Number(input.limit);

    if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
      return { content: "Error: limit must be an integer from 1 to 10.", isError: true };
    }

    const result = askRules({ query, gameId, editionId, limit });
    return { content: JSON.stringify(result, null, 2), isError: false };
  },
};
