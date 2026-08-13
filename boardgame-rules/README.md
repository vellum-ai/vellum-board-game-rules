# boardgame-rules

Installable Vellum plugin for cited board-game rules answers.

One plugin owns the contract. Games are versioned corpora under `corpora/`. Wingspan and Cribbage are the first two.

## Supported games

| Game | Editions | Entries | Corpus version |
| --- | --- | --- | --- |
| Wingspan | Base (2020), European Expansion (2019) | 27 | 0.2.0 |
| Cribbage | Two-player standard, Muggins, Short (61), Skunk | 27 | 0.1.0 |

## Surfaces

- `tools/boardgame_ask_rules.ts` — answer a rules question with evidence or abstain
- `tools/boardgame_list_supported_games.ts` — list installed games, editions, coverage
- `skills/boardgame-rules/` — assistant skill instructions
- `src/` — retrieval, corpus loading, shared types
- `scripts/validate-corpus.ts` — validate all corpora (plain-English errors)
- `scripts/evaluate.ts` — regression eval suite
- `corpora/` — one JSON file per game plus `eval.json`

No hooks. Compare, refresh, embeddings, live BGG, and UI are deferred.

## Return contract

Every `boardgame_ask_rules` result includes:

- `game_id`, `game_title`, `edition_id`, `corpus_version`
- `coverage_boundary`
- `evidence[]` with citation locator, URL, confidence, and rights flags
- `abstention` and `abstention_reason`
- `supported_games`

If `abstention` is true, do not invent a ruling.

## Install

```bash
assistant plugins install https://github.com/vellum-ai/vellum-board-game-rules/tree/main/boardgame-rules --name boardgame-rules
```

## Validate and test

```bash
bun scripts/validate-corpus.ts   # validate all corpora
bun scripts/evaluate.ts           # run regression eval
```

Current baseline: 54 entries, 6 editions, 2 games, 0 validation errors, 21/21 eval tests passing.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full contributor guide. The short version: write one JSON file, validate it, open a PR.

## Not this package

- `wingspan-rules/` is the FAQ/errata overlay, not this plugin's corpus
- `interpreters/` is pre-corpus inventory, not yet migrated into `corpora/`
