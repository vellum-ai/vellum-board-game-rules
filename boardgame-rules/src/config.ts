/**
 * Optional user-edited plugin config at `<pluginDir>/config.json`:
 *
 *     { "known_games": ["catan", "ticket to ride"] }
 *
 * `known_games` is a standing default merged into every sitting's known-games
 * set. The plugin never invents this list — who knows which games lives in
 * assistant memory; this file is only a hand-edited convenience. Missing file
 * and empty list are both valid.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeKnownGames } from "./sitting.ts";

const configPath = join(
  fileURLToPath(new URL("..", import.meta.url)),
  "config.json",
);

/**
 * Web-search fallback on coverage abstentions is on by default; set
 * `"web_fallback": false` in config.json to disable it.
 */
export function webFallbackEnabled(): boolean {
  if (!existsSync(configPath)) return true;
  try {
    const parsed: unknown = JSON.parse(readFileSync(configPath, "utf8"));
    if (typeof parsed !== "object" || parsed === null || !("web_fallback" in parsed)) {
      return true;
    }
    return parsed.web_fallback !== false;
  } catch {
    return true;
  }
}

export function configKnownGames(): string[] {
  if (!existsSync(configPath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as {
      known_games?: unknown;
    };
    if (!Array.isArray(parsed.known_games)) return [];
    return normalizeKnownGames(parsed.known_games.map(String));
  } catch {
    return [];
  }
}
