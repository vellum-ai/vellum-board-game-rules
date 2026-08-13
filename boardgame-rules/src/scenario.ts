import { listSupportedGames, loadCorpus } from "./corpus.ts";
import { tokenize } from "./retrieve.ts";
import type {
  CheckScenarioResult,
  Citation,
  Corpus,
  CorpusEntry,
  ScenarioMatch,
} from "./types.ts";

// Scenario retrieval is stricter than general ask retrieval: worked examples
// are narrow by design, so we require both a higher normalized score AND a
// minimum number of distinct query tokens matched. The distinct-match floor
// exists because the score is normalized by query length — a one-word scenario
// like "cribbage" would otherwise score 10 (plus phrase bonus) from a single
// filler-token hit and clear the normalized threshold.
const ABSTAIN_THRESHOLD = 4.0;
const MIN_DISTINCT_MATCHES = 2;
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 5;

function isWorkedExample(entry: CorpusEntry): boolean {
  return entry.kind === "worked_example" || entry.kind === "example_walkthrough" || !!entry.worked_example;
}

type ScoredEntry = { entry: CorpusEntry; score: number; distinctMatches: number };

function scoreForScenario(entry: CorpusEntry, queryTokens: string[]): ScoredEntry {
  const worked = entry.worked_example;
  const haystackParts: string[] = [
    entry.title,
    entry.summary,
    entry.section ?? "",
    entry.subsection ?? "",
    ...(entry.topics ?? []),
    ...(entry.applies_when ?? []),
  ];
  if (worked) {
    haystackParts.push(worked.scenario, worked.expected_outcome);
    if (worked.decomposition) haystackParts.push(...worked.decomposition);
  }
  const tokens = tokenize(haystackParts.join(" "));
  const tokenSet = new Set(tokens);
  const distinctQueryTokens = new Set(queryTokens);
  let distinctMatches = 0;
  for (const token of distinctQueryTokens) {
    if (tokenSet.has(token)) distinctMatches += 1;
  }
  const phraseBonus = tokens.join(" ").includes(queryTokens.join(" ")) ? 5 : 0;
  const score = (distinctMatches / distinctQueryTokens.size) * 10 + phraseBonus;
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

function emptyScenario(
  partial: Partial<CheckScenarioResult> & Pick<CheckScenarioResult, "scenario" | "abstention" | "abstention_reason">,
): CheckScenarioResult {
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
    matches: [],
    supported_games: listSupportedGames().map((game) => game.game_id),
    ...partial,
  };
}

function resolveEdition(corpus: Corpus, editionId?: string): string | null {
  if (editionId) {
    return corpus.editions.some((edition) => edition.edition_id === editionId) ? editionId : null;
  }
  return corpus.editions[0]?.edition_id ?? null;
}

export function checkScenario(options: {
  scenario: string;
  gameId?: string;
  editionId?: string;
  limit?: number;
}): CheckScenarioResult {
  const scenario = options.scenario.trim();
  const requestedLimit = options.limit ?? DEFAULT_LIMIT;
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);
  const supported = listSupportedGames();

  if (supported.length === 0) {
    return emptyScenario({
      scenario,
      abstention: true,
      abstention_reason: "No game corpora are installed.",
    });
  }

  const gameId = options.gameId?.trim() || supported[0].game_id;
  const corpus = loadCorpus(gameId);
  if (!corpus) {
    return emptyScenario({
      scenario,
      game_id: gameId,
      abstention: true,
      abstention_reason: `Game '${gameId}' is not supported. Supported games: ${supported.map((game) => game.game_id).join(", ")}`,
    });
  }

  const editionId = resolveEdition(corpus, options.editionId);
  if (options.editionId && !editionId) {
    return emptyScenario({
      scenario,
      game_id: corpus.corpus_id,
      game_title: corpus.game_title,
      corpus_version: corpus.corpus_version,
      coverage_boundary: corpus.coverage_boundary,
      abstention: true,
      abstention_reason: `Unknown edition_id '${options.editionId}'. Available editions: ${corpus.editions.map((edition) => edition.edition_id).join(", ")}`,
    });
  }

  const workedExamples = corpus.entries
    .filter(isWorkedExample)
    .filter((entry) => !editionId || entry.edition_ids.includes(editionId));

  const partial = {
    game_id: corpus.corpus_id,
    game_title: corpus.game_title,
    edition_id: editionId,
    corpus_version: corpus.corpus_version,
    coverage_boundary: corpus.coverage_boundary,
    rights: {
      full_rulebook_text_included: corpus.full_rulebook_text_included === true,
      redistribution_permitted: false,
    },
    supported_games: supported.map((game) => game.game_id),
  };

  if (workedExamples.length === 0) {
    return {
      ...emptyScenario({
        scenario,
        abstention: true,
        abstention_reason: `No worked examples are available for ${corpus.game_title}. Try boardgame_ask_rules for a rules answer instead.`,
      }),
      ...partial,
    };
  }

  const queryTokens = tokenize(scenario);
  if (queryTokens.length === 0) {
    return {
      ...emptyScenario({
        scenario,
        abstention: true,
        abstention_reason: "No scenario text provided.",
      }),
      ...partial,
    };
  }

  const scored = workedExamples
    .map((entry) => scoreForScenario(entry, queryTokens))
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));
  const top = scored[0];
  const topScore = top?.score ?? 0;
  const topDistinctMatches = top?.distinctMatches ?? 0;
  const abstention =
    topScore < ABSTAIN_THRESHOLD || topDistinctMatches < MIN_DISTINCT_MATCHES;

  if (abstention) {
    return {
      ...emptyScenario({
        scenario,
        abstention: true,
        abstention_reason:
          "No worked example in the current corpus matches this scenario. This tool only returns pre-authored worked examples; try boardgame_ask_rules for a general rule.",
      }),
      ...partial,
    };
  }

  const matches: ScenarioMatch[] = scored
    .filter(({ score, distinctMatches }) => score > 0 && distinctMatches >= MIN_DISTINCT_MATCHES)
    .slice(0, limit)
    .map(({ entry, score }) => {
      const worked = entry.worked_example ?? {
        scenario: entry.summary,
        expected_outcome: "",
        decomposition: [] as string[],
      };
      return {
        entry_id: entry.id,
        title: entry.title,
        scenario_text: worked.scenario,
        expected_outcome: worked.expected_outcome,
        decomposition: worked.decomposition ?? [],
        summary: entry.summary,
        edition_ids: entry.edition_ids,
        score: Math.round(score * 100) / 100,
        citation: citationFor(entry),
        rights_flags: entry.rights_flags,
      };
    });

  return {
    scenario,
    abstention: false,
    abstention_reason: null,
    matches,
    ...partial,
  };
}
