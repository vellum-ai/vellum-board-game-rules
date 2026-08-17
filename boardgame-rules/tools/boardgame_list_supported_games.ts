import type { ToolContext, ToolExecutionResult } from "@vellumai/plugin-api";
import { loadPluginConfig } from "../src/config.ts";
import { listSupportedGames } from "../src/corpus.ts";

export default {
  description:
    "List installed board games, editions, coverage limits, corpus versions, and each game's source-audit status and rights note (how its sources were audited and what the rights posture is). Use this before asking a rules question so you know which games and editions are actually supported.",
  defaultRiskLevel: "low" as const,
  input_schema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  async execute(_input: Record<string, unknown>, _ctx: ToolContext): Promise<ToolExecutionResult> {
    const games = listSupportedGames();
    const config = loadPluginConfig();
    return {
      content: JSON.stringify(
        {
          games,
          count: games.length,
          // Effective plugin config, so a misconfigured config.json (typo'd
          // key, wrong type) is visible here instead of silently ignored.
          config: {
            source: config.source,
            known_games: config.known_games,
            web_fallback: config.web_fallback,
            ...(config.unknown_keys.length > 0 ? { unknown_keys: config.unknown_keys } : {}),
            ...(config.invalid_keys.length > 0 ? { invalid_keys: config.invalid_keys } : {}),
          },
          note: "Only listed games can be answered. Unlisted games must be refused.",
        },
        null,
        2,
      ),
      isError: false,
    };
  },
};
