import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const files = fs.readdirSync(path.join(root, 'data')).filter((name) => name.endsWith('.json'));
if (files.length !== 1) throw new Error(`expected exactly one corpus JSON, found ${files.length}`);
const corpus = JSON.parse(fs.readFileSync(path.join(root, 'data', files[0]), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(corpus.corpus_version)) throw new Error('invalid corpus version');
if (corpus.full_rulebook_text_included !== false) throw new Error('full_rulebook_text_included must be false');
if (!corpus.source_artifact?.local_path || !corpus.source_artifact?.sha256) throw new Error('source artifact identity is incomplete');
if (corpus.source_artifact.rights_status !== 'permission_not_established') throw new Error('rights state changed unexpectedly');
if (corpus.source_artifact.full_text_indexing_status !== 'blocked_pending_explicit_permission') throw new Error('indexing guard missing');
if (corpus.source_artifact.redistribution_status !== 'blocked_pending_explicit_permission') throw new Error('redistribution guard missing');
if (corpus.source_artifact.local_use_status !== 'quarantined_for_internal_reference_only') throw new Error('quarantine guard missing');
const editions = new Set((corpus.editions || []).map((e) => e.edition_id));
if (!editions.size) throw new Error('edition scope missing');
const ids = new Set();
for (const entry of corpus.entries || []) {
  if (!entry.id || ids.has(entry.id)) throw new Error(`duplicate or missing entry id: ${entry.id}`);
  ids.add(entry.id);
  if (!entry.summary || entry.summary.length > 900) throw new Error(`invalid summary: ${entry.id}`);
  if (!['high','medium','low'].includes(entry.confidence)) throw new Error(`invalid confidence: ${entry.id}`);
  if (!Array.isArray(entry.edition_ids) || !entry.edition_ids.length) throw new Error(`edition scope missing: ${entry.id}`);
  for (const edition of entry.edition_ids) if (!editions.has(edition)) throw new Error(`unknown edition ${edition} in ${entry.id}`);
  if (!entry.source_locator?.document_section) throw new Error(`source locator missing: ${entry.id}`);
  if (entry.rights_flags?.full_text_included !== false) throw new Error(`rights guard missing: ${entry.id}`);
  if (entry.rights_flags?.source_text_stored !== false) throw new Error(`source-text guard missing: ${entry.id}`);
}
if (!corpus.entries.some((e) => e.interpretation_type === 'coverage_boundary')) throw new Error('coverage boundary entry missing');
console.log(`valid ${corpus.game}: ${corpus.corpus_version}, ${corpus.entries.length} entries, ${editions.size} edition scopes`);
