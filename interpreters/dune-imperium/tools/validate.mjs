import fs from "node:fs";
import path from "node:path";
const root = path.resolve(new URL("..", import.meta.url).pathname);
const files = fs.readdirSync(path.join(root, "data")).filter((f) => f.endsWith("-corpus.json"));
if (files.length !== 1) throw new Error(`expected one corpus JSON, found ${files.length}`);
const corpus = JSON.parse(fs.readFileSync(path.join(root, "data", files[0]), "utf8"));
if (corpus.corpus_version !== "0.1.0") throw new Error("unexpected corpus version");
if (corpus.full_rulebook_text_included !== false) throw new Error("full rulebook text guard failed");
if (!corpus.artifact_provenance?.local_path || !corpus.artifact_provenance?.sha256) throw new Error("artifact locator/checksum missing");
const editions = new Set((corpus.editions ?? []).map((e) => e.edition_id));
const ids = new Set();
for (const e of corpus.entries ?? []) {
  if (!e.id || ids.has(e.id)) throw new Error(`duplicate/missing entry id: ${e.id}`);
  ids.add(e.id);
  if (!e.summary || e.summary.length > 1000) throw new Error(`summary missing/too long: ${e.id}`);
  if (!Array.isArray(e.edition_ids) || e.edition_ids.length < 1 || e.edition_ids.some((id) => !editions.has(id))) throw new Error(`edition scope invalid: ${e.id}`);
  if (e.source_locator?.artifact_path !== corpus.artifact_provenance.local_path) throw new Error(`locator mismatch: ${e.id}`);
  if (e.source_locator?.sha256 !== corpus.artifact_provenance.sha256) throw new Error(`checksum mismatch: ${e.id}`);
  if (e.rights_flags?.source_text_stored !== false || e.rights_flags?.full_text_included !== false || e.rights_flags?.redistribution_permitted !== false) throw new Error(`rights guard failed: ${e.id}`);
  if (!['high','medium','low'].includes(e.confidence)) throw new Error(`confidence invalid: ${e.id}`);
}
if (!ids.size) throw new Error("corpus has no entries");
console.log(`valid ${corpus.corpus_id} ${corpus.corpus_version}: ${ids.size} entries, ${editions.size} editions; full text excluded`);
