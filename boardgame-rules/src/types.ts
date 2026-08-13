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
};

export type Corpus = {
  corpus_id: string;
  game_title: string;
  corpus_version: string;
  generated_at: string;
  description: string;
  full_rulebook_text_included: boolean;
  coverage_boundary: string;
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
};
