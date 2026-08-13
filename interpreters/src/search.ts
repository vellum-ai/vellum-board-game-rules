import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Entry = {
  id: string;
  title: string;
  interpretation_type?: string;
  topics?: string[];
  summary: string;
  edition_ids?: string[];
  confidence?: string;
  source_locator?: Record<string, unknown>;
  rights_flags?: {
    source_text_stored?: boolean;
    full_text_included?: boolean;
    long_quotation_included?: boolean;
    redistribution_permitted?: boolean;
    internal_only?: boolean;
  };
};

type Corpus = {
  corpus_id: string;
  corpus_version: string;
  generated_at?: string;
  game?: string;
  game_title?: string;
  description?: string;
  coverage_boundary?: string;
  coverage_disclaimer?: string;
  full_rulebook_text_included?: boolean;
  editions?: unknown[];
  source_artifact?: Record<string, unknown>;
  entries: Entry[];
};

const root = fileURLToPath(new URL("..", import.meta.url));

function corpusFiles(): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((item) => item.isDirectory() && item.name !== "src" && item.name !== "tools" && item.name !== "data")
    .map((item) => join(root, item.name, "data"))
    .filter((dataDir) => existsSync(dataDir))
    .flatMap((dataDir) => readdirSync(dataDir).filter((name) => name.endsWith("-corpus.json")).map((name) => join(dataDir, name)))
    .sort();
}

function loadCorpora(): Corpus[] {
  return corpusFiles().map((file) => JSON.parse(readFileSync(file, "utf8")) as Corpus);
}

function gameTitle(corpus: Corpus): string {
  return corpus.game ?? corpus.game_title ?? (corpus as any).artifact_provenance?.title ?? (corpus as any).source_artifact?.title ?? corpus.corpus_id;
}

export type SearchOptions = { query: string; gameId?: string; editionId?: string; topic?: string; limit?: number };

export function searchCorpora(options: SearchOptions) {
  const corpora = loadCorpora().filter((corpus) => !options.gameId || corpus.corpus_id === options.gameId || gameTitle(corpus).toLowerCase() === options.gameId.toLowerCase());
  const tokens = options.query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const topic = options.topic?.trim().toLowerCase();
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 25);
  const matches = corpora.flatMap((corpus) => corpus.entries
    .filter((entry) => !options.editionId || entry.edition_ids?.includes(options.editionId))
    .filter((entry) => !topic || entry.topics?.some((value) => value.toLowerCase() === topic))
    .map((entry) => {
      const title = gameTitle(corpus);
      const haystack = [title, entry.title, entry.summary, entry.interpretation_type ?? "", ...(entry.topics ?? [])].join(" ").toLowerCase();
      const score = tokens.length === 0 ? 0 : tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
      return {
        game_id: corpus.corpus_id,
        game_title: title,
        corpus_version: corpus.corpus_version,
        coverage: corpus.coverage_boundary ?? corpus.coverage_disclaimer ?? null,
        document: corpus.source_artifact ? {
          document_type: corpus.source_artifact.document_type ?? null,
          pages: corpus.source_artifact.pages ?? null,
          edition: corpus.source_artifact.edition ?? null,
          rights_status: corpus.source_artifact.rights_status ?? null
        } : null,
        entry,
        match_score: score
      };
    }))
    .filter((result) => tokens.length === 0 || result.match_score > 0)
    .sort((a, b) => b.match_score - a.match_score || a.game_title.localeCompare(b.game_title) || a.entry.title.localeCompare(b.entry.title))
    .slice(0, limit);

  return {
    query: options.query,
    filters: { game_id: options.gameId ?? null, edition_id: options.editionId ?? null, topic: options.topic ?? null, limit },
    available_games: corpora.map((corpus) => ({
      game_id: corpus.corpus_id,
      game_title: gameTitle(corpus),
      corpus_version: corpus.corpus_version,
      entry_count: corpus.entries.length,
      coverage: corpus.coverage_boundary ?? corpus.coverage_disclaimer ?? null
    })),
    matches,
    fallback: {
      live_lookup_recommended: matches.length === 0,
      reason: matches.length === 0
        ? "No local interpretation matched. Consult an authorized current source and verify the edition or document coverage."
        : "Local interpretation found. Use live lookup for exact wording, cards, scenarios, newer printings, or questions outside the declared document coverage."
    }
  };
}

export function listCorpora() {
  return loadCorpora().map((corpus) => ({ corpus_id: corpus.corpus_id, game: gameTitle(corpus), version: corpus.corpus_version, entries: corpus.entries.length }));
}
