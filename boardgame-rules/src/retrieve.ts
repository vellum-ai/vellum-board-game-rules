import { listSupportedGames } from "./corpus.ts";
import {
  citationFor,
  resolveRequest,
  scopedEntries,
  tokenize,
} from "./retrieval-common.ts";
import type { SemanticScores } from "./semantic.ts";
import { normalizeKnownGames } from "./sitting.ts";
import type { AnalogHook, AskResult, CorpusEntry, Evidence } from "./types.ts";

/**
 * Scoring for ask_rules.
 *
 * Lexical: token overlap ratio, a phrase bonus, and a title bonus. Semantic:
 * when the caller supplies similarity scores from the host's plugin index
 * (see semantic.ts), each entry's lexical score is boosted by
 * SEMANTIC_WEIGHT * (similarity - background), where background is the
 * MEDIAN similarity across the returned entries. Hybrid-fusion scores are
 * relative, not absolute: an off-domain query scores ~0.3 against
 * EVERYTHING (no entry stands out), while a real paraphrase scores its true
 * entry well above the pack. Subtracting the median makes only the
 * discriminative part count, so uniform noise adds ~0 and cannot lift
 * near-threshold nonsense over ABSTAIN_THRESHOLD, while a stand-out entry
 * gains the full lift. SEMANTIC_MIN_MARGIN additionally requires the
 * stand-out to be meaningful (typical real paraphrases sit 0.2-0.4 over
 * background; off-domain brushes ~0.1). Absent scores = pure lexical.
 *
 * The host index is hybrid dense+sparse and its sparse branch is itself
 * lexical, so any genuine word-overlap match also stands out semantically;
 * that is why no separate lexical "strong match" override is needed here.
 */
const ABSTAIN_THRESHOLD = 5.5;
const SEMANTIC_WEIGHT = 8;
const SEMANTIC_MIN_MARGIN = 0.15;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function lexicalScore(entry: CorpusEntry, queryTokens: string[]): number {
  const haystack = [entry.title, entry.summary, entry.section ?? "", entry.subsection ?? "", ...(entry.topics ?? [])].join(" ");
  const tokens = tokenize(haystack);
  const tokenSet = new Set(tokens);
  const matches = queryTokens.reduce((total, token) => total + (tokenSet.has(token) ? 1 : 0), 0);
  const phraseBonus = tokens.join(" ").includes(queryTokens.join(" ")) ? 5 : 0;
  const titleTokens = new Set(tokenize(entry.title));
  const titleMatches = queryTokens.reduce((total, token) => total + (titleTokens.has(token) ? 1 : 0), 0);
  const titleBonus = (titleMatches / queryTokens.length) * 5;
  return (matches / queryTokens.length) * 10 + phraseBonus + titleBonus;
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
    retrieval_mode: "lexical",
    lexical_evidence_count: 0,
    // Every emptyAsk caller is an input-error abstention; the coverage
    // abstention is the scored return path below.
    abstention_kind: "input",
    ...partial,
  };
}

/**
 * Analog hooks for the top evidence entry, filtered to games the caller's
 * sitting knows. Abstention always wins: an abstained result never
 * analogizes. No known games, or no hook for a known game, returns [];
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

export function askRules(options: {
  query: string;
  gameId?: string;
  editionId?: string;
  limit?: number;
  /** Games the current sitting's players already know. Enables analog_hooks on the result. */
  knownGames?: string[];
  /**
   * Optional semantic similarity per entry_id (0..1) from the plugin index.
   * Fused into the lexical score; omit for pure lexical retrieval. Kept as an
   * input so this function stays synchronous and deterministic to test.
   */
  semanticScores?: SemanticScores;
}): AskResult {
  const query = options.query.trim();
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  const request = resolveRequest({
    gameId: options.gameId,
    editionId: options.editionId,
    noGameHint: () => "Pass game_id (or start a sitting);",
  });
  if (!request.ok) {
    return emptyAsk({ ...request.identity, query, abstention: true, abstention_reason: request.reason });
  }
  const { corpus, editionId, identity } = request;

  const queryTokens = tokenize(query, true);
  if (queryTokens.length === 0) {
    return emptyAsk({ ...identity, query, abstention: true, abstention_reason: "No search terms provided." });
  }

  const semantic = options.semanticScores;
  const semanticBackground = semantic ? medianOf([...semantic.values()]) : 0;
  const scored = scopedEntries(corpus, editionId)
    .map((entry) => {
      const lexical = lexicalScore(entry, queryTokens);
      const similarity = semantic?.get(entry.id) ?? 0;
      const margin = similarity - semanticBackground;
      const discriminative = margin >= SEMANTIC_MIN_MARGIN ? margin : 0;
      return { entry, lexical, score: lexical + SEMANTIC_WEIGHT * discriminative };
    })
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));

  const abstention = (scored[0]?.score ?? 0) < ABSTAIN_THRESHOLD;
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
    ...identity,
    query,
    retrieval_mode: semantic !== undefined && semantic.size > 0 ? "hybrid" : "lexical",
    lexical_evidence_count: scored.filter(({ lexical }) => lexical > 0).length,
    abstention,
    abstention_kind: abstention ? "coverage" : null,
    abstention_reason: abstention
      ? "No sufficiently matching rule is in the current corpus. The question may be outside coverage, or phrased differently than the fixture entries."
      : null,
    rights: {
      full_rulebook_text_included: corpus.full_rulebook_text_included === true,
      redistribution_permitted: false,
    },
    evidence,
    supported_games: listSupportedGames().map((game) => game.game_id),
    analog_hooks: analogHooksFor(scored[0]?.entry, abstention, options.knownGames),
  };
}
