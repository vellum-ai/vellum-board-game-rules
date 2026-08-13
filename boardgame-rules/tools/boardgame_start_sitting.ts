import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import { configKnownGames } from "../src/config.ts";
import { loadCorpus } from "../src/corpus.ts";
import { startSitting } from "../src/sitting.ts";

export default {
  description:
    "Start (or resume) a first-play sitting for this conversation: one table, one game, one night. Records which game is being taught and, optionally, which games the players already know, so boardgame_ask_rules can offer analogies to those games. Starting the same game again resumes the existing sitting instead of restarting it.",
  defaultRiskLevel: "low" as const,
  input_schema: {
    type: "object",
    properties: {
      game_id: {
        type: "string",
        description: "Game being taught, by corpus id or exact title (for example wingspan).",
      },
      edition_id: {
        type: "string",
        description: "Optional edition being played, for example base-en-1st-2020.",
      },
      known_games: {
        type: "array",
        items: { type: "string" },
        description:
          "Games the players at the table already know (for example [\"catan\"]). Ask the table what they've played before rather than assuming; only record games the user actually named. Empty is valid — the companion then cites without analogizing.",
      },
    },
    required: ["game_id"],
    additionalProperties: false,
  },
  async execute(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolExecutionResult> {
    const gameId = String(input.game_id ?? "").trim();
    const corpus = loadCorpus(gameId);
    if (!corpus) {
      return {
        content: `Error: game '${gameId}' is not an installed corpus. Call boardgame_list_supported_games for the supported list.`,
        isError: true,
      };
    }

    const editionId = input.edition_id == null ? undefined : String(input.edition_id).trim();
    if (editionId && !corpus.editions.some((edition) => edition.edition_id === editionId)) {
      return {
        content: `Error: unknown edition_id '${editionId}'. Available editions: ${corpus.editions.map((edition) => edition.edition_id).join(", ")}`,
        isError: true,
      };
    }

    const knownGames = Array.isArray(input.known_games)
      ? input.known_games.map(String)
      : [];

    const { sitting, resumed } = startSitting({
      conversationId: ctx.conversationId,
      gameId: corpus.corpus_id,
      editionId,
      knownGames: [...knownGames, ...configKnownGames()],
    });

    return {
      content: JSON.stringify(
        {
          sitting,
          resumed,
          note: resumed
            ? "Existing sitting resumed — do not repeat setup the table has already done."
            : "Sitting started. Cite rulings via boardgame_ask_rules; analogies appear there only when a known game has a corpus hook.",
        },
        null,
        2,
      ),
      isError: false,
    };
  },
};
