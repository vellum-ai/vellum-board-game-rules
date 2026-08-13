import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import { checkScenario } from "../src/scenario.ts";
import { getSitting } from "../src/sitting.ts";

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
          "Game id or exact title. Optional when a sitting is active (boardgame_start_sitting) — the sitting's game is used; with neither, the tool abstains and lists the games that have worked examples.",
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
    ctx: ToolContext,
  ): Promise<ToolExecutionResult> {
    const scenario = String(input.scenario ?? "");
    let gameId = input.game_id == null ? undefined : String(input.game_id).trim();
    let editionId =
      input.edition_id == null ? undefined : String(input.edition_id).trim();
    const limit = input.limit == null ? 3 : Number(input.limit);

    // Mid-game "did I score this right?" questions come from an active
    // sitting; like boardgame_ask_rules, the sitting supplies the game (and
    // edition, when the sitting pinned one) so the table never has to restate
    // it. checkScenario itself still abstains cleanly when neither exists.
    const sitting = getSitting(ctx.conversationId);
    if (sitting) {
      gameId ||= sitting.game_id;
      if (!editionId && gameId === sitting.game_id && sitting.edition_id) {
        editionId = sitting.edition_id;
      }
    }

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
