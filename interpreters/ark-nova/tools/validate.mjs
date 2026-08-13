import fs from "node:fs";
import path from "node:path";
const root = path.resolve(new URL("..", import.meta.url).pathname);
const files = fs.readdirSync(path.join(root, "data")).filter((f) => f.endsWith("-corpus.json"));
if (files.length !== 1) throw new Error(`expected one corpus JSON, found ${files.length}`);
const corpus = JSON.parse(fs.readFileSync(path.join(root, "data", files[0]), "utf8"));
if (corpus.corpus_version !== "0.2.0") throw new Error("unexpected corpus version");
if (corpus.full_rulebook_text_included !== false) throw new Error("full rulebook text guard failed");
const artifacts = [];
if (corpus.artifact_provenance?.local_path && corpus.artifact_provenance?.sha256) artifacts.push(corpus.artifact_provenance);
for (const artifact of corpus.source_artifacts ?? []) {
  if (!artifact.local_path || !artifact.sha256) throw new Error("source artifact locator/checksum missing");
  artifacts.push(artifact);
}
if (artifacts.length < 2) throw new Error("expected preserved Zoo Guide and added rulebook artifacts");
const artifactByPath = new Map(artifacts.map((a) => [a.local_path, a]));
const editions = new Set((corpus.editions ?? []).map((e) => e.edition_id));
const ids = new Set();
for (const e of corpus.entries ?? []) {
  if (!e.id || ids.has(e.id)) throw new Error(`duplicate/missing entry id: ${e.id}`);
  ids.add(e.id);
  if (!e.summary || e.summary.length > 1000) throw new Error(`summary missing/too long: ${e.id}`);
  if (!Array.isArray(e.edition_ids) || e.edition_ids.length < 1 || e.edition_ids.some((id) => !editions.has(id))) throw new Error(`edition scope invalid: ${e.id}`);
  const artifactPath = e.source_locator?.artifact_path;
  const artifact = artifactByPath.get(artifactPath);
  if (!artifact || e.source_locator?.sha256 !== artifact.sha256) throw new Error(`locator/checksum mismatch: ${e.id}`);
  const rights = e.rights_flags ?? {};
  if (rights.source_text_stored === true || rights.full_text_included === true || rights.long_quotation_included === true || rights.artwork_included === true || rights.redistribution_permitted === true) throw new Error(`rights guard failed: ${e.id}`);
  if (!['high','medium','low'].includes(e.confidence)) throw new Error(`confidence invalid: ${e.id}`);
}
if (!ids.size) throw new Error("corpus has no entries");
console.log(`valid ${corpus.corpus_id} ${corpus.corpus_version}: ${ids.size} entries, ${editions.size} editions, ${artifactByPath.size} artifacts; full text excluded`);
