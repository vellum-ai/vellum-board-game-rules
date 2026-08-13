/**
 * `shutdown` hook: purge stale sittings on teardown. May run in a different
 * process than `init`, so it must not rely on the storage-dir override init
 * set — the module default (`<pluginDir>/data/`) is the same path for a user
 * plugin. Live sittings survive a plain daemon restart on purpose: the table
 * may still be mid-game when the daemon bounces.
 */

import type { HookFunction, ShutdownContext } from "@vellumai/plugin-api";

import { clearAllSittings, purgeStaleSittings } from "../src/sitting.ts";

const shutdown: HookFunction<ShutdownContext> = async (ctx) => {
  if (ctx.reason === "uninstall") {
    clearAllSittings();
    return;
  }
  purgeStaleSittings();
};

export default shutdown;
