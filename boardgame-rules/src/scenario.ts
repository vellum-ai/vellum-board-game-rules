import { listSupportedGames, loadCorpora, loadCorpus } from "./corpus.ts";
import type {
  CheckScenarioResult,
  Citation,
  Corpus,
  CorpusEntry,
  ScenarioMatch,
} from "./types.ts";

/**
 * check_scenario retrieval.
 *
 * Different contract from ask_rules on purpose:
 *   - Only considers entries that expose a `worked_example`.
 *   - Hard-abstains when nothing matches; never falls back to general rules retrieval.
 *   - Score is normalized against DISTINCT query tokens (not raw length), so a
 *     one-token query cannot leak into the top of the ranking via normalization.
 *   - Abstains unless the top result clears BOTH a score threshold AND a minimum
 *     number of distinct token matches (protects against single-token queries).
 */
const ABSTAIN_SCORE_THRESHOLD = 4.0;
const MIN_DISTINCT_MATCHES = 2;
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 5;

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

function hasWorkedExample(entry: CorpusEntry): boolean {
  return entry.worked_example != null;
}

type Scored = {
  entry: CorpusEntry;
  score: number;
  distinctMatches: number;
};

function scoreEntry(entry: CorpusEntry, queryTokens: string[]): Scored {
  const distinctQueryTokens = new Set(queryTokens);
  const ex = entry.worked_example;
  const applies = entry.applies_when ?? [];
  const haystack = [
    entry.title,
    entry.summary,
    ex?.scenario ?? "",
    ex?.expected_outcome ?? "",
    ...(ex?.decomposition ?? []),
    ...applies,
    ...(entry.topics ?? []),
    entry.section ?? "",
    entry.subsection ?? "",
  ].join(" ");
  const tokenSet = new Set(tokenize(haystack));

  let distinctMatches = 0;
  for (const token of distinctQueryTokens) {
    if (tokenSet.has(token)) distinctMatches += 1;
  }

  const normalizedMatchRatio = distinctMatches / distinctQueryTokens.size;
  const phraseBonus = tokenize(haystack)
    .join(" ")
    .includes(queryTokens.join(" "))
    ? 5
    : 0;

  // Bonus when query tokens hit the applies_when trigger phrases explicitly.
  const appliesTokenSet = new Set(tokenize(applies.join(" ")));
  let appliesHits = 0;
  for (const token of distinctQueryTokens) {
    if (appliesTokenSet.has(token)) appliesHits += 1;
  }
  const appliesBonus = (appliesHits / distinctQueryTokens.size) * 3;

  const score = normalizedMatchRatio * 10 + phraseBonus + appliesBonus;
  return { entry, score, distinctMatches };
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

function emptyResult(
  partial: Partial<CheckScenarioResult> &
    Pick<CheckScenarioResult, "query" | "abstention" | "abstention_reason">,
): CheckScenarioResult {
  return {
    game_id: null,
    game_title: null,
    edition_id: null,
    corpus_version: null,
    coverage_boundary: null,
    matches: [],
    supported_games: listSupportedGames().map((game) => game.game_id),
    ...partial,
  };
}

/**
 * Mirrors ask_rules edition semantics: an explicit edition_id filters
 * strictly (unknown id abstains), no edition_id means no filter. The old
 * first-edition default hid worked examples tagged only to later editions.
 */
function resolveEdition(corpus: Corpus, editionId?: string): string | null {
  if (!editionId) return null;
  return corpus.editions.some((edition) => edition.edition_id === editionId)
    ? editionId
    : null;
}

/**
 * The requested edition plus every edition it (transitively) inherits from,
 * exactly like ask_rules retrieval: a table playing the Muggins variant is
 * still playing standard Cribbage underneath, so the base edition's worked
 * examples must stay reachable from a variant-pinned sitting.
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

export function checkScenario(options: {
  query: string;
  gameId?: string;
  editionId?: string;
  limit?: number;
}): CheckScenarioResult {
  const query = options.query.trim();
  const requestedLimit = options.limit ?? DEFAULT_LIMIT;
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);
  const supported = listSupportedGames();

  if (supported.length === 0) {
    return emptyResult({
      query,
      abstention: true,
      abstention_reason: "No game corpora are installed.",
    });
  }

  // Require an explicit game_id. With many installed games, silently guessing
  // one hides which corpus answered — align with the same policy ask_rules
  // now enforces.
  const gameId = options.gameId?.trim();
  if (!gameId) {
    return emptyResult({
      query,
      abstention: true,
      abstention_reason: `No game specified. Pass game_id — supported games with worked examples: ${supported
        .filter((game) => (loadCorpus(game.game_id)?.entries ?? []).some(hasWorkedExample))
        .map((game) => game.game_id)
        .join(", ")}`,
    });
  }
  const corpus = loadCorpus(gameId);
  if (!corpus) {
    return emptyResult({
      query,
      game_id: gameId,
      abstention: true,
      abstention_reason: `Game '${gameId}' is not supported. Supported games: ${supported
        .map((game) => game.game_id)
        .join(", ")}`,
    });
  }

  const editionId = resolveEdition(corpus, options.editionId);
  if (options.editionId && !editionId) {
    return emptyResult({
      query,
      game_id: corpus.corpus_id,
      game_title: corpus.game_title,
      corpus_version: corpus.corpus_version,
      coverage_boundary: corpus.coverage_boundary,
      abstention: true,
      abstention_reason: `Unknown edition_id '${options.editionId}'. Available editions: ${corpus.editions
        .map((edition) => edition.edition_id)
        .join(", ")}`,
    });
  }

  const scope = editionId ? editionScope(corpus, editionId) : null;
  const scopedEntries = corpus.entries.filter(
    (entry) =>
      hasWorkedExample(entry) &&
      (!scope || entry.edition_ids.some((id) => scope.has(id))),
  );

  const identityHeader = {
    game_id: corpus.corpus_id,
    game_title: corpus.game_title,
    edition_id: editionId,
    corpus_version: corpus.corpus_version,
    coverage_boundary: corpus.coverage_boundary,
  };

  if (scopedEntries.length === 0) {
    return emptyResult({
      ...identityHeader,
      query,
      abstention: true,
      abstention_reason:
        "No worked examples are available for this game/edition. check_scenario only returns pre-authored examples; try boardgame_ask_rules for general rules lookup.",
    });
  }

  const queryTokens = tokenize(query, true);
  if (queryTokens.length === 0) {
    return emptyResult({
      ...identityHeader,
      query,
      abstention: true,
      abstention_reason: "No search terms provided.",
    });
  }

  const scored = scopedEntries
    .map((entry) => scoreEntry(entry, queryTokens))
    .sort(
      (a, b) =>
        b.score - a.score || a.entry.title.localeCompare(b.entry.title),
    );

  const top = scored[0];
  const topScore = top?.score ?? 0;
  const topDistinctMatches = top?.distinctMatches ?? 0;
  const abstention =
    topScore < ABSTAIN_SCORE_THRESHOLD ||
    topDistinctMatches < MIN_DISTINCT_MATCHES;

  if (abstention) {
    return {
      ...identityHeader,
      query,
      abstention: true,
      abstention_reason:
        topDistinctMatches < MIN_DISTINCT_MATCHES
          ? `Query matched fewer than ${MIN_DISTINCT_MATCHES} distinct concepts against the worked-example set — too broad to route to a specific example.`
          : "No worked example scores above the confidence threshold. Try phrasing with the specific card, hand, or count in question, or use boardgame_ask_rules for a rules paraphrase.",
      matches: [],
      supported_games: supported.map((game) => game.game_id),
    };
  }

  const matches: ScenarioMatch[] = scored
    .filter(({ score }) => score >= ABSTAIN_SCORE_THRESHOLD)
    .slice(0, limit)
    .map(({ entry, score, distinctMatches }) => ({
      entry_id: entry.id,
      title: entry.title,
      section: entry.section,
      subsection: entry.subsection,
      edition_ids: entry.edition_ids,
      scenario: entry.worked_example!.scenario,
      expected_outcome: entry.worked_example!.expected_outcome,
      decomposition: entry.worked_example!.decomposition,
      score: Math.round(score * 100) / 100,
      distinct_matches: distinctMatches,
      citation: citationFor(entry),
      rights_flags: entry.rights_flags,
    }));

  return {
    ...identityHeader,
    query,
    abstention: false,
    abstention_reason: null,
    matches,
    supported_games: supported.map((game) => game.game_id),
  };
}

/**
 * Count how many entries across all installed corpora expose a worked_example.
 * Used by callers (docs, sanity checks) to know if check_scenario has anything
 * to retrieve against at all.
 */
export function countWorkedExamples(): number {
  return loadCorpora()
    .flatMap((c) => c.entries)
    .filter(hasWorkedExample).length;
}
