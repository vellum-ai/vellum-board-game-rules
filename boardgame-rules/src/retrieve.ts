import { listSupportedGames, loadCorpus } from "./corpus.ts";
import { normalizeKnownGames } from "./sitting.ts";
import type { AnalogHook, AskResult, Citation, Corpus, CorpusEntry, Evidence } from "./types.ts";

const ABSTAIN_THRESHOLD = 5.5;
/**
 * A top entry sharing at least this many DISTINCT content tokens with the
 * query is a strong-match candidate even when the ratio-based score is
 * diluted below ABSTAIN_THRESHOLD by a verbose query ("ok so wait how
 * exactly do I ..."). Count alone cannot separate real hits from
 * generic-token noise on small corpora with wordy summaries (review
 * example: "trade resources with another player..." matched 3 tokens on a
 * Flip 7 entry, all but one in the summary) - and raising the count bar to
 * 4 breaks a genuine playtest case that also sits at exactly 3. So the
 * override ALSO requires MIN_STRONG_TITLE_MATCHES distinct matches anchored
 * in the entry TITLE: real verbose hits name the concept the title names;
 * off-domain queries brush titles at most once.
 */
const MIN_STRONG_DISTINCT_MATCHES = 3;
const MIN_STRONG_TITLE_MATCHES = 2;
/** Floor so a strong-match override still requires non-trivial score mass. */
const STRONG_MATCH_SCORE_FLOOR = 3.0;
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

function scoreEntry(
  entry: CorpusEntry,
  queryTokens: string[],
): { score: number; distinctMatches: number; distinctTitleMatches: number } {
  const haystack = [entry.title, entry.summary, entry.section ?? "", entry.subsection ?? "", ...(entry.topics ?? [])].join(" ");
  const tokens = tokenize(haystack);
  const tokenSet = new Set(tokens);
  const matches = queryTokens.reduce((total, token) => total + (tokenSet.has(token) ? 1 : 0), 0);
  const phraseBonus = tokens.join(" ").includes(queryTokens.join(" ")) ? 5 : 0;
  // Title bonus: proportional to how much of the query appears in the title
  const titleTokens = new Set(tokenize(entry.title));
  const titleMatches = queryTokens.reduce((total, token) => total + (titleTokens.has(token) ? 1 : 0), 0);
  const titleBonus = (titleMatches / queryTokens.length) * 5;
  let distinctMatches = 0;
  let distinctTitleMatches = 0;
  for (const token of new Set(queryTokens)) {
    if (tokenSet.has(token)) distinctMatches += 1;
    if (titleTokens.has(token)) distinctTitleMatches += 1;
  }
  return {
    score: (matches / queryTokens.length) * 10 + phraseBonus + titleBonus,
    distinctMatches,
    distinctTitleMatches,
  };
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

/**
 * An explicit edition_id filters strictly (null = unknown edition, abstain).
 * No edition_id means NO filter — all editions are in scope. Defaulting to
 * the first edition would hide variant/expansion/overlay entries that are
 * only tagged with later editions (cribbage variants, wingspan errata).
 */
function resolveEdition(corpus: Corpus, editionId?: string): string | null {
  if (!editionId) return null;
  return corpus.editions.some((edition) => edition.edition_id === editionId) ? editionId : null;
}

/**
 * The requested edition plus every edition it (transitively) inherits from.
 * An expansion edition declaring `inherits` stacks on its base, so filtering
 * by the expansion must also surface the base rules it plays on top of.
 */
function editionScope(corpus: Corpus, editionId: string): Set<string> {
  const scope = new Set<string>();
  let current: string | null | undefined = editionId;
  while (current && !scope.has(current)) {
    scope.add(current);
    current = corpus.editions.find((edition) => edition.edition_id === current)?.inherits;
  }
  return scope;
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

  const gameId = options.gameId?.trim();
  if (!gameId) {
    // With many installed games, guessing one (previously: alphabetically
    // first) silently answers from the wrong corpus. Abstain and say so.
    return emptyAsk({
      query,
      abstention: true,
      abstention_reason: `No game specified. Pass game_id (or start a sitting) — supported games: ${supported.map((game) => game.game_id).join(", ")}`,
    });
  }
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

  const scope = editionId ? editionScope(corpus, editionId) : null;
  const scopedEntries = corpus.entries.filter(
    (entry) => !scope || entry.edition_ids.some((id) => scope.has(id)),
  );
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
    .map((entry) => ({ entry, ...scoreEntry(entry, queryTokens) }))
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));
  const topScore = scored[0]?.score ?? 0;
  // A verbose query dilutes the ratio-based score; a top entry that still
  // shares MIN_STRONG_DISTINCT_MATCHES distinct content tokens with the query
  // is a real answer, not an abstention-with-evidence.
  const strongTopMatch =
    (scored[0]?.distinctMatches ?? 0) >= MIN_STRONG_DISTINCT_MATCHES &&
    (scored[0]?.distinctTitleMatches ?? 0) >= MIN_STRONG_TITLE_MATCHES &&
    topScore >= STRONG_MATCH_SCORE_FLOOR;
  const abstention = topScore < ABSTAIN_THRESHOLD && !strongTopMatch;
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
