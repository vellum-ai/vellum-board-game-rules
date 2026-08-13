# Wingspan Rules Plugin

A compact, versioned Wingspan rules reference and original-interpretation layer. It intentionally stores short original paraphrases, decision aids, metadata, edition scope, source locators, and confidence states, not a copy of any rulebook.

## What it ships

- `wingspan_rules_search`: a read-only tool that searches `data/wingspan-corpus.json`.
- Corpus `0.2.0`, with original timing atoms, errata reminders, edition guidance, metadata, and source pointers.
- Explicit edition scope, source locators, confidence, and rights flags on interpretation records.
- Live lookup fallback for questions outside the local coverage or involving exact wording, cards, newer printings, or unresolved edition conflicts.

## Rights boundary

`full_rulebook_text_included` is false. The uploaded `WS_Rulebook_r23-LR.pdf` is quarantined under `/workspace/plugins/wingspan-rules-internal/` for internal verification only. It is not bundled, full-text indexed, or redistributed. Its local revision marker is recorded as an unconfirmed metadata marker, not as proof of a publisher printing code.

The corpus contains no copied rulebook pages, long quotations, card text, scenario text, artwork, or line-by-line substitute. A maintainer must confirm permission before adding any full-text source. If permission is unavailable or unclear, keep only links, metadata, and original summaries.

## Edition and component handling

The corpus distinguishes current English base printing, early English printings, a quarantined probable-2021 reference marker, and expansion source pointers. The older official FAQ figure of 212 cards is scoped only to early printings. This corpus does not assert a separate standard-base, Swift-Start, or current-printing total because the current official source evidence has not been reconciled into a directly locatable statement. Treat the reconciliation as unresolved.

The uploaded filename `r23-LR` is not mapped to a Stonemaier printing code. Use the physical copy and the official [Wingspan Rules & FAQ page](https://stonemaiergames.com/games/wingspan/rules/) for edition-sensitive answers.

## Validation

```text
bun tools/validate.mjs
```

The local corpus is a fast deterministic layer, not a replacement for the official rules. Do not silently merge conflicting editions or infer that an expansion rule applies to the base game.
