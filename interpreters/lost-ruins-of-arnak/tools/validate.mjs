import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const dataDir = path.join(root, 'data');
const files = fs.readdirSync(dataDir).filter((name) => name.endsWith('.json'));
if (files.length !== 1) throw new Error(`expected exactly one corpus JSON, found ${files.length}`);
const corpus = JSON.parse(fs.readFileSync(path.join(dataDir, files[0]), 'utf8'));

if (!/^\d+\.\d+\.\d+$/.test(corpus.corpus_version)) throw new Error('invalid corpus version');
if (corpus.game !== 'Lost Ruins of Arnak') throw new Error('game identity mismatch');
if (corpus.bgg_snapshot !== false || corpus.snapshot_status?.in_fixed_snapshot !== false) throw new Error('candidate must remain outside fixed snapshot');
if (corpus.full_rulebook_text_included !== false) throw new Error('full_rulebook_text_included must be false');
const artifact = corpus.source_artifact;
if (!artifact?.local_path || !artifact?.metadata_path || !artifact?.checksum_record_path || !artifact?.sha256) throw new Error('source artifact identity is incomplete');
if (artifact.sha256 !== '95b030c9a8694e3bd53f763b98b77fbec7a4053d0223b8c9bbd96612c78315ef') throw new Error('unexpected artifact checksum');
if (artifact.pages !== 24 || artifact.document_type !== 'game manual / rulebook') throw new Error('unexpected artifact metadata');
if (artifact.rights_status !== 'permission_not_established') throw new Error('rights state changed unexpectedly');
if (artifact.full_text_indexing_status !== 'blocked_pending_explicit_permission') throw new Error('indexing guard missing');
if (artifact.redistribution_status !== 'blocked_pending_explicit_permission') throw new Error('redistribution guard missing');
if (artifact.local_use_status !== 'quarantined_for_internal_reference_only') throw new Error('quarantine guard missing');
if (!fs.existsSync(artifact.local_path) || !fs.existsSync(artifact.metadata_path) || !fs.existsSync(artifact.checksum_record_path)) throw new Error('provenance paths must exist');

const editions = new Set((corpus.editions || []).map((e) => e.edition_id));
if (!editions.size) throw new Error('edition scope missing');
const ids = new Set();
const requiredTypes = new Set(['setup', 'play_flow', 'action_types', 'turn_structure', 'worker_placement', 'exploration', 'resources_cards', 'guardians', 'research_track', 'scoring_endgame', 'coverage_boundary']);
const seenTypes = new Set();
for (const entry of corpus.entries || []) {
  if (!entry.id || ids.has(entry.id)) throw new Error(`duplicate or missing entry id: ${entry.id}`);
  ids.add(entry.id);
  if (!entry.title || !entry.summary || entry.summary.length > 900) throw new Error(`invalid summary: ${entry.id}`);
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
console.log(`valid ${corpus.game}: ${corpus.corpus_version}, ${corpus.entries.length} entries, ${editions.size} edition scopes; rights guards and provenance paths present`);
