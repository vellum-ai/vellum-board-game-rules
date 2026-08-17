import { listSupportedGames, loadCorpora, loadCorpus } from "./corpus.ts";
import {
  citationFor,
  resolveRequest,
  scopedEntries,
  tokenize,
} from "./retrieval-common.ts";
import type { CheckScenarioResult, CorpusEntry, ScenarioMatch } from "./types.ts";

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

function hasWorkedExample(entry: CorpusEntry): boolean {
  return entry.worked_example != null;
}

type Scored = { entry: CorpusEntry; score: number; distinctMatches: number };

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
  const phraseBonus = tokenize(haystack).join(" ").includes(queryTokens.join(" ")) ? 5 : 0;

  // Bonus when query tokens hit the applies_when trigger phrases explicitly.
  const appliesTokenSet = new Set(tokenize(applies.join(" ")));
  let appliesHits = 0;
  for (const token of distinctQueryTokens) {
    if (appliesTokenSet.has(token)) appliesHits += 1;
  }
  const appliesBonus = (appliesHits / distinctQueryTokens.size) * 3;

  return { entry, score: normalizedMatchRatio * 10 + phraseBonus + appliesBonus, distinctMatches };
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

/** Games that have at least one worked example, for the no-game hint. */
function gamesWithWorkedExamples(): string {
  return listSupportedGames()
    .filter((game) => (loadCorpus(game.game_id)?.entries ?? []).some(hasWorkedExample))
    .map((game) => game.game_id)
    .join(", ");
}

export function checkScenario(options: {
  query: string;
  gameId?: string;
  editionId?: string;
  limit?: number;
}): CheckScenarioResult {
  const query = options.query.trim();
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  const request = resolveRequest({
    gameId: options.gameId,
    editionId: options.editionId,
    noGameHint: `Pass game_id; games with worked examples: ${gamesWithWorkedExamples()};`,
  });
  if (!request.ok) {
    return emptyResult({ ...request.identity, query, abstention: true, abstention_reason: request.reason });
  }
  const { corpus, editionId, identity } = request;

  const candidates = scopedEntries(corpus, editionId).filter(hasWorkedExample);
  if (candidates.length === 0) {
    return emptyResult({
      ...identity,
      query,
      abstention: true,
      abstention_reason:
        "No worked examples are available for this game/edition. check_scenario only returns pre-authored examples; try boardgame_ask_rules for general rules lookup.",
    });
  }

  const queryTokens = tokenize(query, true);
  if (queryTokens.length === 0) {
    return emptyResult({ ...identity, query, abstention: true, abstention_reason: "No search terms provided." });
  }

  const scored = candidates
    .map((entry) => scoreEntry(entry, queryTokens))
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));

  const topScore = scored[0]?.score ?? 0;
  const topDistinctMatches = scored[0]?.distinctMatches ?? 0;
  if (topScore < ABSTAIN_SCORE_THRESHOLD || topDistinctMatches < MIN_DISTINCT_MATCHES) {
    return emptyResult({
      ...identity,
      query,
      abstention: true,
      abstention_reason:
        topDistinctMatches < MIN_DISTINCT_MATCHES
          ? `Query matched fewer than ${MIN_DISTINCT_MATCHES} distinct concepts against the worked-example set; too broad to route to a specific example.`
          : "No worked example scores above the confidence threshold. Try phrasing with the specific card, hand, or count in question, or use boardgame_ask_rules for a rules paraphrase.",
    });
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

  return { ...identity, query, abstention: false, abstention_reason: null, matches, supported_games: listSupportedGames().map((game) => game.game_id) };
}

/**
 * Count how many entries across all installed corpora expose a worked_example.
 * Used by callers (docs, sanity checks) to know if check_scenario has anything
 * to retrieve against at all.
 */
export function countWorkedExamples(): number {
  return loadCorpora().flatMap((c) => c.entries).filter(hasWorkedExample).length;
}
