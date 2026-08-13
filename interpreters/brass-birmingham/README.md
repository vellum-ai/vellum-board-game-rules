# Brass: Birmingham rules interpreter

Version **0.1.0**. This package contains short original interpretations and structured play aids, not a reproduction of the uploaded document.

## Source boundary

- Local reference: `/workspace/plugins/board-game-rules-source-audit/sources/brass-birmingham/Brass-Birmingham-Rulebook.pdf`
- SHA-256: `bb627a11c769957fbb5f26a210e3957ae27a2bad054ba9cb3b4fadc6c2ba73e5`
- Document: official rulebook PDF; uploaded duplicate deduplicated against canonical artifact; 7 pages; edition scope is preserved in `data/brass-birmingham-corpus.json`.
- Rights: permission to reproduce, index, or redistribute full text is **not established**. The source remains quarantined for internal reference.
- Full rulebook/card/scenario/artwork text is not included.

## Coverage

Covers setup, two-era flow, action-card timing, action families, end-of-round turn order/income, era scoring, and final winner. Individual industry, merchant, card, and variant text remains out of scope.

Use the corpus for bounded setup, flow, timing, scoring, and coverage-boundary questions. When an entry says the source is limited or edition-sensitive, use an authorized current reference for the missing detail.

## Validation

Run `npm run validate` (or `node tools/validate.mjs`).
