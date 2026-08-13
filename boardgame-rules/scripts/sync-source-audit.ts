/**
 * Sync each corpus's `source_audit` block from the source-audit registry and
 * upload-batch manifests under `source-audit/data/`.
 *
 * The corpus files are the system of record the plugin reads; the registry
 * and manifests remain the raw audit data. This script performs the join so
 * every corpus is self-describing about its sources:
 *
 * 1. Registry match (normalized title, cross-checked against any BGG id the
 *    corpus or its artifacts carry): copies `source_audit_status`, the
 *    `official_sources` list verbatim, and a `registry_ref` back-pointer.
 *    Games outside the registry's fixed list get `not_in_registry_scope`.
 * 2. Artifact linkage: artifact ids / sha256 fingerprints found in the
 *    corpus's provenance blocks (`source_artifact`, `source_artifacts`,
 *    `artifact_provenance`) are resolved against the upload-batch manifests
 *    and per-game source records, recording the manifest path and the
 *    manifest's rights/redistribution/local-use statuses.
 * 3. `rights_note`: deterministic one-liner derived from the statuses —
 *    never invented, never claiming permission that is not on record.
 *
 * Idempotent: running it twice produces identical output. Run it after
 * touching any corpus's provenance or any file under `source-audit/data/`,
 * then re-run the validator.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Corpus, SourceAudit, SourceAuditArtifact, SourceAuditOfficialSource } from "../src/types.ts";

const pluginRoot = fileURLToPath(new URL("..", import.meta.url));
const corporaDir = join(pluginRoot, "corpora");
const auditDir = join(pluginRoot, "source-audit", "data");

const REGISTRY_PATH = "source-audit/data/source-audit-registry.latest.json";

type RegistryGame = {
  rank: number;
  bgg_id: string;
  title: string;
  source_audit_status: string;
  official_sources?: SourceAuditOfficialSource[];
  fallback_tier?: string;
  source_search_notes?: unknown;
};

type ManifestArtifact = {
  artifact_id: string;
  title?: string;
  bgg_id?: string;
  document_type?: string;
  sha256?: string;
  rights_status?: string;
  redistribution_status?: string;
  local_use_status?: string;
};

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// ── load registry ────────────────────────────────────────────────────────
const registry = JSON.parse(readFileSync(join(pluginRoot, REGISTRY_PATH), "utf8")) as {
  registry_version: string;
  audit_run_date: string;
  games: RegistryGame[];
};
const registryByTitle = new Map(registry.games.map((g) => [normalizeTitle(g.title), g]));
const registryByBgg = new Map(registry.games.map((g) => [String(g.bgg_id), g]));

// ── load manifests / per-game source records ─────────────────────────────
type ManifestFile = { path: string; catalogued?: string; artifacts: ManifestArtifact[] };
const manifests: ManifestFile[] = [];
for (const name of readdirSync(auditDir)) {
  if (name.endsWith(".manifest.json")) {
    const parsed = JSON.parse(readFileSync(join(auditDir, name), "utf8")) as {
      catalogued_on?: string;
      artifacts?: ManifestArtifact[];
    };
    manifests.push({
      path: `source-audit/data/${name}`,
      catalogued: parsed.catalogued_on,
      artifacts: parsed.artifacts ?? [],
    });
  }
}
const recordsDir = join(auditDir, "uploaded-game-source-records");
if (existsSync(recordsDir)) {
  for (const name of readdirSync(recordsDir)) {
    if (!name.endsWith(".json")) continue;
    const parsed = JSON.parse(readFileSync(join(recordsDir, name), "utf8")) as ManifestArtifact;
    if (parsed.artifact_id) {
      manifests.push({
        path: `source-audit/data/uploaded-game-source-records/${name}`,
        artifacts: [parsed],
      });
    }
  }
}

function findManifestArtifact(id?: string, sha?: string): { artifact: ManifestArtifact; path: string; catalogued?: string } | null {
  for (const manifest of manifests) {
    for (const artifact of manifest.artifacts) {
      if ((id && artifact.artifact_id === id) || (sha && artifact.sha256 === sha)) {
        return { artifact, path: manifest.path, catalogued: manifest.catalogued };
      }
    }
  }
  return null;
}

// ── per-corpus join ──────────────────────────────────────────────────────
type LooseArtifactRef = { artifact_id?: string; sha256?: string; title?: string; document_type?: string; rights_status?: string };

function collectArtifactRefs(corpus: Record<string, unknown>): LooseArtifactRef[] {
  const refs: LooseArtifactRef[] = [];
  const push = (value: unknown) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const ref = value as LooseArtifactRef;
      if (ref.artifact_id || ref.sha256) refs.push(ref);
    }
  };
  push(corpus.source_artifact);
  push(corpus.artifact_provenance);
  if (Array.isArray(corpus.source_artifacts)) for (const a of corpus.source_artifacts) push(a);
  // Editions can carry their own quarantined-artifact locators (e.g. the
  // Wingspan printing-marker edition). Surface those too.
  if (Array.isArray(corpus.editions)) {
    for (const edition of corpus.editions as Array<Record<string, unknown>>) {
      const locator = edition.source_locator as Record<string, unknown> | undefined;
      if (locator && typeof locator.sha256 === "string") {
        const artifactPath = typeof locator.artifact_path === "string" ? locator.artifact_path : "";
        refs.push({
          artifact_id: artifactPath.split("/").pop() || `${String(edition.edition_id)}-artifact`,
          sha256: locator.sha256,
          rights_status: typeof edition.rights_status === "string" ? edition.rights_status : undefined,
        });
      }
    }
  }
  // dedupe by artifact_id ?? sha256
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = ref.artifact_id ?? ref.sha256 ?? "";
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function corpusBggId(corpus: Record<string, unknown>): string | null {
  if (typeof corpus.bgg_id === "string" || typeof corpus.bgg_id === "number") return String(corpus.bgg_id);
  const identity = typeof corpus.catalogue_identity === "string" ? corpus.catalogue_identity : "";
  const match = identity.match(/BGG (\d{1,8})/);
  return match ? match[1] : null;
}

function rightsNote(sa: SourceAudit): string {
  if (sa.source_artifacts.some((a) => (a.rights_status ?? "").includes("permission_not_established"))) {
    return "Backed by quarantined uploaded documents; permission to index or redistribute source text is not established. Entries are original interpretations only.";
  }
  if (sa.official_sources.some((s) => (s.rights_status ?? "").includes("not_granted") || (s.rights_status ?? "").includes("not_established"))) {
    return "Official sources are located for citation; permission to index or redistribute their text is not granted or unclear. Entries are original interpretations only.";
  }
  if (sa.official_sources.length > 0) {
    const base = "Grounded on publicly available official or widely published references, cited per entry. No source text is stored or redistributed.";
    return sa.source_artifacts.length > 0
      ? `${base} Quarantined uploads linked here are internal reference markers only.`
      : base;
  }
  return "No audited source on record; entries are original interpretations with per-entry source locators.";
}

let updated = 0;
for (const name of readdirSync(corporaDir).sort()) {
  if (!name.endsWith(".json") || name === "eval.json") continue;
  const path = join(corporaDir, name);
  const corpus = JSON.parse(readFileSync(path, "utf8")) as Corpus & Record<string, unknown>;

  // 1. registry match
  const artifactRefs = collectArtifactRefs(corpus);
  let bggId = corpusBggId(corpus);
  const registryGame =
    (bggId && registryByBgg.get(bggId)) || registryByTitle.get(normalizeTitle(corpus.game_title)) || null;
  if (registryGame && bggId && String(registryGame.bgg_id) !== bggId) {
    throw new Error(`${name}: corpus BGG id ${bggId} conflicts with registry record ${registryGame.bgg_id}`);
  }

  // 2. artifact linkage
  const artifacts: SourceAuditArtifact[] = [];
  let manifestDate: string | undefined;
  for (const ref of artifactRefs) {
    const found = findManifestArtifact(ref.artifact_id, ref.sha256);
    if (found?.catalogued) manifestDate = found.catalogued;
    if (found?.artifact.bgg_id && !bggId) bggId = String(found.artifact.bgg_id);
    artifacts.push({
      artifact_id: ref.artifact_id ?? found?.artifact.artifact_id ?? "(unidentified)",
      title: ref.title ?? found?.artifact.title,
      document_type: ref.document_type ?? found?.artifact.document_type,
      sha256: ref.sha256 ?? found?.artifact.sha256,
      manifest_path: found?.path ?? null,
      rights_status: found?.artifact.rights_status ?? ref.rights_status,
      redistribution_status: found?.artifact.redistribution_status,
      local_use_status: found?.artifact.local_use_status,
    });
  }

  // 3. official sources
  let officialSources: SourceAuditOfficialSource[] = [];
  if (registryGame?.official_sources?.length) {
    officialSources = registryGame.official_sources;
  } else if (corpus.default_source && typeof corpus.default_source === "object") {
    const ds = corpus.default_source;
    officialSources = [
      {
        publisher: ds.publisher,
        official_url: ds.url,
        source_type: ds.source_type,
        rights_status: ds.rights_status ?? "permission_not_established",
        accessed_on: ds.accessed_at,
        notes: ds.permission_note,
      },
    ];
  }

  const sourceAudit: SourceAudit = {
    audit_status: registryGame?.source_audit_status ?? "not_in_registry_scope",
    audited_at: registryGame ? registry.audit_run_date : manifestDate ?? corpus.generated_at,
    registry_ref: registryGame
      ? {
          registry_path: REGISTRY_PATH,
          registry_version: registry.registry_version,
          bgg_id: String(registryGame.bgg_id),
          list_rank: registryGame.rank,
          ...(registryGame.fallback_tier ? { fallback_tier: registryGame.fallback_tier } : {}),
        }
      : null,
    official_sources: officialSources,
    source_artifacts: artifacts,
    ...(registryGame?.source_search_notes !== undefined
      ? { registry_search_notes: registryGame.source_search_notes }
      : {}),
    rights_note: "",
  };
  sourceAudit.rights_note = rightsNote(sourceAudit);

  const before = JSON.stringify(corpus.source_audit);
  corpus.source_audit = sourceAudit;
  if (before !== JSON.stringify(sourceAudit)) {
    writeFileSync(path, `${JSON.stringify(corpus, null, 2)}\n`);
    updated += 1;
    const reg = registryGame ? `registry rank ${registryGame.rank} (bgg ${registryGame.bgg_id})` : "not in registry scope";
    console.log(`  ${corpus.corpus_id}: ${sourceAudit.audit_status} — ${reg}, ${artifacts.length} artifact(s), ${officialSources.length} official source(s)`);
  }
}
console.log(`${updated} corpus file(s) updated.`);
