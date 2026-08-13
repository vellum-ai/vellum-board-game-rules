# Dune: Imperium rules interpreter

Version **0.1.0**. This package contains short original interpretations and structured play aids, not a reproduction of the uploaded document.

## Source boundary

- Local reference: `/workspace/plugins/board-game-rules-source-audit/sources/uploaded/2026-08-12-batch/Dune-Imperium-Rulebook-2020-10-26.pdf`
- SHA-256: `a689f19e7bda36ec03240ba19cbc481dd4d681f55837529cd8170ec9d19be6db`
- Document: official-style full rulebook PDF; 20 pages; edition scope is preserved in `data/dune-imperium-corpus.json`.
- Rights: permission to reproduce, index, or redistribute full text is **not established**. The source remains quarantined for internal reference.
- Full rulebook/card/scenario/artwork text is not included.

## Coverage

Covers the base-game setup loop, Agent/Reveal timing, Combat commitment, Faction thresholds, deck-cycle timing, and end condition. Player-count supplements and board-space minutiae remain out of scope.

Use the corpus for bounded setup, flow, timing, scoring, and coverage-boundary questions. When an entry says the source is limited or edition-sensitive, use an authorized current reference for the missing detail.

## Validation

Run `npm run validate` (or `node tools/validate.mjs`).
