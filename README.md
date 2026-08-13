# Vellum Board Game Rules

An installable plugin for [Vellum](https://www.vellum.ai) assistants that answers board-game rules questions with cited evidence, edition awareness, and honest abstention.

This is **not** a rules wiki with a search box. It's a versioned knowledge corpus that an assistant can reason about — returning game identity, source citations, confidence levels, and explicit "I don't have coverage for that" instead of guessing.

## What it does

Ask your assistant a rules question:

> "In Wingspan, do brown powers activate left-to-right or right-to-left?"

The plugin returns a cited answer:

> Brown (When Activated) powers resolve **right-to-left** in the row of birds in that habitat.
>
> *Source: Wingspan Official Rules (Stonemaier Games), Automa & Power Rules section. Confidence: high.*

If you ask about a game or edition it doesn't cover, it abstains instead of making something up.

## Install

```bash
assistant plugins install https://github.com/vellum-ai/vellum-board-game-rules/tree/main/boardgame-rules --name boardgame-rules
```

Then ask your assistant about a supported game. The tools are:

- **`boardgame_list_supported_games`** — list installed games, editions, coverage limits, and corpus versions
- **`boardgame_ask_rules`** — answer a rules question with evidence, or abstain
- **`boardgame_check_scenario`** — validate a specific play situation ("did I score this hand right?") against a pre-authored worked example, or hard-abstain

## Supported games

Two tiers share one schema and one contract:

**Reference corpora** — grounded against official or widely published sources,
with first-play analog hooks:

| Game | Editions | Entries | Corpus version |
| --- | --- | --- | --- |
| Wingspan | Base (2020), European Expansion (2019), plus FAQ/errata overlay editions | 37 | 0.4.0 |
| Cribbage | Two-player standard, Muggins, Short (61), Skunk | 27 | 0.2.0 |

**Bounded interpreter corpora** — migrated from the former `interpreters/`
packages. Deliberately limited coverage from document-scoped, often
third-party sources whose rights are unresolved; entries are original
interpretations marked `internal_only`, and the corpus abstains outside its
coverage boundary:

| Game | Entries | | Game | Entries |
| --- | --- | --- | --- | --- |
| A Feast for Odin | 13 | | Lost Ruins of Arnak | 14 |
| Ark Nova | 14 | | Nemesis | 13 |
| Brass: Birmingham | 8 | | Pandemic Legacy: Season 1 | 8 |
| Dune: Imperium | 8 | | Sky Team | 15 |
| Dune: Imperium – Uprising | 9 | | Star Wars: Rebellion | 7 |
| Gaia Project | 7 | | Terraforming Mars | 7 |
| Gloomhaven | 8 | | Twilight Imperium: Fourth Edition | 7 |
| Gloomhaven: Jaws of the Lion | 7 | | War of the Ring: Second Edition | 7 |
| Flip 7 | 14 | | | |

Want to add a game or deepen a bounded corpus? See
**[CONTRIBUTING.md](CONTRIBUTING.md)** — you write one JSON file, validate it,
and it works.

## How it works

```
Question → resolve game + edition → lexical retrieval → score → cite or abstain
```

1. The assistant calls `boardgame_ask_rules` with the question and optional game/edition
2. The plugin resolves the game and edition from installed corpora
3. Lexical retrieval scores corpus entries against the query tokens
4. If the top score clears the abstention threshold, evidence is returned with citations
5. If not, the plugin abstains with a reason — no guessing

Every result includes: game identity, edition scope, corpus version, coverage boundary, evidence with citations, confidence, rights flags, and explicit abstention when unsupported.

## Rights boundary

This repository contains **original interpretations and metadata only**. It does not redistribute rulebook text, card text, artwork, or source PDFs. Every corpus entry is an original paraphrase written by a contributor, not copied from a publisher document.

- `redistribution_permitted` is `false` on every entry
- `full_text_included` is `false` on every edition
- Source URLs point to official publisher pages for citation, not for scraping

If you're contributing: write your own interpretation of the rule. Don't paste the rulebook.

## Repository structure

```
boardgame-rules/          The installable plugin — the repo's only package
├── tools/                Model-visible tools (ask/list + sitting start/update)
├── hooks/                Lifecycle hooks (sitting store, sitting card, cleanup)
├── skills/               Skill instructions (rules answers + first-play companion)
├── src/                  Retrieval, corpus loading, sitting store, shared types
├── scripts/              Validator + evaluation harness
├── corpora/              Game corpora (one JSON file per game) + eval.json
└── source-audit/         Fixed BGG top-50 identity snapshot + publisher-source
                          audit registry (moved from the repo root at unification)
```

The former `interpreters/` and `wingspan-rules/` packages are gone: every
interpreter corpus was migrated into `corpora/` under the unified schema (each
carries a `migration` block naming its origin), and the Wingspan overlay's
unique FAQ/errata entries were merged into `corpora/wingspan.json`.

## Validation

```bash
cd boardgame-rules && bun scripts/validate-corpus.ts     # validate all corpora
cd boardgame-rules && bun scripts/evaluate.ts             # run regression eval
cd boardgame-rules && bun scripts/sync-source-audit.ts    # refresh corpus source_audit blocks
```

Current baseline: **230 entries (2 with worked examples), 29 editions, 19 games, 0 validation errors, 88/88 eval tests passing.** Every corpus carries a validator-enforced `source_audit` block tracing its sources to the audit registry and upload manifests.

## Sequencing

The project grows in gates:

1. **One-game gate** — one game can answer cited, edition-aware questions and abstain honestly. ✅ (Wingspan)
2. **Two-game gate** — the schema and tool contract work across multiple games without per-game hacks. ✅ (Wingspan + Cribbage)
3. **Five-game gate** — varied games prove the schema generalizes across complexity, mechanics, and publisher styles. ✅ (19 games after the interpreter migration — though 16 are bounded, limited-coverage corpora, not reference depth)
4. **Fifty-game gate** — repeatable contribution with provenance, stratified evaluation, and observability.

The schema is stable and every game in the repo now speaks it. The next step
is deepening the bounded corpora toward reference quality and resolving source
rights via the `boardgame-rules/source-audit/` registry.

## License

This plugin is designed to be shared publicly for use with Vellum assistants. See [CONTRIBUTING.md](CONTRIBUTING.md) for the contributor contract.
