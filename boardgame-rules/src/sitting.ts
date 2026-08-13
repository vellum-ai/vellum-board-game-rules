/**
 * Sitting store: one JSON file per conversation under the plugin's writable
 * `data/sittings/` directory. A sitting is this-table-tonight state only —
 * which game is being taught, which games the players already know, and the
 * last ruling/analog used — never a cross-night profile.
 *
 * Cleanup contract (assistant >= 0.11):
 * - `hooks/conversation-deleted.ts` deletes the sitting when its conversation
 *   is deleted, and `hooks/conversations-cleared.ts` wipes all sittings on the
 *   clear-all reset. Those hooks are the primary cleanup path.
 * - Stale expiry (STALE_AFTER_MS) is a belt on top: a sitting whose
 *   `updated_at` is older than ~12h is treated as gone by readers and purged
 *   opportunistically at init/shutdown. A board-game sitting does not span
 *   days; expiry also covers rows orphaned while the daemon was not running.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Sitting, SittingAnalog, SittingRuling } from "./types.ts";

/** A sitting untouched for this long is treated as over. */
export const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

const pluginRoot = fileURLToPath(new URL("..", import.meta.url));

let storageDirOverride: string | null = null;

/**
 * Resolve the sittings directory. Priority: init-hook override (the daemon's
 * `pluginStorageDir`), then the `BOARDGAME_RULES_DATA_DIR` env override (eval
 * and demo harnesses), then the user-plugin default `<pluginDir>/data/`.
 */
export function sittingStoreDir(): string {
  const base =
    storageDirOverride ??
    process.env.BOARDGAME_RULES_DATA_DIR ??
    join(pluginRoot, "data");
  return join(base, "sittings");
}

/** Called from the init hook with `InitContext.pluginStorageDir`. */
export function setStorageDir(dir: string | null): void {
  storageDirOverride = dir;
}

export function ensureSittingStore(): string {
  const dir = sittingStoreDir();
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Conversation ids are UUIDs; anything else is flattened so a hostile id cannot escape the store directory. */
function fileNameFor(conversationId: string): string {
  const safe = conversationId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
  return `${safe || "unknown"}.json`;
}

function sittingPath(conversationId: string): string {
  return join(sittingStoreDir(), fileNameFor(conversationId));
}

/** Normalize a game name to an id: "Ticket to Ride" -> "ticket-to-ride". */
export function normalizeGameId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeKnownGames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const name of names) {
    const id = normalizeGameId(String(name));
    if (id) seen.add(id);
  }
  return [...seen].sort();
}

export function isStale(sitting: Sitting, now = Date.now()): boolean {
  const updated = Date.parse(sitting.updated_at);
  return !Number.isFinite(updated) || now - updated > STALE_AFTER_MS;
}

/**
 * Load the sitting for a conversation. A stale sitting is treated as gone
 * (deleted on read) — the table has long since packed up.
 */
export function getSitting(conversationId: string): Sitting | null {
  const path = sittingPath(conversationId);
  if (!existsSync(path)) return null;
  let sitting: Sitting;
  try {
    sitting = JSON.parse(readFileSync(path, "utf8")) as Sitting;
  } catch {
    rmSync(path, { force: true });
    return null;
  }
  if (isStale(sitting)) {
    rmSync(path, { force: true });
    return null;
  }
  return sitting;
}

function persist(sitting: Sitting): Sitting {
  ensureSittingStore();
  writeFileSync(
    sittingPath(sitting.conversation_id),
    JSON.stringify(sitting, null, 2),
  );
  return sitting;
}

/**
 * Start (or resume) the sitting for a conversation. Starting the same game
 * again merges known games and keeps the ruling history — "teach me Wingspan"
 * twice in one conversation is one sitting, not a restart. Starting a
 * different game replaces the sitting: one sitting teaches one game.
 */
export function startSitting(options: {
  conversationId: string;
  gameId: string;
  editionId?: string | null;
  knownGames?: readonly string[];
}): { sitting: Sitting; resumed: boolean } {
  const existing = getSitting(options.conversationId);
  const knownGames = normalizeKnownGames(options.knownGames ?? []);
  const now = new Date().toISOString();

  if (existing && existing.game_id === options.gameId) {
    existing.edition_id = options.editionId ?? existing.edition_id;
    existing.known_games = normalizeKnownGames([
      ...existing.known_games,
      ...knownGames,
    ]);
    existing.updated_at = now;
    return { sitting: persist(existing), resumed: true };
  }

  const sitting: Sitting = {
    conversation_id: options.conversationId,
    game_id: options.gameId,
    edition_id: options.editionId ?? null,
    known_games: knownGames,
    last_ruling: null,
    last_analog: null,
    started_at: now,
    updated_at: now,
  };
  return { sitting: persist(sitting), resumed: false };
}

/**
 * Record progress on an existing sitting. Returns null when there is no
 * active sitting for the conversation (callers should start one first).
 */
export function updateSitting(options: {
  conversationId: string;
  lastRuling?: SittingRuling;
  lastAnalog?: SittingAnalog;
  addKnownGames?: readonly string[];
}): Sitting | null {
  const sitting = getSitting(options.conversationId);
  if (!sitting) return null;
  if (options.lastRuling) sitting.last_ruling = options.lastRuling;
  if (options.lastAnalog) sitting.last_analog = options.lastAnalog;
  if (options.addKnownGames?.length) {
    sitting.known_games = normalizeKnownGames([
      ...sitting.known_games,
      ...options.addKnownGames,
    ]);
  }
  sitting.updated_at = new Date().toISOString();
  return persist(sitting);
}

export function deleteSitting(conversationId: string): boolean {
  const path = sittingPath(conversationId);
  if (!existsSync(path)) return false;
  rmSync(path, { force: true });
  return true;
}

/** Wipe every sitting (the conversations-cleared reset). Returns rows removed. */
export function clearAllSittings(): number {
  const dir = sittingStoreDir();
  if (!existsSync(dir)) return 0;
  let removed = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    rmSync(join(dir, name), { force: true });
    removed += 1;
  }
  return removed;
}

/** Belt cleanup: drop sittings whose table packed up long ago. Returns rows removed. */
export function purgeStaleSittings(now = Date.now()): number {
  const dir = sittingStoreDir();
  if (!existsSync(dir)) return 0;
  let removed = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const path = join(dir, name);
    try {
      const sitting = JSON.parse(readFileSync(path, "utf8")) as Sitting;
      if (!isStale(sitting, now)) continue;
    } catch {
      // Unreadable rows are stale by definition.
    }
    rmSync(path, { force: true });
    removed += 1;
  }
  return removed;
}
