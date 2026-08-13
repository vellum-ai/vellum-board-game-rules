/**
 * `init` hook: point the sitting store at the daemon-provided storage dir,
 * create it idempotently, and purge sittings whose table packed up while the
 * daemon was down. Deletion of live rows is owned by the
 * `conversation-deleted` / `conversations-cleared` hooks; the stale purge
 * here is only a belt for rows those hooks could not see.
 */

import type { HookFunction, InitContext } from "@vellumai/plugin-api";

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
};

export default init;
