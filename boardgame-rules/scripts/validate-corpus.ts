import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Corpus, CorpusEntry, Edition, RightsFlags } from "../src/types.ts";

// ─── helpers ───────────────────────────────────────────────────────────

type ValidationError = { entry?: string; message: string };

const REQUIRED_ENTRY_FIELDS: (keyof CorpusEntry)[] = [
  "id",
  "title",
  "summary",
  "edition_ids",
  "confidence",
  "source_locator",
  "rights_flags",
];

const VALID_CONFIDENCE = new Set(["high", "medium", "low"]);

const REQUIRED_RIGHTS_KEYS: (keyof RightsFlags)[] = [
  "original_interpretation",
  "metadata_only",
  "source_text_stored",
  "full_text_included",
  "redistribution_permitted",
  "internal_only",
];

// ─── validation ─────────────────────────────────────────────────────────

function validateCorpus(corpus: Corpus, filename: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // ── corpus-level required fields ──
  for (const field of ["corpus_id", "game_title", "corpus_version", "editions", "entries", "coverage_boundary"] as const) {
    if (!corpus[field]) {
      errors.push({ message: `${filename}: missing required field "${field}"` });
    }
  }

  if (errors.length > 0) return errors; // can't validate deeper without basics

  // ── editions ──
  const editionIds = new Set<string>();
  const editions = corpus.editions ?? [];

  for (const edition of editions) {
    if (!edition.edition_id) {
      errors.push({ message: `${filename}: edition missing "edition_id"` });
      continue;
    }
    if (editionIds.has(edition.edition_id)) {
      errors.push({ message: `${filename}: duplicate edition_id "${edition.edition_id}"` });
    }
    editionIds.add(edition.edition_id);

    for (const field of ["game", "scope", "language", "status", "full_text_included"] as const) {
      if (edition[field] === undefined || edition[field] === null) {
        errors.push({ message: `${filename}: edition "${edition.edition_id}" missing "${field}"` });
      }
    }

    // inherits chain must resolve
    if (edition.inherits) {
      if (!editionIds.has(edition.inherits)) {
        // might be defined later, defer to second pass
        // we'll check after all editions are collected
      }
    }
  }

  // second pass: check inherits references resolve
  for (const edition of editions) {
    if (edition.inherits && !editionIds.has(edition.inherits)) {
      errors.push({
        message: `${filename}: edition "${edition.edition_id}" inherits from unknown edition "${edition.inherits}"`,
      });
    }
    // inherits must not be circular (simple check: must resolve to a different edition)
    if (edition.inherits === edition.edition_id) {
      errors.push({
        message: `${filename}: edition "${edition.edition_id}" inherits from itself`,
      });
    }
  }

  // ── entries ──
  const entryIds = new Set<string>();
  const entries = corpus.entries ?? [];

  if (entries.length === 0) {
    errors.push({ message: `${filename}: corpus has no entries` });
  }

  for (const entry of entries) {
    // required fields
    for (const field of REQUIRED_ENTRY_FIELDS) {
      if (entry[field] === undefined || entry[field] === null) {
        errors.push({
          entry: entry.id ?? "(unknown)",
          message: `${filename}: entry "${entry.id ?? "?"}" missing required field "${field}"`,
        });
      }
    }

    // unique id
    if (entry.id) {
      if (entryIds.has(entry.id)) {
        errors.push({ message: `${filename}: duplicate entry id "${entry.id}"` });
      }
      entryIds.add(entry.id);
    }

    // edition_ids must resolve to declared editions
    const entryEditions = entry.edition_ids ?? [];
    if (entryEditions.length === 0) {
      errors.push({
        entry: entry.id,
        message: `${filename}: entry "${entry.id}" has no edition_ids — every entry must belong to at least one edition`,
      });
    }
    for (const eid of entryEditions) {
      if (!editionIds.has(eid)) {
        errors.push({
          entry: entry.id,
          message: `${filename}: entry "${entry.id}" references unknown edition "${eid}" — declared editions are: ${[...editionIds].join(", ")}`,
        });
      }
    }

    // confidence must be valid
    if (entry.confidence && !VALID_CONFIDENCE.has(entry.confidence)) {
      errors.push({
        entry: entry.id,
        message: `${filename}: entry "${entry.id}" has confidence "${entry.confidence}" — valid values are: high, medium, low`,
      });
    }

    // source_locator must have a locator string
    if (entry.source_locator && !entry.source_locator.locator) {
      errors.push({
        entry: entry.id,
        message: `${filename}: entry "${entry.id}" source_locator missing "locator" field`,
      });
    }

    // worked_example (optional) — if present, must have scenario + expected_outcome,
    // and decomposition (if present) must be a non-empty array of strings.
    if (entry.worked_example !== undefined) {
      const we = entry.worked_example;
      if (!we || typeof we !== "object") {
        errors.push({
          entry: entry.id,
          message: `${filename}: entry "${entry.id}" worked_example must be an object with scenario + expected_outcome`,
        });
      } else {
        if (!we.scenario || typeof we.scenario !== "string") {
          errors.push({
            entry: entry.id,
            message: `${filename}: entry "${entry.id}" worked_example.scenario missing or not a string`,
          });
        }
        if (!we.expected_outcome || typeof we.expected_outcome !== "string") {
          errors.push({
            entry: entry.id,
            message: `${filename}: entry "${entry.id}" worked_example.expected_outcome missing or not a string`,
          });
        }
        if (we.decomposition !== undefined) {
          if (!Array.isArray(we.decomposition) || we.decomposition.some((step) => typeof step !== "string" || step.trim() === "")) {
            errors.push({
              entry: entry.id,
              message: `${filename}: entry "${entry.id}" worked_example.decomposition must be an array of non-empty strings`,
            });
          }
        }
      }
    }

    // applies_when (optional) — must be a non-empty string array when present.
    if (entry.applies_when !== undefined) {
      if (!Array.isArray(entry.applies_when) || entry.applies_when.some((t) => typeof t !== "string" || t.trim() === "")) {
        errors.push({
          entry: entry.id,
          message: `${filename}: entry "${entry.id}" applies_when must be an array of non-empty trigger strings`,
        });
      }
    }

    // analog_hooks are optional, but a present hook must be complete —
    // a hook missing its exception reads as "this analogy has no caveats",
    // which is exactly the failure mode analog hooks exist to prevent.
    if (entry.analog_hooks !== undefined) {
      if (!Array.isArray(entry.analog_hooks)) {
        errors.push({
          entry: entry.id,
          message: `${filename}: entry "${entry.id}" analog_hooks must be an array`,
        });
      } else {
        for (const hook of entry.analog_hooks) {
          for (const field of ["known_game_id", "known_game_title", "likeness", "exception"] as const) {
            if (!hook[field] || typeof hook[field] !== "string") {
              errors.push({
                entry: entry.id,
                message: `${filename}: entry "${entry.id}" analog hook missing "${field}"`,
              });
            }
          }
          if (hook.known_game_id && hook.known_game_id !== hook.known_game_id.toLowerCase()) {
            errors.push({
              entry: entry.id,
              message: `${filename}: entry "${entry.id}" analog hook known_game_id "${hook.known_game_id}" must be a lowercase id`,
            });
          }
        }
      }
    }

    // rights_flags must have all required keys
    if (entry.rights_flags) {
      for (const key of REQUIRED_RIGHTS_KEYS) {
        if (entry.rights_flags[key] === undefined) {
          errors.push({
            entry: entry.id,
            message: `${filename}: entry "${entry.id}" rights_flags missing "${key}"`,
          });
        }
      }
      // redistribution_permitted should be false for a public plugin
      if (entry.rights_flags.redistribution_permitted === true) {
        errors.push({
          entry: entry.id,
          message: `${filename}: entry "${entry.id}" has redistribution_permitted=true — this plugin only stores original interpretations, not redistributable text`,
        });
      }
    }
  }

  // ── source_audit (required: every corpus must be self-describing about its sources) ──
  const audit = corpus.source_audit;
  if (!audit) {
    errors.push({ message: `${filename}: missing "source_audit" — run \`bun scripts/sync-source-audit.ts\` to generate it from the registry and manifests` });
  } else {
    for (const field of ["audit_status", "audited_at", "rights_note"] as const) {
      if (!audit[field]) {
        errors.push({ message: `${filename}: source_audit missing "${field}"` });
      }
    }
    if (audit.registry_ref !== null && audit.registry_ref !== undefined) {
      for (const field of ["registry_path", "registry_version", "bgg_id", "list_rank"] as const) {
        if (audit.registry_ref[field] === undefined || audit.registry_ref[field] === null || audit.registry_ref[field] === "") {
          errors.push({ message: `${filename}: source_audit.registry_ref missing "${field}"` });
        }
      }
    } else if (audit.registry_ref === undefined) {
      errors.push({ message: `${filename}: source_audit.registry_ref must be an object or explicit null` });
    }
    if (!Array.isArray(audit.official_sources)) {
      errors.push({ message: `${filename}: source_audit.official_sources must be an array` });
    } else {
      for (const source of audit.official_sources) {
        if (!source.rights_status) {
          errors.push({ message: `${filename}: source_audit official source ${source.official_url ?? source.publisher ?? "?"} missing "rights_status" — a URL without a rights posture reads as permission` });
        }
      }
    }
    if (!Array.isArray(audit.source_artifacts)) {
      errors.push({ message: `${filename}: source_audit.source_artifacts must be an array` });
    } else {
      for (const artifact of audit.source_artifacts) {
        if (!artifact.artifact_id) {
          errors.push({ message: `${filename}: source_audit artifact missing "artifact_id"` });
        }
        if (artifact.manifest_path === undefined) {
          errors.push({ message: `${filename}: source_audit artifact "${artifact.artifact_id}" missing "manifest_path" (use null when uncatalogued)` });
        }
        if (artifact.sha256 !== undefined && !/^[0-9a-f]{64}$/.test(artifact.sha256)) {
          errors.push({ message: `${filename}: source_audit artifact "${artifact.artifact_id}" sha256 is not 64 lowercase hex characters` });
        }
      }
    }
  }

  // ── interpretation_schema (optional but if present, validate shape) ──
  if (corpus.interpretation_schema) {
    const schema = corpus.interpretation_schema;
    for (const field of ["version", "description", "required_fields", "confidence_values", "rights_policy"] as const) {
      if (!schema[field]) {
        errors.push({ message: `${filename}: interpretation_schema missing "${field}"` });
      }
    }
  }

  return errors;
}

