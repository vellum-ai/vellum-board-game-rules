import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import { checkScenario } from "../src/scenario.ts";

export default {
  description:
    "Answer a 'did I do this right?' scenario question by returning matching worked examples from the installed corpora. Filters retrieval to entries that carry a pre-authored worked example (scenario + expected outcome + step decomposition). Hard-abstains when no worked example clears the match threshold — this tool never invents an outcome. Use boardgame_ask_rules for general rule questions.",
  defaultRiskLevel: "low" as const,
  input_schema: {
    type: "object",
    properties: {
      scenario: {
        type: "string",
        description:
          "Natural-language description of the scenario to check. Example: 4-card hand of J-5-5-5, starter is the fourth 5 matching the Jack's suit — counting set J-5-5-5-5.",
      },
      game_id: {
        type: "string",
        description: "Optional game id or exact title. When omitted, resolves to the plugin's default game (currently wingspan). Pass this explicitly whenever the user names a game.",
      },
      edition_id: {
        type: "string",
        description: "Optional edition filter, for example two-player-standard-en.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 5,
        default: 3,
        description: "Maximum worked-example matches to return. Defaults to 3.",
      },
    },
    required: ["scenario"],
    additionalProperties: false,
  },
  async execute(input: Record<string, unknown>, _ctx: ToolContext): Promise<ToolExecutionResult> {
    const scenario = String(input.scenario ?? "");
    const gameId = input.game_id == null ? undefined : String(input.game_id).trim();
    const editionId = input.edition_id == null ? undefined : String(input.edition_id).trim();
    const limit = input.limit == null ? 3 : Number(input.limit);

    if (!Number.isInteger(limit) || limit < 1 || limit > 5) {
      return { content: "Error: limit must be an integer from 1 to 5.", isError: true };
    }

    const result = checkScenario({ scenario, gameId, editionId, limit });
    return { content: JSON.stringify(result, null, 2), isError: false };
  },
};
