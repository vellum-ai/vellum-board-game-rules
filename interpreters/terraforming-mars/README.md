# Terraforming Mars Rules Interpreter

Version `0.1.0` is a compact original-interpretation aid for the uploaded Terraforming Mars base-game PDF. It does not bundle the third-party PDF, card text, artwork, or long quotations.

## Coverage

The package covers generation flow, action/pass timing, global parameters, production order, game-end timing, and final-score layers. The source is a 16-page third-party document; its exact printing is not pinned. Card-specific interactions, expansions, errata, and edition conflicts should use an authorized current reference or return `not_yet_covered`.

## Source and rights

- Exact local artifact: `/workspace/plugins/board-game-rules-source-audit/sources/uploaded/2026-08-12-batch-2/Terraforming-Mars-Rulebook-1jour-1jeu.pdf`
- SHA-256: `800e1f4b857c951e31613ee00b4d6937d3040ffa6145f7eacdd983f10097c2d1`
- Manifest: `upload-batch-2026-08-12-batch-2.manifest.json`
- Provenance: PDF title/author/creator/producer identify `1jour-1jeu.com`; original URL was not supplied. This is not counted as an official publisher source.
- Rights: permission not established; PDF remains quarantined. No source text, quotations, card text, scenario text, or artwork are bundled.

## Validation

```text
bun tools/validate.mjs
```
