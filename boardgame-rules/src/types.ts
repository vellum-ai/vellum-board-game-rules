export type RightsFlags = {
  original_interpretation: boolean;
  metadata_only: boolean;
  source_text_stored: boolean;
  full_text_included: boolean;
  long_quotation_included: boolean;
  redistribution_permitted: boolean;
  internal_only: boolean;
};

export type SourceLocator = {
  url?: string;
  locator: string;
  source_kind?: string;
  source_ref?: string;
  page?: string;
  question?: string;
  accessed_at?: string;
  official_source?: boolean;
};

export type Edition = {
  edition_id: string;
  game: string;
  scope: string;
  language: string;
  status: string;
  /** Optional: the edition this one inherits all base rules from (for expansions/variants that stack on top). */
  inherits?: string | null;
  notes?: string;
  source_url?: string;
  rights_status?: string;
  full_text_included: boolean;
};

export type InterpretationSchema = {
  version: string;
  description: string;
  required_fields: string[];
  confidence_values: string[];
  rights_policy: string;
};

/**
 * A corpus-owned mapping from one rule entry to a game the player may already
 * know. Hooks exist only where the mapping is honest; entries without a real
 * analog carry no hooks, which lets retrieval abstain from analogizing.
 */
export type AnalogHook = {
  known_game_id: string;
  known_game_title: string;
  /** What genuinely transfers from the known game to this rule. */
  likeness: string;
  /** Where the analogy breaks down. Always stated so the analogy is never mistaken for the ruling. */
  exception: string;
};

/**
 * Optional structured worked-example payload used by check_scenario retrieval.
 * Additive: entries without this field are ignored by check_scenario, but still
 * participate in ask_rules retrieval as normal.
 */
export type WorkedExample = {
  /** Natural-language scenario description the user query is matched against. */
  scenario: string;
  /** The ruling / total / outcome (e.g. "Total: 16 points"). */
  expected_outcome: string;
  /** Optional point-by-point breakdown of how the outcome was reached. */
  decomposition?: string[];
};

export type CorpusEntry = {
  id: string;
  title: string;
  kind?: string;
  interpretation_type?: string;
  edition_ids: string[];
  topics?: string[];
  section?: string;
  subsection?: string;
  summary: string;
  confidence: string;
  source_locator: SourceLocator;
  rights_flags: RightsFlags;
  /** Optional. Present only on entries with a real mapping to a common game. */
  analog_hooks?: AnalogHook[];
  /** Optional structured worked example. Only consumed by check_scenario. */
  worked_example?: WorkedExample;
  /** Optional trigger phrases that describe when this entry is relevant. Used by check_scenario retrieval. */
  applies_when?: string[];
};

export type Corpus = {
  corpus_id: string;
  game_title: string;
  corpus_version: string;
  generated_at: string;
  description: string;
  full_rulebook_text_included: boolean;
  coverage_boundary: string;
  interpretation_schema?: InterpretationSchema;
  default_source?: {
    publisher?: string;
    title?: string;
    url?: string;
    accessed_at?: string;
    source_type?: string;
    rights_status?: string;
    permission_note?: string;
  };
  editions: Edition[];
  entries: CorpusEntry[];
};

export type SupportedGame = {
  game_id: string;
  game_title: string;
  corpus_version: string;
  editions: Array<{
    edition_id: string;
    scope: string;
    language: string;
    status: string;
  }>;
  coverage_boundary: string;
  entry_count: number;
  full_rulebook_text_included: boolean;
};

export type Citation = {
  entry_id: string;
  title: string;
  section?: string;
  subsection?: string;
  locator: string;
  url?: string;
  source_kind?: string;
  confidence: string;
};

export type Evidence = {
  entry_id: string;
  title: string;
  summary: string;
  section?: string;
  subsection?: string;
  edition_ids: string[];
  score: number;
  citation: Citation;
  rights_flags: RightsFlags;
};

export type AskResult = {
  game_id: string | null;
  game_title: string | null;
  edition_id: string | null;
  corpus_version: string | null;
  coverage_boundary: string | null;
  query: string;
  abstention: boolean;
  abstention_reason: string | null;
  rights: {
    full_rulebook_text_included: boolean;
    redistribution_permitted: boolean;
  };
  evidence: Evidence[];
  supported_games: string[];
  /**
   * Analog hooks from the top evidence entry, filtered to the caller's known
   * games. Always `[]` when there is no sitting, no known game matches, the
   * entry has no hooks, or the result is an abstention. The citation is the
   * ruling; these are teaching aids only.
   */
  analog_hooks: AnalogHook[];
};

export type ScenarioMatch = {
  entry_id: string;
  title: string;
  section?: string;
  subsection?: string;
  edition_ids: string[];
  scenario: string;
  expected_outcome: string;
  decomposition?: string[];
  score: number;
  distinct_matches: number;
  citation: Citation;
  rights_flags: RightsFlags;
};

export type CheckScenarioResult = {
  game_id: string | null;
  game_title: string | null;
  edition_id: string | null;
  corpus_version: string | null;
  coverage_boundary: string | null;
  query: string;
  abstention: boolean;
  abstention_reason: string | null;
  matches: ScenarioMatch[];
  supported_games: string[];
};

/** The last ruling cited to the table, recorded on the sitting. */
export type SittingRuling = {
  entry_id: string;
  title: string;
  locator: string;
};

/** The last analogy offered at the table, recorded on the sitting. */
export type SittingAnalog = {
  known_game_id: string;
  entry_id: string;
};

/**
 * One sitting = one conversation teaching one game at the table.
 * Persisted under the plugin's `data/` directory keyed by conversation id.
 */
export type Sitting = {
  conversation_id: string;
  game_id: string;
  edition_id: string | null;
  /** Games the players at this sitting already know (normalized ids). */
  known_games: string[];
  last_ruling: SittingRuling | null;
  last_analog: SittingAnalog | null;
  started_at: string;
  updated_at: string;
};
