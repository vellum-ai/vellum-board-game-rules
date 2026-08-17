/**
 * `init` hook: point the sitting store at the daemon-provided storage dir,
 * create it idempotently, and purge sittings whose table packed up while the
 * daemon was down. Deletion of live rows is owned by the
 * `conversation-deleted` / `conversations-cleared` hooks; the stale purge
 * here is only a belt for rows those hooks could not see.
 */

import type { HookFunction, InitContext } from "@vellumai/plugin-api";

import { indexAllCorpora } from "../src/semantic.ts";
import {
  ensureSittingStore,
  purgeStaleSittings,
  setStorageDir,
} from "../src/sitting.ts";

const init: HookFunction<InitContext> = async (ctx) => {
  setStorageDir(ctx.pluginStorageDir);
  ensureSittingStore();
  const removed = purgeStaleSittings();
  if (removed > 0) {
    ctx.logger.info(
      { plugin: "boardgame-rules", removed },
      "Purged stale board-game sittings at init",
    );
  }

  // Populate the plugin's private semantic index from the corpora. Content-
  // hashed, so a re-run after an unchanged install skips everything. Fails
  // open: retrieval is pure lexical until/unless the index is available.
  const index = await indexAllCorpora();
  if (index.unavailable) {
    ctx.logger.warn(
      { plugin: "boardgame-rules", reason: index.unavailable, indexed: index.indexed },
      "Semantic index unavailable; ask_rules runs lexical-only",
    );
  } else {
    ctx.logger.info(
      { plugin: "boardgame-rules", indexed: index.indexed, skipped: index.skipped },
      "Semantic index ready",
    );
  }
};

export default init;
