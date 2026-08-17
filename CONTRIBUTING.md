# Contributing a Game Corpus

This plugin answers board-game rules questions from versioned corpora. Each game is one JSON file. If you love a game and want your assistant to answer rules questions about it, this guide is for you.

## The short version

1. Read this guide
2. Copy `corpora/wingspan.json` as a template
3. Replace the content with your game's rules — in your own words
4. Run `bun scripts/validate-corpus.ts`
5. Fix any errors the validator reports
6. Open a PR

That's it. No code to write. No retrieval logic to understand. Just one JSON file.

## The golden rule

**Write your own interpretation of every rule.** Do not copy text from the rulebook, cards, reference cards, player aids, or any publisher material. You can read the rulebook, understand it, and write your own summary — but the words in your corpus entry must be yours.

Every entry has `redistribution_permitted: false` and `full_text_included: false`. This is enforced by the validator. The repository contains original interpretations and metadata, not publisher text.

If you're unsure whether your summary is too close to the source: rewrite it in a different structure. Instead of restating the rulebook's sentence order, explain the rule as you would to a friend at the table.

## Corpus file structure

One file per game, named `corpora/<game-name>.json`. The file has three parts:

### 1. Corpus metadata

```json
{
  "corpus_id": "wingspan",
  "game_title": "Wingspan",
  "corpus_version": "0.2.0",
  "generated_at": "2026-08-13",
  "description": "Original interpretation rules reference for Wingspan.",
  "full_rulebook_text_included": false,
  "coverage_boundary": "Covers the base game and European Expansion. Other expansions are out of scope."
}
```

- **`corpus_id`**: unique identifier, kebab-case, matching the filename (e.g. `ark-nova` for `corpora/ark-nova.json`)
- **`game_title`**: the game's name as it appears on the box
- **`corpus_version`**: semantic version; bump when you change entries
- **`coverage_boundary`**: plain English description of what IS and IS NOT covered. This is shown to users when they ask about your game, so be specific.

### 2. Editions

Editions let the plugin distinguish between base games, expansions, and variants. An expansion can **inherit** from a base edition, meaning all base-game rules apply unless the expansion explicitly overrides them.

```json
"editions": [
  {
    "edition_id": "base-en-1st-2020",
    "game": "Wingspan",
    "scope": "Base game, first English edition (2020)",
    "language": "en",
    "status": "canonical",
    "inherits": null,
    "full_text_included": false
  },
  {
    "edition_id": "eu-expansion-en-1st-2019",
    "game": "Wingspan",
    "scope": "European Expansion expansion (2019)",
    "language": "en",
    "status": "expansion",
    "inherits": "base-en-1st-2020",
    "full_text_included": false
  }
]
```

- **`edition_id`**: unique within this corpus, kebab-case
- **`status`**: `canonical` for the base game, `expansion` for expansions, `variant` for variant rules
- **`inherits`**: the `edition_id` this edition stacks on top of, or `null` for the root. Retrieval honors this: asking with an expansion's `edition_id` also searches the editions it inherits from, so expansion players still get base-game rulings
- **`scope`**: one-line description of what this edition covers

### 3. Entries

Each entry is one rules concept — a rule, a scoring atom, a setup step, a power type, etc. Break rules into the smallest useful units.

```json
{
  "id": "brown-power-direction",
  "title": "Brown powers activate right-to-left",
  "kind": "rule_paraphrase",
  "edition_ids": ["base-en-1st-2020"],
  "topics": ["powers", "brown", "activation", "order"],
  "summary": "Brown (When Activated) powers resolve from right to left across the birds in a habitat row. Process the rightmost bird first, then move leftward.",
  "confidence": "high",
  "source_locator": {
    "url": "https://stonemaiergames.com/games/wingspan/rules/",
    "locator": "Power Types — When Activated",
    "source_kind": "official_publisher_rules",
    "official_source": true,
    "accessed_at": "2026-08-13"
  },
  "rights_flags": {
    "original_interpretation": true,
    "metadata_only": false,
    "source_text_stored": false,
    "full_text_included": false,
    "long_quotation_included": false,
    "redistribution_permitted": false,
    "internal_only": false
  }
}
```

#### Required fields

| Field | Description |
| --- | --- |
| `id` | Unique within the corpus, kebab-case |
| `title` | Short descriptive title — this is what the assistant sees first |
| `edition_ids` | Which editions this entry applies to (must match declared editions) |
| `summary` | Your original interpretation of the rule. This is the answer text. |
| `confidence` | `high`, `medium`, or `low` |
| `source_locator` | Where you verified this rule |
| `rights_flags` | Always the same shape; `redistribution_permitted` must be `false` |

#### Optional fields

| Field | Description |
| --- | --- |
| `kind` | Entry type: `rule_paraphrase`, `scoring_atom`, `setup_step`, `turn_structure`, `example`, etc. |
| `topics` | Array of topic tags — helps retrieval match queries |
| `section` / `subsection` | Section path in the source document |
| `interpretation_type` | `rule_atom`, `worked_example`, `edge_case`, etc. |
| `analog_hooks` | Honest mappings to games players may already know, used by the first-play companion. Each hook needs `known_game_id` (lowercase kebab-case), `known_game_title`, `likeness` (what genuinely transfers), and `exception` (where the analogy breaks). Only add a hook when the mapping is real — no hook means the assistant cites without analogizing, which is correct behavior. |

#### Writing good summaries

The summary is the answer the assistant returns. Write it to be:

- **Self-contained** — someone reading just the summary should understand the rule
- **Direct** — lead with the answer, not the context
- **Precise** — use exact numbers, names, and directions from the rulebook
- **Your words** — original paraphrase, not copied text

Bad: "The rules say that when activated powers are resolved in a certain order."

