import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import { loadCorpus } from "../src/corpus.ts";
import { getSitting, updateSitting } from "../src/sitting.ts";

export default {
  description:
    "Update this conversation's active first-play sitting: record the last ruling cited, the last analogy used, or add games the players just told you they know. Requires an active sitting (boardgame_start_sitting).",
  defaultRiskLevel: "low" as const,
  input_schema: {
    type: "object",
    properties: {
      last_ruling_entry_id: {
        type: "string",
        description: "Corpus entry id of the ruling just cited to the table.",
      },
      last_analog_known_game_id: {
        type: "string",
        description:
          "known_game_id of the analogy just used (only when boardgame_ask_rules actually returned that hook).",
      },
      add_known_games: {
        type: "array",
        items: { type: "string" },
        description: "Games the players just said they know, to add to the sitting.",
      },
    },
    additionalProperties: false,
  },
  async execute(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolExecutionResult> {
    const existing = getSitting(ctx.conversationId);
    if (!existing) {
      return {
        content:
          "Error: no active sitting for this conversation. Call boardgame_start_sitting first.",
        isError: true,
      };
    }

    const rulingEntryId =
      input.last_ruling_entry_id == null ? undefined : String(input.last_ruling_entry_id).trim();
    const analogGameId =
      input.last_analog_known_game_id == null
        ? undefined
        : String(input.last_analog_known_game_id).trim();
    const addKnownGames = Array.isArray(input.add_known_games)
      ? input.add_known_games.map(String)
      : undefined;

    let lastRuling;
    if (rulingEntryId) {
      const entry = loadCorpus(existing.game_id)?.entries.find(
        (candidate) => candidate.id === rulingEntryId,
      );
      if (!entry) {
        return {
          content: `Error: entry '${rulingEntryId}' is not in the '${existing.game_id}' corpus. Record only entry ids returned by boardgame_ask_rules.`,
          isError: true,
        };
      }
      lastRuling = {
        entry_id: entry.id,
        title: entry.title,
        locator: entry.source_locator.locator,
      };
    }

    const sitting = updateSitting({
      conversationId: ctx.conversationId,
      lastRuling,
      lastAnalog: analogGameId
        ? {
            known_game_id: analogGameId,
            entry_id: rulingEntryId ?? existing.last_ruling?.entry_id ?? "",
          }
        : undefined,
      addKnownGames,
    });

    return {
      content: JSON.stringify({ sitting }, null, 2),
      isError: false,
    };
  },
};
