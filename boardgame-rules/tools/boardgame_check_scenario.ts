import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import { checkScenario } from "../src/scenario.ts";

export default {
  description:
    'Check whether a specific play situation matches a pre-authored worked example from the installed corpora — the "score validator" tool. Given a natural-language scenario ("4-card hand of J-5-5-5, starter is the fourth 5 matching the Jack\'s suit — counting set J-5-5-5-5, did I score 29?"), returns a matching worked example with its expected outcome and point-by-point decomposition. Hard-abstains when no worked example matches — this tool never falls back to general rules retrieval. For general "how does X work?" questions, use boardgame_ask_rules instead.',
  defaultRiskLevel: "low" as const,
  input_schema: {
    type: "object",
    properties: {
      scenario: {
        type: "string",
        description:
          'Natural-language description of the play situation to check. Example: "4-card hand of J-5-5-5, starter is the fourth 5 matching the Jack\'s suit — counting set J-5-5-5-5". Empty scenarios abstain.',
      },
      game_id: {
        type: "string",
        description:
          "Optional game id or exact title. Defaults to the first installed game that has at least one worked example.",
      },
      edition_id: {
        type: "string",
        description:
          "Optional edition filter, for example two-player-standard-en.",
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
  async execute(
    input: Record<string, unknown>,
    _ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    const scenario = String(input.scenario ?? "");
    const gameId = input.game_id == null ? undefined : String(input.game_id).trim();
    const editionId =
      input.edition_id == null ? undefined : String(input.edition_id).trim();
    const limit = input.limit == null ? 3 : Number(input.limit);

    if (!Number.isInteger(limit) || limit < 1 || limit > 5) {
      return {
        content: "Error: limit must be an integer from 1 to 5.",
        isError: true,
      };
    }

    const result = checkScenario({
      query: scenario,
      gameId,
      editionId,
      limit,
    });
    return { content: JSON.stringify(result, null, 2), isError: false };
  },
};