Good: "Brown (When Activated) powers resolve from right to left across the birds in a habitat row. Process the rightmost bird first, then move leftward."

#### Choosing confidence

- **`high`**: Verified against the official rulebook or FAQ. No ambiguity.
- **`medium`**: Verified but involves some interpretation, or the source is a summary rather than the official rulebook.
- **`low`**: Edge case, ambiguous rule, or based on community consensus rather than official text.

#### Source locators

Point to the official source you used to verify the rule:

```json
"source_locator": {
  "url": "https://stonemaiergames.com/games/wingspan/rules/",
  "locator": "Power Types — When Activated",
  "source_kind": "official_publisher_rules",
  "official_source": true,
  "accessed_at": "2026-08-13"
}
```

Common `source_kind` values:
- `official_publisher_rules` — the publisher's rulebook or FAQ page
- `official_player_aid` — publisher-commissioned reference (e.g., Rulepop)
- `community_consensus` — widely agreed but not publisher-stated
- `widely_published_reference` — common reference (e.g., Bicycle Cards for Cribbage)

### 4. Source audit block (auto-generated)

Every corpus also carries a `source_audit` block — the corpus-owned summary of
the source-audit registry's findings for that game: audit status, official
sources with rights posture, quarantined source artifacts linked to their
upload-batch manifests, and a one-line `rights_note`. **Do not write it by
hand.** After adding or editing a corpus (or anything under
`source-audit/data/`), regenerate it:

```bash
cd boardgame-rules && bun scripts/sync-source-audit.ts
```

The script joins the registry (`source-audit/data/source-audit-registry.latest.json`),
the upload-batch manifests, and your corpus's own provenance blocks
(`source_artifact`, `source_artifacts`, `artifact_provenance`,
edition-level locators). Games outside the registry's fixed list get
`audit_status: "not_in_registry_scope"` — that is normal, not an error. The
validator requires the block and checks its shape (including that every
sha256 is a real 64-hex fingerprint and every official source carries a
`rights_status`).

## Validation

Before opening a PR, run:

```bash
cd boardgame-rules && bun scripts/validate-corpus.ts
```

The validator checks:

- All required fields are present
- Every `edition_ids` value in an entry resolves to a declared edition
- `inherits` chains resolve and are not circular
- No duplicate entry IDs
- Confidence values are valid (`high`, `medium`, `low`)
- All required `rights_flags` keys are present
- `redistribution_permitted` is `false`
- A generated `source_audit` block is present, with `audit_status` / `audited_at` / `rights_note`, a complete `registry_ref` (or explicit `null`), a `rights_status` on every official source, an `artifact_id` and `manifest_path` on every source artifact, and 64-character hex `sha256` fingerprints
- `interpretation_schema` shape is correct if present

**Errors are in plain English.** If you make a typo, you'll see something like:

```
✗ wingspan.json: entry "brown-power" references unknown edition "base-game" — declared editions are: base-en-1st-2020, eu-expansion-en-1st-2019
```

Fix the error, re-run, repeat until you see:

```
✓ your-game.json: N entries, M editions — valid
```

## Evaluation (optional)

If you want to test that your corpus returns good answers, add a suite to `corpora/eval.json`. The harness is strict about keys: an unknown suite or test key stops the run with a named error, so copy this shape exactly.

```json
{
  "game": "your-game",
  "tests": [
    {
      "label": "birdfeeder dice count",
      "query": "How many dice does the birdfeeder have?",
      "expect_ids": ["setup-dice-count"],
      "expect_hit_1": true,
      "expect_abstention": false
    },
    {
      "label": "off-domain question abstains",
      "query": "how do I castle my king",
      "expect_abstention": true
    }
  ]
}
```

- Suite keys: `game` (the corpus id), optional `mode` (`"ask"` default, or `"scenario"` to route through the score validator), `tests`.
- Test keys: `label`, `query`, `expect_ids` + `expect_hit_1`/`expect_hit_3`/`expect_hit_5`, `expect_abstention`, `expect_summary_contains`/`expect_summary_not_contains`, and, per test, an optional strict `edition` filter. Scenario mode adds `expect_outcome_contains`/`expect_decomposition_contains`. The full list is `TEST_KEYS` in `scripts/evaluate.ts`.
- There is no suite-level `edition`; pin editions per test.

Then run:

```bash
cd boardgame-rules && bun scripts/evaluate.ts
```

## Opening a PR

1. Create a branch: `git checkout -b add-<game-name>`
2. Add your corpus file: `corpora/<game-name>.json`
3. Validate: `bun scripts/validate-corpus.ts`
4. Commit and push
5. Open a PR with:
   - The game name in the title
   - Entry count and edition count
   - Any coverage limitations you're aware of

## FAQ

**Can I use content from BoardGameGeek?**
BGG metadata (player count, playtime, year, designer) is fine for identity. BGG terms prohibit using their data to train AI/LLMs and modifying retrieved data. BGG description text is marketing copy, not rules. Don't use it as a rules source.

**Can I use a PDF someone uploaded?**
A user-uploaded PDF is the user's own copy for personal use. It is not a license to redistribute the text. Read it, understand the rules, write your own interpretation, and cite the publisher's official page as the source locator.

**How many entries should I write?**
Enough to cover the rules a player would actually need during a game. Wingspan has 27. A simpler game might have 10-15. A complex game might have 50+. Quality matters more than quantity — every entry should be a rule someone would actually ask about.

**What if two sources disagree?**
Write separate entries for each interpretation, mark confidence as `medium` or `low`, and note the conflict in the summary. The plugin should surface the disagreement, not hide it.

**Can I contribute in a language other than English?**
Yes. Set the `language` field on your editions and use the appropriate language in your summaries. The retrieval is language-agnostic (token-based).
