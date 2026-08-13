# Nemesis Rules Interpreter

Version `0.1.0` is an out-of-snapshot candidate package containing concise, original interpretations of the uploaded Nemesis base-game English rulebook. It is a play aid, not a reproduction of the rulebook. No rulebook text, card/objective/room/intruder text, artwork, or long quotation is bundled.

## Coverage

The corpus gives a bounded overview of setup and round flow; action cards and action-only restrictions; movement, exploration, and noise; encounter and combat sequencing at a high level; escape and character death; contamination and injury handling; items, search, and crafting; and the structure of victory checks. It deliberately does not reproduce exact card, objective, room, or intruder effects. Those details, component exceptions, expansions, errata, and printing-sensitive questions must use an authorized current reference or return `not_yet_covered`.

## Candidate and edition boundary

- Catalogue status: **out-of-snapshot candidate**; Nemesis is not added to the fixed top-50 identity snapshot.
- Working identity: likely base-game English, 28-page game manual/rulebook.
- Edition scope: document scope only; exact printing, errata state, and provenance remain unresolved.
- Confidence is attached to each interpretation. High confidence means the document-level structure or broad procedure is clear; it is not a claim that every exception is covered.

## Source and rights

- Quarantined artifact: `/workspace/plugins/board-game-rules-source-audit/sources/candidates/nemesis/Nemesis_rulebook_en.pdf`
- SHA-256: `52e9c285521f2351872b24326fbc5171685b42d32de5b9d405249d64827255ac`
- Metadata record: `/workspace/plugins/board-game-rules-source-audit/sources/candidates/nemesis/source-metadata.json`
- Document metadata: PDF 1.5, 28 pages, Adobe InDesign CC 14.0 / Adobe PDF Library 15.0, created 2019-01-31 and modified 2019-10-21.
- Provenance: user-uploaded attachment; original URL and publisher provenance were not supplied.
- Rights: permission and license are not established. Full-text indexing and redistribution remain blocked; local use is limited to internal reference and verification of original interpretations.

## Validation

```text
bun tools/validate.mjs
```
