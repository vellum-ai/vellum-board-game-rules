#!/usr/bin/env python3
"""Lightweight structural and rights-boundary checks for the Wingspan corpus."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORPUS_PATH = ROOT / "data" / "wingspan-corpus.json"
EXPECTED_VERSION = "0.2.0"
FAQ_URL = "https://stonemaiergames.com/games/wingspan/rules/"
REQUIRED_INTERPRETATION_FIELDS = {
    "interpretation_type",
    "confidence",
    "edition_scope",
    "source_locator",
    "rights_flags",
}
FORBIDDEN_TEXT_MARKERS = (
    "copyrighted card text",
    "rulebook reproduction",
)


def fail(message: str) -> None:
    raise SystemExit(f"FAIL: {message}")


def main() -> None:
    corpus = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))
    if corpus.get("corpus_version") != EXPECTED_VERSION:
        fail(f"corpus_version must be {EXPECTED_VERSION}")
    if corpus.get("full_rulebook_text_included") is not False:
        fail("full_rulebook_text_included must remain false")
    schema = corpus.get("interpretation_schema", {})
    if schema.get("version") != "1.0.0":
        fail("interpretation_schema.version must be 1.0.0")
    entries = corpus.get("entries", [])
    if len(entries) < 17:
        fail("expected the original corpus plus the first interpretation pass")
    ids = [entry.get("id") for entry in entries]
    if len(ids) != len(set(ids)):
        fail("entry IDs must be unique")
    editions = {edition.get("edition_id") for edition in corpus.get("editions", [])}
    for entry in entries:
        missing = REQUIRED_INTERPRETATION_FIELDS - set(entry)
        if missing:
            fail(f"{entry.get('id')} missing interpretation fields: {sorted(missing)}")
        scope_ids = entry["edition_scope"].get("edition_ids", [])
        if not scope_ids or not set(scope_ids).issubset(editions):
            fail(f"{entry.get('id')} has invalid edition_scope")
        if entry["confidence"] not in {"high", "medium", "low"}:
            fail(f"{entry.get('id')} has invalid confidence")
        flags = entry["rights_flags"]
        if flags.get("source_text_stored") is not False or flags.get("full_text_included") is not False:
            fail(f"{entry.get('id')} violates no-full-text boundary")
        locator = entry["source_locator"]
        if entry.get("kind") == "internal_artifact_metadata":
            if locator.get("official_source") is not False or not locator.get("artifact_path"):
                fail(f"{entry.get('id')} must identify the artifact as non-official metadata")
        else:
            if locator.get("url") != FAQ_URL:
                fail(f"{entry.get('id')} must locate the verified official FAQ")
    card = next((entry for entry in entries if entry.get("id") == "metadata-base-card-count"), None)
    if card is None:
        fail("metadata-base-card-count is required")
    if card["edition_ids"] != ["base-en-early-printings"]:
        fail("212-card metadata must not be scoped to current printings")
    if corpus.get("component_count_reconciliation", {}).get("status") != "unresolved":
        fail("component count reconciliation must remain explicitly unresolved")
    # Rights flags are the executable no-redistribution guard; prose may mention the boundary.
    print(f"PASS: {len(entries)} entries, {len(editions)} editions, corpus {corpus['corpus_version']}")


if __name__ == "__main__":
    main()
