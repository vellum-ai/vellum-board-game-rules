# boardgame-rules

Installable Vellum plugin for cited board-game rules answers.

One plugin owns the contract. Games are versioned corpora under `corpora/`. Wingspan is the first; Cribbage is the second.

## Surfaces

- `tools/boardgame_list_supported_games.ts`
- `tools/boardgame_ask_rules.ts`
- `tools/boardgame_check_scenario.ts`
- `skills/boardgame-rules/`
- `src/` retrieval and shared return shape
- `corpora/wingspan.json`, `corpora/cribbage.json`, plus `corpora/eval.json`

No hooks. Compare, refresh, embeddings, live BGG, and additional worked-example authoring are deferred.

## Return contract

Every `boardgame_ask_rules` result includes:

- `game_id`, `game_title`, `edition_id`, `corpus_version`
- `coverage_boundary`
- `evidence[]` with citation locator, URL, confidence, and rights flags
- `abstention` and `abstention_reason`
- `supported_games`

If `abstention` is true, do not invent a ruling.

## Install

Copy or install this directory as `plugins/boardgame-rules/` in a Vellum workspace.

```text
assistant plugins list
cd boardgame-rules && bun scripts/evaluate.ts
```

Current eval baseline: 18/21 passing (Wingspan 8/11, Cribbage ask 3/3, Cribbage scenario 7/7), 3 documented lexical gaps in Wingspan, 0 unexpected failures.

## Not this package

- `wingspan-rules/` is the FAQ/errata overlay, not this walking-skeleton fixture
- `interpreters/` stays inventory until it becomes a corpus here
