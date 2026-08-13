# A Feast for Odin Rules Interpreter

Version `0.1.0` is a bounded, original-interpretation package for the uploaded 24-page English `ODIN_EN_rules-LR.pdf`. The inspected document identifies itself through its opening title and rules content as **A Feast for Odin**, by Uwe Rosenberg. It is a game rulebook, likely a 2016/base-game English document; exact printing, revision, and errata state are not pinned.

This package is in the fixed BGG-derived snapshot at rank 5 (`A Feast for Odin`, BGG ID `177736`). Snapshot membership does not establish source provenance or permission to reproduce the rulebook.

## Coverage

The corpus covers only supported, high-level interpretations of setup, the twelve-phase round structure, worker-placement turn flow, action-space and hand-management boundaries, board/tile placement and resource-management principles, scoring/endgame structure, and a precise-component fallback. It does **not** reproduce card, occupation, weapon, goods-tile, exploration-board, action-space, or appendix text. Exact component effects, icon interpretation, exception timing, solo details, expansions, printing differences, and errata-sensitive questions should use an authorized current reference or return `not_yet_covered`.

Confidence is attached to each entry. High confidence describes procedures directly visible in the inspected document; it is not a claim that every exception is bundled.

## Source and rights

- Quarantined artifact: `/workspace/plugins/board-game-rules-source-audit/sources/candidates/odin/ODIN_EN_rules-LR.pdf`
- SHA-256: `3307ffb60d71178a8e1bae0a08f260020040e3b53e1b7c349ccde0c2b662b18b`
- Metadata record: `/workspace/plugins/board-game-rules-source-audit/sources/candidates/odin/source-metadata.json`
- Checksum record: `/workspace/plugins/board-game-rules-source-audit/sources/candidates/odin/ODIN_EN_rules-LR.pdf.sha256`
- Document metadata: PDF 1.6, 24 pages, Adobe InDesign CC 2015 / Adobe PDF Library 15.0, created and modified 2016-08-29.
- Provenance: user-uploaded attachment; original URL and publisher provenance were not supplied.
- Rights: permission and license are not established. Full-text indexing and redistribution remain blocked. The local PDF is quarantined for internal reference only; the distributable corpus contains original interpretations and document metadata, not source text or artwork.

## Validation

```text
bun tools/validate.mjs
```
