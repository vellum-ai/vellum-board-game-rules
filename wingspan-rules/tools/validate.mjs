import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const corpus = JSON.parse(fs.readFileSync(path.join(root, 'data/wingspan-corpus.json'), 'utf8'));
if (corpus.full_rulebook_text_included !== false) throw new Error('full_rulebook_text_included must be false');
if (corpus.corpus_version !== '0.2.0') throw new Error(`unexpected corpus version: ${corpus.corpus_version}`);
const editionIds = new Set(corpus.editions.map((e) => e.edition_id));
const entryIds = new Set();
for (const entry of corpus.entries) {
  if (entryIds.has(entry.id)) throw new Error(`duplicate entry id: ${entry.id}`);
  entryIds.add(entry.id);
  if (!entry.summary || entry.summary.length > 900) throw new Error(`invalid summary: ${entry.id}`);
  if (!entry.source || entry.source.full_text_included !== false) throw new Error(`rights guard missing: ${entry.id}`);
  if (!Array.isArray(entry.edition_ids) || entry.edition_ids.length === 0) throw new Error(`edition scope missing: ${entry.id}`);
  for (const id of entry.edition_ids) if (!editionIds.has(id)) throw new Error(`unknown edition ${id} in ${entry.id}`);
}
const card = corpus.entries.find((e) => e.id === 'metadata-base-card-count');
if (!card || card.edition_ids.includes('base-en-current-printing')) throw new Error('212-card figure incorrectly scoped to current printing');
const internal = corpus.entries.find((e) => e.id === 'metadata-reference-marker-2021-r23');
if (!internal || internal.rights_flags?.full_text_included !== false || internal.rights_flags?.internal_only !== true) throw new Error('internal artifact guard missing');
console.log(`valid Wingspan corpus ${corpus.corpus_version}: ${corpus.entries.length} entries, ${corpus.editions.length} editions`);
