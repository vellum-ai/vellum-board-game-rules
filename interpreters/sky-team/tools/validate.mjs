import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const corpusPath = path.join(root, 'data', 'sky-team-corpus.json');
const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));

if (!/^\d+\.\d+\.\d+$/.test(corpus.corpus_version)) throw new Error('invalid corpus version');
if (corpus.game !== 'Sky Team') throw new Error('game identity mismatch');
if (corpus.bgg_snapshot !== false || corpus.snapshot_status !== 'not_in_fixed_top_50_snapshot') throw new Error('snapshot status must remain outside fixed snapshot');
if (corpus.full_rulebook_text_included !== false) throw new Error('full_rulebook_text_included must be false');
const artifact = corpus.source_artifact;
if (!artifact?.local_path || !artifact?.sha256 || !artifact?.metadata_path || !artifact?.checksum_record_path) throw new Error('source artifact identity is incomplete');
if (!fs.existsSync(artifact.local_path)) throw new Error(`artifact missing: ${artifact.local_path}`);
const actualHash = crypto.createHash('sha256').update(fs.readFileSync(artifact.local_path)).digest('hex');
if (actualHash !== artifact.sha256) throw new Error(`artifact checksum mismatch: expected ${artifact.sha256}, got ${actualHash}`);
if (artifact.pages !== 12 || artifact.document_type !== 'game rulebook / basic-game landing-procedure booklet') throw new Error('artifact document metadata mismatch');
if (artifact.rights_status !== 'permission_not_established') throw new Error('rights state changed unexpectedly');
if (artifact.full_text_indexing_status !== 'blocked_pending_explicit_permission') throw new Error('indexing guard missing');
if (artifact.redistribution_status !== 'blocked_pending_explicit_permission') throw new Error('redistribution guard missing');
if (artifact.artwork_redistribution_status !== 'blocked_pending_explicit_permission') throw new Error('artwork guard missing');
if (artifact.local_use_status !== 'quarantined_for_internal_reference_only') throw new Error('quarantine guard missing');

const editions = new Set((corpus.editions || []).map((e) => e.edition_id));
if (!editions.size) throw new Error('edition scope missing');
const ids = new Set();
const requiredTypes = new Set([
  'setup', 'play_flow', 'action_timing', 'dice_placement', 'communication_restriction',
  'dice_resolution', 'role_flow', 'mandatory_action', 'landing_sequence',
  'win_condition', 'loss_condition', 'coverage_boundary'
]);
const seenTypes = new Set();
for (const entry of corpus.entries || []) {
  if (!entry.id || ids.has(entry.id)) throw new Error(`duplicate or missing entry id: ${entry.id}`);
  ids.add(entry.id);
  if (!entry.title || !entry.summary || entry.summary.length > 900) throw new Error(`invalid summary: ${entry.id}`);
  if (!['high', 'medium', 'low'].includes(entry.confidence)) throw new Error(`invalid confidence: ${entry.id}`);
  if (!Array.isArray(entry.edition_ids) || !entry.edition_ids.length) throw new Error(`edition scope missing: ${entry.id}`);
  for (const edition of entry.edition_ids) if (!editions.has(edition)) throw new Error(`unknown edition ${edition} in ${entry.id}`);
  if (!entry.source_locator?.document_section || !entry.source_locator?.page_locator) throw new Error(`source locator missing: ${entry.id}`);
  const rights = entry.rights_flags || {};
  for (const key of ['source_text_stored', 'full_text_included', 'long_quotation_included', 'artwork_included']) {
    if (rights[key] !== false) throw new Error(`${key} guard missing: ${entry.id}`);
  }
  if (rights.redistribution_permitted === true) throw new Error(`redistribution guard violated: ${entry.id}`);
  seenTypes.add(entry.interpretation_type);
}
for (const type of requiredTypes) if (!seenTypes.has(type)) throw new Error(`required coverage type missing: ${type}`);
if ((corpus.entries || []).length < 12) throw new Error('corpus is too small for requested coverage');
console.log(`valid ${corpus.game}: ${corpus.corpus_version}, ${corpus.entries.length} entries, ${editions.size} edition scopes, checksum ${actualHash}`);
