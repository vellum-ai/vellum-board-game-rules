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

## Supported games

| Game | Editions | Entries | Corpus version |
| --- | --- | --- | --- |
| Wingspan | Base (2020), European Expansion (2019) | 27 | 0.2.0 |
| Cribbage | Two-player standard, Muggins, Short (61), Skunk | 27 | 0.1.0 |

Want to add a game? See **[CONTRIBUTING.md](CONTRIBUTING.md)** — you write one JSON file, validate it, and it works.

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
boardgame-rules/          The installable plugin
├── tools/                Model-visible tools (ask_rules, list_supported_games)
├── skills/               Skill instructions for the assistant
├── src/                  Retrieval, corpus loading, shared types
├── scripts/              Validator + evaluation harness
├── corpora/              Game corpora (one JSON file per game)
│   ├── wingspan.json     27 entries, 2 editions
│   ├── cribbage.json     27 entries, 4 editions
│   └── eval.json         Regression test suite
└── package.json          Plugin manifest (@vellumai/plugin-api ^0.10.0)

source-audit/             Fixed BGG top-50 identity snapshot + publisher-source audit
interpreters/             Original-interpretation game packages (pre-corpus inventory)
wingspan-rules/           Wingspan FAQ/errata overlay (separate from the plugin corpus)
```

## Validation

```bash
cd boardgame-rules && bun scripts/validate-corpus.ts   # validate all corpora
cd boardgame-rules && bun scripts/evaluate.ts           # run regression eval
```

Current baseline: **54 entries, 6 editions, 2 games, 0 validation errors, 21/21 eval tests passing.**

## Sequencing

The project grows in gates:

1. **One-game gate** — one game can answer cited, edition-aware questions and abstain honestly. ✅ (Wingspan)
2. **Two-game gate** — the schema and tool contract work across multiple games without per-game hacks. ✅ (Wingspan + Cribbage)
3. **Five-game gate** — five varied games prove the schema generalizes across complexity, mechanics, and publisher styles.
4. **Fifty-game gate** — repeatable contribution with provenance, stratified evaluation, and observability.

We're at the two-game gate. The schema is stable. The contributor contract is documented. The next step is five varied games.

## License

This plugin is designed to be shared publicly for use with Vellum assistants. See [CONTRIBUTING.md](CONTRIBUTING.md) for the contributor contract.
