/**
 * Invariant guard for boardgame_ask_rules results.
 *
 * The plugin's core promises live in prose (skills, README): cite first,
 * analogize only from a returned hook, never analogize an abstention, and
 * web-fallback content is guidance, never a ruling. This module enforces
 * the machine-checkable half of those promises on the serialized result
 * the model is about to read, so a bug anywhere upstream cannot hand the
 * assistant a payload that contradicts them.
 *
 * Pure and synchronous: takes the tool's JSON text, returns the corrected
 * JSON text plus a list of what was corrected (for logging). Unknown or
 * unparseable payloads pass through untouched. Used by the post-tool-use
 * hook; unit-tested directly by the eval harness.
 */

export type GuardCorrection =
  | "analog_hooks_on_abstention_stripped"
  | "web_fallback_used_without_sources_downgraded"
  | "web_fallback_on_non_coverage_stripped"
  | "web_fallback_on_answer_stripped";

export type GuardOutcome = {
  content: string;
  corrections: GuardCorrection[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Enforce the ask_rules invariants on a serialized result. Never throws.
 */
export function guardAskRulesResult(content: string): GuardOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { content, corrections: [] };
  }
  if (!isRecord(parsed) || typeof parsed.abstention !== "boolean") {
    return { content, corrections: [] };
  }

  const corrections: GuardCorrection[] = [];
  const abstention = parsed.abstention;

  // Invariant: never analogize an abstention.
  if (abstention && Array.isArray(parsed.analog_hooks) && parsed.analog_hooks.length > 0) {
    parsed.analog_hooks = [];
    corrections.push("analog_hooks_on_abstention_stripped");
  }

  // Invariants around web_fallback: only on coverage abstentions, and never
  // "used" without at least one source (sourceless text is memory, not web).
  const fallback = parsed.web_fallback;
  if (isRecord(fallback)) {
    if (!abstention) {
      parsed.web_fallback = null;
      corrections.push("web_fallback_on_answer_stripped");
    } else if (parsed.abstention_kind !== "coverage") {
      parsed.web_fallback = null;
      corrections.push("web_fallback_on_non_coverage_stripped");
    } else if (
      fallback.used === true &&
      (!Array.isArray(fallback.sources) || fallback.sources.length === 0)
    ) {
      fallback.used = false;
      fallback.answer = null;
      fallback.note =
        "Web fallback answer discarded by the result guard: it carried no web sources.";
      corrections.push("web_fallback_used_without_sources_downgraded");
    }
  }

  if (corrections.length === 0) {
    return { content, corrections };
  }
  return { content: JSON.stringify(parsed, null, 2), corrections };
}
