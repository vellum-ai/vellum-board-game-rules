# Pandemic Legacy: Season 1 rules interpreter

Version **0.1.0**. This package contains short original interpretations and structured play aids, not a reproduction of the uploaded document.

## Source boundary

- Local reference: `/workspace/plugins/board-game-rules-source-audit/sources/uploaded/2026-08-12-batch/Pandemic-Legacy-Season-1-Rules-Dutch.pdf`
- SHA-256: `15913deaedac5884522c544356ff5b42af0042cbe8dc1f78ac58beb5457257dd`
- Document: scanned rules document or rulebook; 16 pages; edition scope is preserved in `data/pandemic-legacy-season-1-corpus.json`.
- Rights: permission to reproduce, index, or redistribute full text is **not established**. The source remains quarantined for internal reference.
- Full rulebook/card/scenario/artwork text is not included.

## Coverage

Covers campaign persistence, month/funding loop, sealed-content handling, core action/draw/infection flow, epidemic order, outbreaks, and end conditions. Exact language, printing, sticker, card, and scenario questions are not covered.

Use the corpus for bounded setup, flow, timing, scoring, and coverage-boundary questions. When an entry says the source is limited or edition-sensitive, use an authorized current reference for the missing detail.

## Validation

Run `npm run validate` (or `node tools/validate.mjs`).
