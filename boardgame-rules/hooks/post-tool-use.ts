/**
 * `post-tool-use` hook: enforce boardgame_ask_rules invariants on the result
 * before the model reads it. Self-gates on our own tool by resolving the
 * result's tool_use_id against the run's message history; every other tool
 * result passes through untouched. Fail-open: any error leaves the result
 * as the tool produced it.
 */

import type { HookFunction, PostToolUseContext } from "@vellumai/plugin-api";

import { guardAskRulesResult } from "../src/result-guard.ts";

const GUARDED_TOOL = "boardgame_ask_rules";

function toolNameForResult(
  messages: PostToolUseContext["messages"],
  toolUseId: string,
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    for (const block of messages[i].content) {
      if (block.type === "tool_use" && block.id === toolUseId) {
        return block.name;
      }
    }
  }
  return null;
}

const postToolUse: HookFunction<PostToolUseContext> = async (ctx) => {
  try {
    if (ctx.toolResponse.is_error) return;
    if (toolNameForResult(ctx.messages, ctx.toolResponse.tool_use_id) !== GUARDED_TOOL) {
      return;
    }
    const outcome = guardAskRulesResult(ctx.toolResponse.content);
    if (outcome.corrections.length === 0) return;
    ctx.toolResponse.content = outcome.content;
    ctx.logger.warn(
      { plugin: "boardgame-rules", corrections: outcome.corrections },
      "ask_rules result violated an invariant; corrected before the model read it",
    );
  } catch {
    // Fail open: never block or alter a result on guard error.
  }
};

export default postToolUse;
