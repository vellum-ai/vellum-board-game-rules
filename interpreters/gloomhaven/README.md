# Gloomhaven rules interpreter

Version **0.1.0**. This package contains short original interpretations and structured play aids, not a reproduction of the uploaded document.

## Source boundary

- Local reference: `/workspace/plugins/board-game-rules-source-audit/sources/uploaded/2026-08-12-batch/Gloomhaven-RulesSummary.pdf`
- SHA-256: `1379b161db1be1b968c2586358db5ef8872760d5e4aa241c5edcc1552ddb4b8d`
- Document: third-party/user-authored rules summary, not complete rulebook; 11 pages; edition scope is preserved in `data/gloomhaven-corpus.json`.
- Rights: permission to reproduce, index, or redistribute full text is **not established**. The source remains quarantined for internal reference.
- Full rulebook/card/scenario/artwork text is not included.

## Coverage

The uploaded summary supports scenario setup, round planning, initiative, player/monster turn structure, scenario completion, exhaustion, and campaign-state reminders. It does not provide complete game coverage; use official Cephalofair material for omitted or conflicting rules.

Use the corpus for bounded setup, flow, timing, scoring, and coverage-boundary questions. When an entry says the source is limited or edition-sensitive, use an authorized current reference for the missing detail.

## Validation

Run `npm run validate` (or `node tools/validate.mjs`).