// ─── main ───────────────────────────────────────────────────────────────

const corporaDir = fileURLToPath(new URL("../corpora/", import.meta.url));
const files = readdirSync(corporaDir).filter((f) => f.endsWith(".json") && f !== "eval.json");

let totalErrors = 0;
let totalEntries = 0;
let totalEditions = 0;
const games: string[] = [];

for (const file of files) {
  const filepath = `${corporaDir}/${file}`;
  const raw = readFileSync(filepath, "utf8");

  let corpus: Corpus;
  try {
    corpus = JSON.parse(raw) as Corpus;
  } catch (e) {
    console.log(`\n✗ ${file}: JSON parse error — ${e instanceof Error ? e.message : String(e)}`);
    totalErrors += 1;
    continue;
  }

  const errors = validateCorpus(corpus, file);
  const entryCount = corpus.entries?.length ?? 0;
  const editionCount = corpus.editions?.length ?? 0;
  totalEntries += entryCount;
  totalEditions += editionCount;
  games.push(corpus.game_title ?? corpus.corpus_id ?? file);

  if (errors.length === 0) {
    console.log(`\n✓ ${file}: ${entryCount} entries, ${editionCount} editions — valid`);
  } else {
    console.log(`\n✗ ${file}: ${entryCount} entries, ${editionCount} editions — ${errors.length} error(s)`);
    for (const err of errors) {
      const prefix = err.entry ? `  [${err.entry}]` : `  [corpus]`;
      console.log(`${prefix} ${err.message}`);
    }
    totalErrors += errors.length;
  }
}

console.log(`\n=== ${games.length} game(s): ${games.join(", ")} ===`);
console.log(`=== ${totalEntries} entries, ${totalEditions} editions, ${totalErrors} error(s) ===`);
process.exit(totalErrors > 0 ? 1 : 0);
