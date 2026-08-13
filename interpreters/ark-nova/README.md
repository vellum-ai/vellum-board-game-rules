# Ark Nova rules interpreter

Version **0.2.0**. This package contains short original interpretations and structured play aids, not a reproduction of either uploaded document.

## Fixed catalogue identity

Ark Nova remains the fixed top-50 snapshot member at **rank 4**, BGG ID **342942**. Snapshot membership is separate from document provenance, edition identity, and rights.

## Source records

The prior Zoo Guide remains a separate, limited source record:

- Local reference: `/workspace/plugins/board-game-rules-source-audit/sources/uploaded/2026-08-12-batch/Ark-Nova-Zoo-Guide-Booklet.pdf`
- SHA-256: `55aeeb8b5211ed990a37db5218e639fa9b2f1ca703498568f468576b068165ff`
- Scope: 32-page A5 supplementary field guide/booklet; edition and original URL are not pinned; it is not a gameplay rulebook.

The second quarantined source is the newly uploaded rulebook:

- Local reference: `/workspace/plugins/board-game-rules-source-audit/sources/candidates/ark-nova-rulebook/Ark-Nova-Rulebook.pdf`
- SHA-256: `f6b4eedc68e993f61b4c5cb5d99bb4af399da0be3de4781321bcba1ba44516f6`
- Scope: likely base-game English rulebook, 20 pages, PDF metadata created 2022-02-07; exact printing, errata state, publisher provenance, and original URL are unresolved.
- Metadata: `/workspace/plugins/board-game-rules-source-audit/sources/candidates/ark-nova-rulebook/source-metadata.json`

Both artifacts are quarantined for internal reference. Permission to reproduce, index, or redistribute full text is **not established**. The package stores no rulebook text, card text, artwork, or long quotations.

## Coverage

The added rulebook supports bounded original interpretations for setup; game, round, and turn flow; action strength/order; association worker placement and exploration-boundary handling; resources/items/artifacts; guardians; research; scoring/endgame; and explicit fallbacks for exact card/animal/site effects and edition conflicts. The Zoo Guide entries remain limited to its own document identity and animal-reference scope.

For exact component effects, icons, named cards or animals, expansion/solo rules, printing conflicts, and wording-sensitive questions, use an authorized current reference or return `not_yet_covered`.

## Validation

Run `npm run validate` (or `node tools/validate.mjs`). The shared index validator at `../tools/validate.mjs` discovers this package alongside the other interpreter corpora.
