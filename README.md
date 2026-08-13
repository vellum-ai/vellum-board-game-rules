# Vellum Board Game Rules

Private repository for Vellum's bounded board-game rules work.

This is a **fixture-first rules product**, not a live BGG copier. The installable plugin should answer a supported question with game and edition identity, evidence, and citations, and it should abstain when coverage, permission, or source quality is missing.

## Contents

- `boardgame-rules/`: the installable plugin. Tools, shared return contract, and the first Wingspan corpus.
- `source-audit/`: fixed BGG top-50 identity snapshot and official publisher-source audit metadata.
- `interpreters/`: original-interpretation game packages and shared search/validation layer.
- `wingspan-rules/`: Wingspan FAQ/errata overlay. Not the installable plugin.
- `cribbage-rules/`: additional per-game inventory, not yet a plugin corpus.

## Rights boundary

This repository contains metadata, original interpretations, structured play aids, source locators, and validation code. It does **not** redistribute rulebook text, card text, artwork, or quarantined source PDFs. Public availability or user upload does not establish permission to reproduce or redistribute source material. The local audit's quarantined source artifacts remain outside this repository.

Explicit permission to index or redistribute full text is currently `0`. Keep it that way unless a later review records a real license or publisher grant.

## Current status

As of 2026-08-13, this branch adds the installable plugin on top of current inventory:

| Layer | What is here | What it is not |
| --- | --- | --- |
| Plugin `boardgame-rules` `0.1.0` | One installable package with `boardgame_list_supported_games` and `boardgame_ask_rules` | Not five games, not compare/refresh, not a live index |
| Wingspan corpus `0.1.0` | 27 walking-skeleton fixture chunks plus 11-test eval | Not the FAQ/errata overlay in `wingspan-rules/` |
| Source audit `1.3.0` | Fixed #1–#50 snapshot from BGG Geeklist 372705, plus publisher-source leads | Not a live ranking and not permission to ingest PDFs |
| Interpreters `0.1.0` | 16 original-interpretation packages plus a shared search tool | Not the public plugin contract |
| Catalogue `1.0.0` | 17 games / 169 interpretation entries | Not exhaustive coverage; Scythe has no package |

The source audit is a fixed, dated snapshot, not a live BGG ranking. Official-source status, edition identity, snapshot membership, provenance, rights, and ingestion remain separate. Scythe remains unresolved pending the actual source artifact.

The current audit result in registry `v1.3.0` is **20 official rules located, 12 official sources unconfirmed, and 18 gaps**. Counts stay bounded to that search pass. Explicit full-text permission remains `0`.

## Sequencing

Locked direction: **Wingspan first, then 5 varied games, then the #1–#50 snapshot**.

1. **One-game gate.** Wingspan can answer a cited, edition-aware question and abstain honestly. Failed refresh or missing permission must leave the last-known-good corpus intact.
2. **Five-game gate.** The same schema, search contract, and evaluation shape work across five varied games without per-game hacks.
3. **Fifty-game gate.** Repeatable ingestion with provenance, legal metadata, stratified evaluation, and observability. Do not scale the corpus before the first two gates hold.

Antonius's 17-game catalogue is useful inventory. It is not the five-game or fifty-game gate by itself. Rank numbers inside that catalogue are not the canonical #1–#50 list; use `source-audit/data/bgg-top50-derived.v1.0.0.json` until a newer dated snapshot is recorded.

## Shared contract

Stable plugin code owns tools, schemas, identity resolution, retrieval, answer formatting, citations, and safety. A separately versioned corpus owns game metadata and permitted interpretation chunks.

Recommended V1 operations:

| Operation | Role |
| --- | --- |
| `boardgame_list_supported_games` | List installed games, editions, coverage limits, and corpus versions |
| `boardgame_ask_rules` | Answer a question or abstain with evidence |
| `boardgame_find_rule` | Retrieve matching chunks without composing a ruling |
| `boardgame_compare_rules` | Compare supported games or editions using the same citation contract |
| `boardgame_refresh_index` | Operator/guardian-only. Rebuild from permitted sources and keep last-known-good on failure |

Shipped public tools live in `boardgame-rules/`:

- `boardgame_list_supported_games`
- `boardgame_ask_rules`

Inventory search tools remain in `wingspan-rules/` and `interpreters/`. They are not the public contract. Compare and refresh stay deferred.

Every read result should include:

- game identity and edition/document scope
- corpus version and coverage limit
- source locator, source type, and rights flag
- confidence
- citation to the matching interpretation or metadata record
- explicit abstention when the question is unsupported, conflicting, out of edition, or permission-blocked

Do not invent a complete ruling from a Learn to Play guide, field guide, or summary. Limited documents stay labeled as limited.

## Retrieval and evaluation

V1 retrieval stays inspectable and lexical/metadata-filtered. Resolve game and edition before ranking. Defer embeddings, per-question live fetching, full BGG rules-text ingestion, UI, and schedules until evaluation shows a real gap.

The first evaluation set should cover:

- direct rulings
- exceptions
- setup and turn order
- edition and expansion disambiguation
- cross-game or cross-document comparison
- unsupported games and nonsense queries
- conflicting or incomplete sources
- failed refresh that preserves the prior corpus

Measure hit@k, ruling and citation correctness, identity resolution, abstention quality, unsupported-claim rate, latency, and last-known-good preservation.

The first in-repo eval lives at `boardgame-rules/corpora/eval.json` and runs with `cd boardgame-rules && bun scripts/evaluate.ts`. Baseline: 27 Wingspan fixture chunks, 11 tests, **8/11 passing**, 3 documented lexical gaps, 0 unexpected failures.

## Demo gates

A first demo should show all of:

1. A cited nontrivial Wingspan ruling
2. Correct edition or expansion disambiguation
3. A supported-game or cross-game comparison that stays inside coverage
4. Honest abstention on an unsupported question
5. A failed refresh that leaves the prior corpus intact

## What not to do next

- Do not copy rulebook, card, scenario, or artwork text into git.
- Do not treat a public PDF, BGG file page, or user upload as permission.
- Do not expand to 50 games before the five-game schema holds.
- Do not live-refresh BGG until official API/auth/terms are reconciled.
- Do not silently merge conflicting editions or apply an expansion rule to a base-game question.

## Validation

```text
cd boardgame-rules && bun scripts/evaluate.ts
cd wingspan-rules && bun tools/validate.mjs
cd interpreters && bun tools/validate.mjs
```

## Open decisions

- Which five games besides Wingspan are the first varied set
- How Antonius's interpretation catalogue should become additional corpora behind this plugin
- When, if ever, a publisher grant allows more than original interpretation plus locators
- Whether live BGG remains metadata-only after the API/terms review
