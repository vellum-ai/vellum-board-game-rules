/**
 * Semantic retrieval layer over the host's plugin-scoped index.
 *
 * `@vellumai/plugin-api` exposes `indexDocument` / `queryIndex`: a hybrid
 * dense+sparse index scoped to the calling plugin that never participates in
 * agent recall. It is a derived cache of our own corpora, nothing more.
 *
 * Why it exists: lexical retrieval cannot bridge table paraphrases
 * ("feeder thing" vs "birdfeeder", "same score" vs "ties are broken"). The
 * corpus usually already ranks the right entry first; the token score just
 * falls under the abstention threshold. Semantic similarity supplies the
 * missing signal, and `askRules` FUSES it with the lexical score rather than
 * replacing it: lexical stays exact and cheap, semantic covers vocabulary.
 *
 * Fail-open everywhere: outside the daemon (eval harness, no plugin
 * execution context), with no embedding backend, or on any error, every
 * function here degrades to "no semantic signal" and retrieval is exactly
 * the lexical behavior it had before. Nothing in the answer path can be
 * broken by this module being unavailable.
 */

import { createHash } from "node:crypto";
import { loadCorpora } from "./corpus.ts";
import type { CorpusEntry } from "./types.ts";

/** Semantic hit for one corpus entry: cosine-style similarity in [0, 1]. */
export type SemanticScores = Map<string, number>;

const QUERY_LIMIT = 12;

/** Stable, content-addressed document id: same entry text → same id (idempotent upserts). */
export function documentIdFor(corpusId: string, entry: CorpusEntry): string {
  return `${corpusId}::${entry.id}`;
}

function documentTextFor(entry: CorpusEntry): string {
  return [entry.title, entry.summary, ...(entry.topics ?? [])].join("\n");
}

function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

type PluginApi = {
  indexDocument?: (
    input: { type: "text"; text: string },
    opts?: { documentId?: string; metadata?: Record<string, unknown> },
  ) => Promise<unknown>;
  queryIndex?: (
    query: { type: "text"; text: string },
    opts?: { limit?: number },
  ) => Promise<unknown>;
  getDocument?: (documentId: string) => Promise<unknown>;
};

async function loadApi(): Promise<PluginApi | null> {
  try {
    const mod: unknown = await import("@vellumai/plugin-api");
    return typeof mod === "object" && mod !== null ? (mod as PluginApi) : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Index every corpus entry into the plugin's private semantic namespace.
 * Content-hash metadata makes re-runs cheap: an entry whose text is unchanged
 * is skipped. Returns counts for the init log; never throws.
 */
export async function indexAllCorpora(): Promise<{
  indexed: number;
  skipped: number;
  unavailable: string | null;
}> {
  const api = await loadApi();
  if (!api?.indexDocument) {
    return { indexed: 0, skipped: 0, unavailable: "plugin API unavailable" };
  }
  let indexed = 0;
  let skipped = 0;
  try {
    for (const corpus of loadCorpora()) {
      for (const entry of corpus.entries) {
        const text = documentTextFor(entry);
        const hash = contentHash(text);
        const documentId = documentIdFor(corpus.corpus_id, entry);
        if (api.getDocument) {
          const existing: unknown = await api.getDocument(documentId);
          if (
            isRecord(existing) &&
            isRecord(existing.metadata) &&
            existing.metadata.content_hash === hash
          ) {
            skipped += 1;
            continue;
          }
        }
        await api.indexDocument(
          { type: "text", text },
          {
            documentId,
            metadata: {
              corpus_id: corpus.corpus_id,
              entry_id: entry.id,
              edition_ids: entry.edition_ids,
              content_hash: hash,
            },
          },
        );
        indexed += 1;
      }
    }
    return { indexed, skipped, unavailable: null };
  } catch (error) {
    return {
      indexed,
      skipped,
      unavailable: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Semantic similarity for a query against one corpus's entries. Returns an
 * empty map (no signal) whenever the index is unavailable, so callers can
 * always fuse unconditionally.
 */
export async function semanticScores(
  corpusId: string,
  query: string,
): Promise<SemanticScores> {
  const scores: SemanticScores = new Map();
  const api = await loadApi();
  if (!api?.queryIndex) return scores;
  try {
    const hits: unknown = await api.queryIndex(
      { type: "text", text: query },
      { limit: QUERY_LIMIT },
    );
    if (!Array.isArray(hits)) return scores;
    for (const hit of hits) {
      if (!isRecord(hit) || !isRecord(hit.metadata)) continue;
      if (hit.metadata.corpus_id !== corpusId) continue;
      const entryId = hit.metadata.entry_id;
      const score = hit.score;
      if (typeof entryId !== "string" || typeof score !== "number") continue;
      // Clamp: hybrid fusion scores can exceed the unit interval slightly.
      scores.set(entryId, Math.max(0, Math.min(1, score)));
    }
  } catch {
    // Fail open: no semantic signal.
  }
  return scores;
}
