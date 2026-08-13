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
  notes?: string;
  source_url?: string;
  rights_status?: string;
  full_text_included: boolean;
};

export type WorkedExample = {
  scenario: string;
  expected_outcome: string;
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
  applies_when?: string[];
  worked_example?: WorkedExample;
  source_locator: SourceLocator;
  rights_flags: RightsFlags;
};

export type Corpus = {
  corpus_id: string;
  game_title: string;
  corpus_version: string;
  generated_at: string;
  description: string;
  full_rulebook_text_included: boolean;
  coverage_boundary: string;
  /**
   * When true, this corpus is used as the plugin's default game when no
   * game_id is provided. Exactly one corpus should carry this flag. Falling
   * back to filesystem order is a footgun (adding a new corpus alphabetically
   * before the current default silently changes behavior), so retrieval
   * prefers is_default over sort order.
   */
  is_default?: boolean;
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

export type ScenarioMatch = {
  entry_id: string;
  title: string;
  scenario_text: string;
  expected_outcome: string;
  decomposition: string[];
  summary: string;
  edition_ids: string[];
  score: number;
  citation: Citation;
  rights_flags: RightsFlags;
};

export type CheckScenarioResult = {
  game_id: string | null;
  game_title: string | null;
  edition_id: string | null;
  corpus_version: string | null;
  coverage_boundary: string | null;
  scenario: string;
  abstention: boolean;
  abstention_reason: string | null;
  rights: {
    full_rulebook_text_included: boolean;
    redistribution_permitted: boolean;
  };
  matches: ScenarioMatch[];
  supported_games: string[];
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
};
