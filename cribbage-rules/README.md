# Cribbage Rules Plugin

A compact, versioned Cribbage rules reference and original-interpretation layer. It stores short original paraphrases, structured play aids, edition scope, source locators, and confidence states — not a copy of any specific publisher's rulebook text.

## What it ships

- `cribbage_rules_search`: a read-only tool that searches `data/cribbage-corpus.json`.
- Corpus `0.1.0`, covering the two-player standard game (to 121), the Muggins variant, the short-game (to 61) variant, and the skunk / double-skunk scoring variant.
- Explicit edition scope, source locators, confidence, and rights flags on interpretation records.
- Live lookup fallback for questions outside the local coverage (three-hand, four-hand, six-card / seven-card partnership variants, tournament clarifications).

## Rights boundary

`full_rulebook_text_included` is false. The underlying game of Cribbage is in the public domain — the rules descend from Sir John Suckling's 17th-century game and have been continuously published for centuries. What is NOT in the public domain is any particular publisher's phrasing of those rules. This corpus stores original paraphrases only. It does not copy card-publisher rulebook prose, tournament handbook text, or example wording verbatim.

The corpus contains no scanned rulebooks, no long quotations, and no artwork. A maintainer must confirm permission before adding any full-text source. If permission is unavailable or unclear, keep only links, metadata, and original summaries.

## Edition and variant handling

The corpus distinguishes:

- `two-player-standard-en` — the canonical two-player game to 121, as it is most commonly published in English-language reference material.
- `muggins-variant` — the "opponent claims missed points" scoring option, always in effect in most competitive play.
- `shorter-61-en` — the short game to 61 points, sometimes called a "once-around" game.
- `skunk-rule-variant` — the double-game skunk (loser under 91) and quadruple-game double-skunk (loser under 61) scoring options.

The three variant editions layer on top of the standard game. Entries scoped only to a variant edition are advisory in that context and do not overwrite the standard rule.

Cribbage has widely-played three-hand, four-hand partnership, and other multi-player forms. Those are out of scope for this corpus release. Use live lookup for questions that name those forms explicitly.

## Validation

```text
node tools/validate.mjs
```

The local corpus is a fast deterministic layer, not a replacement for a specific publisher's or tournament body's official ruleset. Do not silently merge conflicting variants or infer that a variant rule applies to the standard game.
