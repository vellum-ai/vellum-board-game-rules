# Sky Team Rules Interpreter

Version `0.1.0` is an out-of-snapshot candidate package containing concise, original interpretations of the uploaded 12-page Sky Team rulebook / basic-game landing-procedure booklet. It is a play aid, not a reproduction of the document. No rulebook, card, scenario, role, ability, or artwork text is bundled, and no long quotation is included.

## Bounded coverage

The corpus covers only what this uploaded document supports at a high level:

- basic setup and the Pilot/Co-Pilot cockpit division;
- cooperative briefing, private dice rolls, silent placement, and round flow;
- turn timing, one-die placement, constraints, and immediate resolution;
- Axis, Engines, Radio, Landing Gear, Flaps, Concentration, and Brakes at an original summary level;
- communication restrictions and the information conveyed by placement;
- the approach, altitude, holding, and final landing sequence;
- crash, spin, collision, overshoot, late-arrival, and final win boundaries;
- a transparent fallback for exact card, role, ability, scenario, module, and exception wording.

The uploaded document appears to describe the basic game and points to additional challenges/modules, but it does not establish a complete component reference. Exact wording and printing-sensitive details must use an authorized current reference or return `not_yet_covered`.

## Candidate and edition boundary

- Catalogue status: **out-of-snapshot candidate**; Sky Team was not found in the fixed top-50 identity snapshot.
- Working identity: likely 2023 base-game English basic rules, 12 pages.
- Edition/language scope: likely English; exact printing, translation state, errata state, and module set remain unresolved.
- Confidence is attached to each interpretation. High confidence describes a broad procedure supported by the uploaded document; it is not a claim that every exception is covered.

## Source and rights

- Quarantined artifact: `/workspace/plugins/board-game-rules-source-audit/sources/candidates/sky-team/sky-team.pdf`
- SHA-256: `5dac142ab82f7f4f1b6d2999e19960b871360f641ac1128285909d23455b1618`
- Metadata record: `/workspace/plugins/board-game-rules-source-audit/sources/candidates/sky-team/source-metadata.json`
- Checksum record: `/workspace/plugins/board-game-rules-source-audit/sources/candidates/sky-team/sky-team.pdf.sha256`
- Document metadata: PDF 1.7, 12 pages, 496.063 × 694.488 points, creator/producer/author `bghub.org`, created and modified 2026-06-26.
- Provenance: user-uploaded attachment; the embedded bghub.org metadata does not verify the original URL or publisher provenance.
- Rights: no permission or license was supplied. Full-text indexing, redistribution, and artwork redistribution remain blocked. Local use is limited to internal reference and verification of original interpretations.

## Validation

```text
bun tools/validate.mjs
```

The validator checks the artifact fingerprint, snapshot status, source locators, required coverage areas, and rights guards.
