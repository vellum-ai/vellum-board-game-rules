import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const dataDir = path.join(root, 'data');
const files = fs.readdirSync(dataDir).filter((name) => name.endsWith('.json'));
if (files.length !== 1) throw new Error(`expected exactly one corpus JSON, found ${files.length}`);
const corpus = JSON.parse(fs.readFileSync(path.join(dataDir, files[0]), 'utf8'));

if (!/^\d+\.\d+\.\d+$/.test(corpus.corpus_version)) throw new Error('invalid corpus version');
if (corpus.game !== 'Nemesis') throw new Error('game identity mismatch');
if (corpus.bgg_snapshot !== false) throw new Error('candidate must remain outside fixed snapshot');
if (corpus.full_rulebook_text_included !== false) throw new Error('full_rulebook_text_included must be false');
if (!corpus.source_artifact?.local_path || !corpus.source_artifact?.sha256) throw new Error('source artifact identity is incomplete');
if (corpus.source_artifact.sha256 !== '52e9c285521f2351872b24326fbc5171685b42d32de5b9d405249d64827255ac') throw new Error('unexpected artifact checksum');
if (corpus.source_artifact.pages !== 28) throw new Error('expected 28-page artifact metadata');
if (corpus.source_artifact.rights_status !== 'permission_not_established') throw new Error('rights state changed unexpectedly');
if (corpus.source_artifact.full_text_indexing_status !== 'blocked_pending_explicit_permission') throw new Error('indexing guard missing');
if (corpus.source_artifact.redistribution_status !== 'blocked_pending_explicit_permission') throw new Error('redistribution guard missing');
if (corpus.source_artifact.local_use_status !== 'quarantined_for_internal_reference_only') throw new Error('quarantine guard missing');

const editions = new Set((corpus.editions || []).map((e) => e.edition_id));
if (!editions.size) throw new Error('edition scope missing');
const ids = new Set();
const requiredTypes = new Set(['setup', 'play_flow', 'action_restriction', 'movement', 'encounter_combat', 'escape_death', 'contamination_injury', 'items_search_crafting', 'victory_structure', 'coverage_boundary']);
const seenTypes = new Set();
for (const entry of corpus.entries || []) {
  if (!entry.id || ids.has(entry.id)) throw new Error(`duplicate or missing entry id: ${entry.id}`);
  ids.add(entry.id);
  if (!entry.summary || entry.summary.length > 900) throw new Error(`invalid summary: ${entry.id}`);
  if (!['high', 'medium', 'low'].includes(entry.confidence)) throw new Error(`invalid confidence: ${entry.id}`);
  if (!Array.isArray(entry.edition_ids) || !entry.edition_ids.length) throw new Error(`edition scope missing: ${entry.id}`);
  for (const edition of entry.edition_ids) if (!editions.has(edition)) throw new Error(`unknown edition ${edition} in ${entry.id}`);
  if (!entry.source_locator?.document_section || !entry.source_locator?.page_locator) throw new Error(`source locator missing: ${entry.id}`);
  if (entry.rights_flags?.source_text_stored !== false) throw new Error(`source-text guard missing: ${entry.id}`);
  if (entry.rights_flags?.full_text_included !== false) throw new Error(`full-text guard missing: ${entry.id}`);
  if (entry.rights_flags?.long_quotation_included !== false) throw new Error(`quotation guard missing: ${entry.id}`);
  if (entry.rights_flags?.artwork_included !== false) throw new Error(`artwork guard missing: ${entry.id}`);
  seenTypes.add(entry.interpretation_type);
}
for (const type of requiredTypes) if (!seenTypes.has(type)) throw new Error(`required coverage type missing: ${type}`);
if ((corpus.entries || []).length < 10) throw new Error('corpus is too small for requested coverage');
console.log(`valid ${corpus.game}: ${corpus.corpus_version}, ${corpus.entries.length} entries, ${editions.size} edition scopes`);
