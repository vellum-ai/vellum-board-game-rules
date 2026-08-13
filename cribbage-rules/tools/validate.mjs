import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const corpus = JSON.parse(fs.readFileSync(path.join(root, 'data/cribbage-corpus.json'), 'utf8'));
if (corpus.full_rulebook_text_included !== false) throw new Error('full_rulebook_text_included must be false');
if (corpus.corpus_version !== '0.1.0') throw new Error(`unexpected corpus version: ${corpus.corpus_version}`);
const editionIds = new Set(corpus.editions.map((e) => e.edition_id));
const requiredEditions = ['two-player-standard-en', 'muggins-variant', 'shorter-61-en', 'skunk-rule-variant'];
for (const id of requiredEditions) if (!editionIds.has(id)) throw new Error(`missing required edition: ${id}`);
const entryIds = new Set();
for (const entry of corpus.entries) {
  if (entryIds.has(entry.id)) throw new Error(`duplicate entry id: ${entry.id}`);
  entryIds.add(entry.id);
  if (!entry.summary || entry.summary.length > 900) throw new Error(`invalid summary: ${entry.id}`);
  if (!entry.source || entry.source.full_text_included !== false) throw new Error(`rights guard missing: ${entry.id}`);
  if (!Array.isArray(entry.edition_ids) || entry.edition_ids.length === 0) throw new Error(`edition scope missing: ${entry.id}`);
  for (const id of entry.edition_ids) if (!editionIds.has(id)) throw new Error(`unknown edition ${id} in ${entry.id}`);
  if (!entry.rights_flags || entry.rights_flags.full_text_included !== false || entry.rights_flags.redistribution_permitted !== false) {
    throw new Error(`rights_flags missing or unsafe: ${entry.id}`);
  }
}
// Sanity-check that the standard game and each variant are actually represented
const scopeCoverage = new Set();
for (const entry of corpus.entries) for (const id of entry.edition_ids) scopeCoverage.add(id);
for (const id of requiredEditions) if (!scopeCoverage.has(id)) throw new Error(`no entries scoped to edition: ${id}`);
// Perfect 29 is the marquee example; make sure it survives future edits
const perfect29 = corpus.entries.find((e) => e.id === 'counting-perfect-29');
if (!perfect29 || !/29/.test(perfect29.summary)) throw new Error('counting-perfect-29 entry missing or malformed');
console.log(`valid Cribbage corpus ${corpus.corpus_version}: ${corpus.entries.length} entries, ${corpus.editions.length} editions`);
