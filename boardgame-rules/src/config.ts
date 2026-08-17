/**
 * Optional user-edited plugin config at `<pluginDir>/config.json`:
 *
 *     {
 *       "known_games": ["catan", "ticket to ride"],
 *       "web_fallback": true
 *     }
 *
 * - `known_games`: a standing default merged into every sitting's known-games
 *   set. The plugin never invents this list; who knows which games lives in
 *   assistant memory. Missing file and empty list are both valid.
 * - `web_fallback`: whether boardgame_ask_rules may run a live web search on
 *   coverage abstentions. Defaults to true.
 *
 * One validated load: every reader goes through {@link loadPluginConfig},
 * which reports what it could not understand instead of silently ignoring
 * it, and `boardgame_list_supported_games` echoes the effective values so
 * a misconfiguration is visible rather than silent.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeKnownGames } from "./sitting.ts";

const configPath = join(
  fileURLToPath(new URL("..", import.meta.url)),
  "config.json",
);

const KNOWN_KEYS = ["known_games", "web_fallback"] as const;

export type PluginConfig = {
  known_games: string[];
  web_fallback: boolean;
  /** Where the values came from: absent file, parsed file, or fell back after an unreadable file. */
  source: "defaults" | "config.json" | "defaults (config.json unreadable)";
  /** Keys present in config.json that the plugin does not understand (likely typos). */
  unknown_keys: string[];
  /** Known keys whose value had the wrong type and were replaced by the default. */
  invalid_keys: string[];
};

const DEFAULTS: Pick<PluginConfig, "known_games" | "web_fallback"> = {
  known_games: [],
  web_fallback: true,
};

export function loadPluginConfig(): PluginConfig {
  if (!existsSync(configPath)) {
    return { ...DEFAULTS, source: "defaults", unknown_keys: [], invalid_keys: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    return {
      ...DEFAULTS,
      source: "defaults (config.json unreadable)",
      unknown_keys: [],
      invalid_keys: [],
    };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      ...DEFAULTS,
      source: "defaults (config.json unreadable)",
      unknown_keys: [],
      invalid_keys: [],
    };
  }

  const known = new Set<string>(KNOWN_KEYS);
  const unknownKeys = Object.keys(parsed).filter((key) => !known.has(key)).sort();
  const invalidKeys: string[] = [];

  let knownGames: string[] = DEFAULTS.known_games;
  if ("known_games" in parsed) {
    const raw = parsed.known_games;
    if (Array.isArray(raw) && raw.every((item) => typeof item === "string")) {
      knownGames = normalizeKnownGames(raw);
    } else {
      invalidKeys.push("known_games");
    }
  }

  let webFallback = DEFAULTS.web_fallback;
  if ("web_fallback" in parsed) {
    const raw = parsed.web_fallback;
    if (typeof raw === "boolean") {
      webFallback = raw;
    } else {
      invalidKeys.push("web_fallback");
    }
  }

  return {
    known_games: knownGames,
    web_fallback: webFallback,
    source: "config.json",
    unknown_keys: unknownKeys,
    invalid_keys: invalidKeys,
  };
}

export function webFallbackEnabled(): boolean {
  return loadPluginConfig().web_fallback;
}

export function configKnownGames(): string[] {
  return loadPluginConfig().known_games;
}
