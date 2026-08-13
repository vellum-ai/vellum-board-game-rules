import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Corpus, SupportedGame } from "./types.ts";

const pluginRoot = fileURLToPath(new URL("..", import.meta.url));
const corporaDir = join(pluginRoot, "corpora");

export function listCorpusFiles(): string[] {
  if (!existsSync(corporaDir)) return [];
  return readdirSync(corporaDir)
    .filter((name) => name.endsWith(".json") && name !== "eval.json")
    .map((name) => join(corporaDir, name))
    .sort();
}

export function loadCorpora(): Corpus[] {
  return listCorpusFiles().map((file) => JSON.parse(readFileSync(file, "utf8")) as Corpus);
}

export function loadCorpus(gameId: string): Corpus | undefined {
  const needle = gameId.trim().toLowerCase();
  return loadCorpora().find((corpus) => {
    return (
      corpus.corpus_id.toLowerCase() === needle ||
      corpus.game_title.toLowerCase() === needle
    );
  });
}

export function listSupportedGames(): SupportedGame[] {
  return loadCorpora().map((corpus) => ({
    game_id: corpus.corpus_id,
    game_title: corpus.game_title,
    corpus_version: corpus.corpus_version,
    editions: corpus.editions.map((edition) => ({
      edition_id: edition.edition_id,
      scope: edition.scope,
      language: edition.language,
      status: edition.status,
    })),
    coverage_boundary: corpus.coverage_boundary,
    entry_count: corpus.entries.length,
    full_rulebook_text_included: corpus.full_rulebook_text_included === true,
    source_audit_status: corpus.source_audit?.audit_status ?? null,
    rights_note: corpus.source_audit?.rights_note ?? null,
  }));
}

export function pluginRootDir(): string {
  return pluginRoot;
}
