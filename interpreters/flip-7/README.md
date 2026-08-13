# Flip 7 Rules Interpreter

Version `0.1.0` is a bounded, original-interpretation play aid for **Flip 7**, built from the quarantined 14-page uploaded rulebook artifact identified below. It is not a reproduction of the rulebook and is not a substitute for an authorized current rules reference.

## Coverage

The corpus covers broad setup, the deal and immediate-resolution loop, hit/stay decisions, active-player timing, duplicate-number busts, the seven-distinct-number round-ending condition, score concepts, high-level interaction and modifier timing, round transitions, and game end.

It deliberately avoids exact card or action effects, full special-card resolution, artwork, long quotations, exhaustive edge cases, variants, and printing-specific corrections. Questions about a named card, an exact interaction, or omitted exception should be checked against an authorized current reference or returned as `not_yet_covered`.

## Edition and scope

- Game: **Flip 7**.
- Working source scope: English, 14-page uploaded rulebook, `Ruleset Edition 1`.
- Edition identity: document identity is high; publisher provenance, exact retail printing, and errata state are not independently pinned beyond the artifact fingerprint.
- This is an ad hoc uploaded-game package outside the historical BGG snapshot; no BGG ID or rank is assigned.
- Confidence describes support in the selected artifact. It is not a claim of exhaustive rules coverage.

## Source and rights

The source PDF is quarantined for internal reference only and is not bundled here:

- Quarantined path: `/workspace/plugins/board-game-rules-source-audit/sources/uploaded/ad-hoc-flip-7/26_FLIP_7_VENGEANCE_RULES_C.pdf`
- SHA-256: `45d0140b69d6f8f322a7bc2bb5a80bf5f03746151f62215da2c79e381dcb83c9`
- Pages: 14
- Provenance: user-provided local artifact; original source URL and permission to reproduce, index, or redistribute full text are not established.

The package contains original paraphrases, structured play aids, source locators, edition metadata, and rights flags only. It contains no full rulebook text, exact card/action text, artwork, or long quotations. `source.full_text_included` and `full_rulebook_text_included` are explicitly `false`, and all rights flags are `false`.

## Validation

From this package directory:

```text
bun ../tools/validate.mjs
```

From the interpreter root:

```text
bun tools/validate.mjs
```
