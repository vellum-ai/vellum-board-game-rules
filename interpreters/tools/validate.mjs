import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(new URL('..', import.meta.url).pathname);
let gameCount = 0;
let corpusCount = 0;
const ids = new Set();
for (const dir of fs.readdirSync(root, { withFileTypes: true }).filter((x) => x.isDirectory() && !['src', 'tools', 'data'].includes(x.name))) {
  const dataDir = path.join(root, dir.name, 'data');
  if (!fs.existsSync(dataDir)) continue;
  const files = fs.readdirSync(dataDir).filter((name) => name.endsWith('-corpus.json'));
  if (files.length !== 1) throw new Error(`${dir.name}: expected exactly one corpus file, found ${files.length}`);
  const file = path.join(dataDir, files[0]);
  const corpus = JSON.parse(fs.readFileSync(file, 'utf8'));
  const gameTitle = corpus.game ?? corpus.game_title ?? corpus.artifact_provenance?.title ?? corpus.source_artifact?.title;
  if (!corpus.corpus_id || !corpus.corpus_version || !gameTitle || !Array.isArray(corpus.entries)) throw new Error(`invalid corpus shape: ${file}`);
  if (ids.has(corpus.corpus_id)) throw new Error(`duplicate corpus_id: ${corpus.corpus_id}`);
  ids.add(corpus.corpus_id);
  if (corpus.full_rulebook_text_included === true) throw new Error(`full text enabled: ${file}`);
  for (const entry of corpus.entries) {
    if (!entry.id || !entry.title || !entry.summary) throw new Error(`invalid entry in ${file}`);
    const rights = entry.rights_flags ?? {};
    if (rights.source_text_stored === true || rights.full_text_included === true || rights.long_quotation_included === true || rights.redistribution_permitted === true) throw new Error(`rights violation: ${file}#${entry.id}`);
  }
  gameCount++;
  corpusCount += corpus.entries.length;
}
if (gameCount === 0) throw new Error('no game corpora discovered');
console.log(`valid shared interpreter index: ${gameCount} game corpora, ${corpusCount} entries`);
