/**
 * `conversations-cleared` hook: the clear-all reset wipes every conversation
 * at once and carries no conversationId, so wipe every sitting row wholesale.
 */

import type {
  ConversationsClearedContext,
  HookFunction,
} from "@vellumai/plugin-api";

import { clearAllSittings } from "../src/sitting.ts";

const conversationsCleared: HookFunction<
  ConversationsClearedContext
> = async () => {
  clearAllSittings();
};

export default conversationsCleared;
