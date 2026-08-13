# Board-Game Rules Interpreters

A shared read-only search layer for separately versioned board-game interpretation packages. It bundles original summaries, play aids, timing atoms, source locators, edition scope, confidence, and coverage states. It does not bundle rulebook text.

## Package layout

Each game is an independent directory as direct child package directories with:

- `package.json`
- `README.md`
- `data/corpus.json`
- optional validation script

A corpus should declare `game_id`, `game_title`, `corpus_version`, `document_coverage`, `editions`, `entries`, and rights flags. Limited documents such as summaries, field guides, or Learn to Play guides must be labeled as limited coverage and must not be treated as complete references.

## Rights boundary

Every entry must set `source.full_text_included` to `false`. Public access, user upload, or a filename does not establish permission to index or redistribute source text. Source PDFs remain quarantined internal references. The shared layer stores only original interpretation, metadata, and locators.

## Search behavior

`src/search.ts` discovers valid game corpora under `games/` at call time. It can search one game or all games, filter by edition and topic, and returns coverage status plus a live-lookup/not-covered recommendation when local matches are absent. It never reads PDFs.

## Validation

```text
bun tools/validate.mjs
```
