import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import { askRules } from "../src/retrieve.ts";
import { getSitting, updateSitting } from "../src/sitting.ts";

export default {
  description:
    "Answer a board-game rules question from the installed corpora, or abstain. Always returns game and edition identity, corpus version, citations, rights flags, and an explicit abstention field. Do not invent a ruling when abstention is true. When this conversation has an active sitting (boardgame_start_sitting), the sitting's game is the default, the result may carry analog_hooks mapping the ruling to games the table already knows, and the cited ruling is recorded on the sitting. Cite first; analogize only from a returned hook.",
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
        description: "Optional game id or exact title. Defaults to the first installed game (currently wingspan).",
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

    const result = askRules({
      query,
      gameId,
      editionId,
      limit,
      knownGames: sitting?.known_games,
    });

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

    return { content: JSON.stringify(result, null, 2), isError: false };
  },
};
