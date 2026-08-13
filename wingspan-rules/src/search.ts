import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Source = {
  url: string;
  section: string;
  publisher: string;
  rights_status: string;
  full_text_included: boolean;
};

type Edition = {
  edition_id: string;
  game: string;
  scope: string;
  language: string;
  status: string;
  notes: string;
  source_url: string;
  rights_status: string;
  full_text_included: boolean;
};

type InterpretationSchema = {
  version: string;
  description: string;
  required_fields: string[];
  confidence_values: string[];
  rights_policy: string;
};

type RightsFlags = {
  original_interpretation: boolean;
  metadata_only: boolean;
  source_text_stored: boolean;
  full_text_included: boolean;
  redistribution_permitted: boolean;
  internal_only: boolean;
};

type SourceLocator = {
  url?: string;
  publisher?: string;
  locator: string;
  source_kind: string;
  accessed_at: string;
  artifact_path?: string;
  sha256?: string;
  official_source?: boolean;
};

type Entry = {
  id: string;
  title: string;
  kind: string;
  edition_ids: string[];
  topics: string[];
  summary: string;
  source: Source;
  interpretation_type: string;
  confidence: string;
  edition_scope: { edition_ids: string[]; scope_note: string };
  source_locator: SourceLocator;
  rights_flags: RightsFlags;
};

type Corpus = {
  corpus_id: string;
  corpus_version: string;
  generated_at: string;
  description: string;
  full_rulebook_text_included: boolean;
  interpretation_schema: InterpretationSchema;
  default_source: {
    publisher: string;
    title: string;
    url: string;
    accessed_at: string;
    source_type: string;
    rights_status: string;
    permission_note: string;
  };
  editions: Edition[];
  entries: Entry[];
};

const corpusPath = fileURLToPath(new URL("../data/wingspan-corpus.json", import.meta.url));
const corpus = JSON.parse(readFileSync(corpusPath, "utf8")) as Corpus;

export type SearchOptions = {
  query: string;
  editionId?: string;
  topic?: string;
  limit?: number;
};

export function searchCorpus(options: SearchOptions) {
  const queryTokens = options.query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const topic = options.topic?.trim().toLowerCase();
  const editionId = options.editionId?.trim();

  const matches = corpus.entries
    .filter((entry) => !editionId || entry.edition_ids.includes(editionId))
    .filter((entry) => !topic || entry.topics.some((value) => value.toLowerCase() === topic))
    .map((entry) => {
      const haystack = [entry.title, entry.summary, entry.kind, ...entry.topics].join(" ").toLowerCase();
      const score = queryTokens.length === 0
        ? 0
        : queryTokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
      return { entry, score };
    })
    .filter(({ score }) => queryTokens.length === 0 || score > 0)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .slice(0, Math.min(Math.max(options.limit ?? 5, 1), 10));

  return {
    corpus: {
      id: corpus.corpus_id,
      version: corpus.corpus_version,
      generated_at: corpus.generated_at,
      full_rulebook_text_included: corpus.full_rulebook_text_included,
      source: corpus.default_source
    },
    available_editions: corpus.editions,
    matches: matches.map(({ entry, score }) => ({ ...entry, match_score: score }))
  };
}

export function listEditions() {
  return corpus.editions;
}
