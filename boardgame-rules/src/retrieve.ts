import { listSupportedGames, loadCorpus } from "./corpus.ts";
import { normalizeKnownGames } from "./sitting.ts";
import type { AnalogHook, AskResult, Citation, Corpus, CorpusEntry, Evidence } from "./types.ts";

const ABSTAIN_THRESHOLD = 5.5;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "of", "to", "in", "on", "for", "with",
  "and", "or", "not", "but", "how", "do", "does", "did", "i", "you",
  "your", "my", "we", "they", "their", "what", "when", "where", "can",
  "could", "should", "would", "will", "as", "at", "by", "from", "it",
  "its", "be", "been", "being", "has", "have", "had", "was", "were",
  "this", "that", "these", "those", "if", "then", "than", "so",
]);

function tokenize(text: string, filterStopWords = false): string[] {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return filterStopWords ? tokens.filter((t) => !STOP_WORDS.has(t)) : tokens;
}

function scoreEntry(entry: CorpusEntry, queryTokens: string[]): number {
  const haystack = [entry.title, entry.summary, entry.section ?? "", entry.subsection ?? "", ...(entry.topics ?? [])].join(" ");
  const tokens = tokenize(haystack);
  const tokenSet = new Set(tokens);
  const matches = queryTokens.reduce((total, token) => total + (tokenSet.has(token) ? 1 : 0), 0);
  const phraseBonus = tokens.join(" ").includes(queryTokens.join(" ")) ? 5 : 0;
  // Title bonus: proportional to how much of the query appears in the title
  const titleTokens = new Set(tokenize(entry.title));
  const titleMatches = queryTokens.reduce((total, token) => total + (titleTokens.has(token) ? 1 : 0), 0);
  const titleBonus = (titleMatches / queryTokens.length) * 5;
  return (matches / queryTokens.length) * 10 + phraseBonus + titleBonus;
}

function citationFor(entry: CorpusEntry): Citation {
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

function emptyAsk(partial: Partial<AskResult> & Pick<AskResult, "query" | "abstention" | "abstention_reason">): AskResult {
  return {
    game_id: null,
    game_title: null,
    edition_id: null,
    corpus_version: null,
    coverage_boundary: null,
    rights: {
      full_rulebook_text_included: false,
      redistribution_permitted: false,
    },
    evidence: [],
    supported_games: listSupportedGames().map((game) => game.game_id),
    analog_hooks: [],
    ...partial,
  };
}

/**
 * Analog hooks for the top evidence entry, filtered to games the caller's
 * sitting knows. Abstention always wins: an abstained result never
 * analogizes. No known games, or no hook for a known game, returns [] —
 * citing without analogizing is the correct behavior, not a failure.
 */
function analogHooksFor(
  topEntry: CorpusEntry | undefined,
  abstention: boolean,
  knownGames: readonly string[] | undefined,
): AnalogHook[] {
  if (abstention || !topEntry?.analog_hooks?.length || !knownGames?.length) {
    return [];
  }
  const known = new Set(normalizeKnownGames(knownGames));
  return topEntry.analog_hooks.filter((hook) => known.has(hook.known_game_id));
}

function resolveEdition(corpus: Corpus, editionId?: string): string | null {
  if (editionId) {
    return corpus.editions.some((edition) => edition.edition_id === editionId) ? editionId : null;
  }
  return corpus.editions[0]?.edition_id ?? null;
}

export function askRules(options: {
  query: string;
  gameId?: string;
  editionId?: string;
  limit?: number;
  /** Games the current sitting's players already know. Enables analog_hooks on the result. */
  knownGames?: string[];
}): AskResult {
  const query = options.query.trim();
  const requestedLimit = options.limit ?? DEFAULT_LIMIT;
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);
  const supported = listSupportedGames();

  if (supported.length === 0) {
    return emptyAsk({
      query,
      abstention: true,
      abstention_reason: "No game corpora are installed.",
    });
  }

  const gameId = options.gameId?.trim() || supported[0].game_id;
  const corpus = loadCorpus(gameId);
  if (!corpus) {
    return emptyAsk({
      query,
      game_id: gameId,
      abstention: true,
      abstention_reason: `Game '${gameId}' is not supported. Supported games: ${supported.map((game) => game.game_id).join(", ")}`,
    });
  }

  const editionId = resolveEdition(corpus, options.editionId);
  if (options.editionId && !editionId) {
    return emptyAsk({
      query,
      game_id: corpus.corpus_id,
      game_title: corpus.game_title,
      corpus_version: corpus.corpus_version,
      coverage_boundary: corpus.coverage_boundary,
      abstention: true,
      abstention_reason: `Unknown edition_id '${options.editionId}'. Available editions: ${corpus.editions.map((edition) => edition.edition_id).join(", ")}`,
    });
  }

  const scopedEntries = corpus.entries.filter((entry) => !editionId || entry.edition_ids.includes(editionId));
  const queryTokens = tokenize(query, true);
  if (queryTokens.length === 0) {
    return emptyAsk({
      query,
      game_id: corpus.corpus_id,
      game_title: corpus.game_title,
      edition_id: editionId,
      corpus_version: corpus.corpus_version,
      coverage_boundary: corpus.coverage_boundary,
      abstention: true,
      abstention_reason: "No search terms provided.",
    });
  }

  const scored = scopedEntries
    .map((entry) => ({ entry, score: scoreEntry(entry, queryTokens) }))
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));
  const topScore = scored[0]?.score ?? 0;
  const abstention = topScore < ABSTAIN_THRESHOLD;
  const evidence: Evidence[] = scored
    .filter(({ score }) => score > 0)
    .slice(0, limit)
    .map(({ entry, score }) => ({
      entry_id: entry.id,
      title: entry.title,
      summary: entry.summary,
      section: entry.section,
      subsection: entry.subsection,
      edition_ids: entry.edition_ids,
      score: Math.round(score * 100) / 100,
      citation: citationFor(entry),
      rights_flags: entry.rights_flags,
    }));

  return {
    game_id: corpus.corpus_id,
    game_title: corpus.game_title,
    edition_id: editionId,
    corpus_version: corpus.corpus_version,
    coverage_boundary: corpus.coverage_boundary,
    query,
    abstention,
    abstention_reason: abstention
      ? "No sufficiently matching rule is in the current corpus. The question may be outside coverage, or phrased differently than the fixture entries."
      : null,
    rights: {
      full_rulebook_text_included: corpus.full_rulebook_text_included === true,
      redistribution_permitted: false,
    },
    evidence,
    supported_games: supported.map((game) => game.game_id),
    analog_hooks: analogHooksFor(scored[0]?.entry, abstention, options.knownGames),
  };
}
