/**
 * `conversation-deleted` hook: a sitting is keyed to its conversation, so
 * when the conversation's rows are removed the sitting row goes with them.
 * Fire-and-forget with no ordering guarantee relative to the caller — the
 * store keys purely on the id, which is all this context carries.
 */

import type {
  ConversationDeletedContext,
  HookFunction,
} from "@vellumai/plugin-api";

import { deleteSitting } from "../src/sitting.ts";

const conversationDeleted: HookFunction<ConversationDeletedContext> = async (
  ctx,
) => {
  if (deleteSitting(ctx.conversationId)) {
    ctx.logger.info(
      { plugin: "boardgame-rules" },
      "Removed deleted conversation's board-game sitting",
    );
  }
};

export default conversationDeleted;
