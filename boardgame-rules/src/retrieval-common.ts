/**
 * Pieces shared by the two retrievers (`retrieve.ts` for ask_rules,
 * `scenario.ts` for check_scenario). They differ in what they score and how
 * they abstain, but not in how they tokenize, cite, resolve editions, or
 * validate the request. Keeping those here means a fix lands in both paths
 * at once, instead of being ported by hand (which is how the check_scenario
 * edition-inheritance regression happened).
 */

import { listSupportedGames, loadCorpus } from "./corpus.ts";
import type { Citation, Corpus, CorpusEntry } from "./types.ts";

export const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "of", "to", "in", "on", "for", "with",
  "and", "or", "not", "but", "how", "do", "does", "did", "i", "you",
  "your", "my", "we", "they", "their", "what", "when", "where", "can",
  "could", "should", "would", "will", "as", "at", "by", "from", "it",
  "its", "be", "been", "being", "has", "have", "had", "was", "were",
  "this", "that", "these", "those", "if", "then", "than", "so",
]);

export function tokenize(text: string, filterStopWords = false): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return filterStopWords ? tokens.filter((t) => !STOP_WORDS.has(t)) : tokens;
}

export function citationFor(entry: CorpusEntry): Citation {
  return {
    entry_id: entry.id,
    title: entry.title,
    section: entry.section,
    subsection: entry.subsection,
    locator: entry.source_locator.locator,
    url: entry.source_locator.url,
    source_kind: entry.source_locator.source_kind,
    confidence: entry.confidence,
  };
}

/**
 * An explicit edition_id filters strictly (null = unknown edition, abstain).
 * No edition_id means NO filter: all editions are in scope. Defaulting to
 * the first edition would hide variant/expansion/overlay entries that are
 * only tagged with later editions (cribbage variants, wingspan errata).
 */
export function resolveEdition(corpus: Corpus, editionId?: string): string | null {
  if (!editionId) return null;
  return corpus.editions.some((edition) => edition.edition_id === editionId) ? editionId : null;
}

/**
 * The requested edition plus every edition it (transitively) inherits from.
 * An expansion edition declaring `inherits` stacks on its base, so filtering
 * by the expansion must also surface the base rules it plays on top of.
 */
export function editionScope(corpus: Corpus, editionId: string): Set<string> {
  const scope = new Set<string>();
  let current: string | null | undefined = editionId;
  while (current && !scope.has(current)) {
    scope.add(current);
    current = corpus.editions.find((edition) => edition.edition_id === current)?.inherits;
  }
  return scope;
}

/** Entries in scope for the (optional) edition filter. */
export function scopedEntries(corpus: Corpus, editionId: string | null): CorpusEntry[] {
  if (!editionId) return corpus.entries;
  const scope = editionScope(corpus, editionId);
  return corpus.entries.filter((entry) => entry.edition_ids.some((id) => scope.has(id)));
}

/** Identity fields a resolved (or partially resolved) request carries. */
export type RequestIdentity = {
  game_id: string | null;
  game_title: string | null;
  edition_id: string | null;
  corpus_version: string | null;
  coverage_boundary: string | null;
};

export type ResolvedRequest =
  | { ok: true; corpus: Corpus; editionId: string | null; identity: RequestIdentity }
  | { ok: false; reason: string; identity: RequestIdentity };

const NO_IDENTITY: RequestIdentity = {
  game_id: null,
  game_title: null,
  edition_id: null,
  corpus_version: null,
  coverage_boundary: null,
};

/**
 * Validate and resolve a retrieval request the same way for both retrievers:
 * corpora installed, a game named, the game known, the edition (if given)
 * known. Every rejection is an input error, and carries as much identity as
 * was resolved before the failure so callers can echo it. `noGameHint` lets
 * each retriever say what to do about a missing game in its own terms.
 */
export function resolveRequest(options: {
  gameId?: string;
  editionId?: string;
  noGameHint: string;
}): ResolvedRequest {
  const supported = listSupportedGames();
  if (supported.length === 0) {
    return { ok: false, reason: "No game corpora are installed.", identity: NO_IDENTITY };
  }
  const supportedIds = supported.map((game) => game.game_id).join(", ");

  const gameId = options.gameId?.trim();
  if (!gameId) {
    return {
      ok: false,
      reason: `No game specified. ${options.noGameHint} supported games: ${supportedIds}`,
      identity: NO_IDENTITY,
    };
  }
  const corpus = loadCorpus(gameId);
  if (!corpus) {
    return {
      ok: false,
      reason: `Game '${gameId}' is not supported. Supported games: ${supportedIds}`,
      identity: { ...NO_IDENTITY, game_id: gameId },
    };
  }

  const identity: RequestIdentity = {
    game_id: corpus.corpus_id,
    game_title: corpus.game_title,
    edition_id: null,
    corpus_version: corpus.corpus_version,
    coverage_boundary: corpus.coverage_boundary,
  };
  const editionId = resolveEdition(corpus, options.editionId);
  if (options.editionId && !editionId) {
    return {
      ok: false,
      reason: `Unknown edition_id '${options.editionId}'. Available editions: ${corpus.editions.map((edition) => edition.edition_id).join(", ")}`,
      identity,
    };
  }
  return { ok: true, corpus, editionId, identity: { ...identity, edition_id: editionId } };
}
