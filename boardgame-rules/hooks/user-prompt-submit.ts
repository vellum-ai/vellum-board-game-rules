/**
 * `user-prompt-submit` hook: when this conversation has an active sitting,
 * append a short sitting card to the turn so the model picks up mid-game —
 * which game and edition, what was last cited, which games the table knows.
 *
 * Deliberately minimal: the card is appended as one extra text block on the
 * final user message. It never rewrites the user's prompt, never replaces
 * boardgame_ask_rules, and is absent entirely when there is no sitting.
 */

import type {
  HookFunction,
  UserPromptSubmitContext,
} from "@vellumai/plugin-api";

import { getSitting } from "../src/sitting.ts";

const userPromptSubmit: HookFunction<UserPromptSubmitContext> = async (ctx) => {
  let card: string | null = null;
  try {
    const sitting = getSitting(ctx.conversationId);
    if (!sitting) return;
    const parts = [
      `Board-game sitting active: teaching ${sitting.game_id}` +
        (sitting.edition_id ? ` (${sitting.edition_id})` : "") +
        ".",
      sitting.known_games.length > 0
        ? `Table knows: ${sitting.known_games.join(", ")}.`
        : "No known games recorded — cite only, do not analogize. If the table hasn't been asked yet, ask what games they've played before.",
      sitting.last_ruling
        ? `Last ruling cited: ${sitting.last_ruling.title} (${sitting.last_ruling.locator}).`
        : null,
      "Answer rules questions via boardgame_ask_rules. Cite first; analogize only from a returned analog hook. Keep answers short — the table is waiting.",
    ].filter(Boolean);
    card = `<system_notice>${parts.join(" ")}</system_notice>`;
  } catch {
    // Fail open: a broken sitting row must never block the user's turn.
    return;
  }
  if (!card) return;

  for (let i = ctx.latestMessages.length - 1; i >= 0; i -= 1) {
    const message = ctx.latestMessages[i];
    if (message.role === "user") {
      message.content.push({ type: "text", text: card });
      return;
    }
  }
};

export default userPromptSubmit;
