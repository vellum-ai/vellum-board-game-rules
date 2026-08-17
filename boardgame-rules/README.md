# boardgame-rules

Installable Vellum plugin for cited board-game rules answers, with a first-play
companion for teaching a game at the table, plus a score validator for
checking specific play situations against pre-authored worked examples.

One plugin owns the contract. Games are versioned corpora under `corpora/`. Wingspan and Cribbage are the first two.

## Supported games

19 games, one schema. Two are **reference corpora** with first-play analog
hooks; seventeen are **bounded interpreter corpora** migrated from the former
`interpreters/` packages — document-scoped, limited coverage, sources with
unresolved rights, entries marked `internal_only`. Every corpus abstains
outside its coverage boundary.

| Game | Editions | Entries | Corpus version |
| --- | --- | --- | --- |
| Wingspan (reference) | Base (2020), EU Expansion (2019), FAQ/errata overlay editions | 37 | 0.4.0 |
| Cribbage (reference) | Two-player standard, Muggins, Short (61), Skunk | 27 | 0.2.0 |
| A Feast for Odin · Ark Nova · Brass: Birmingham · Dune: Imperium · Dune: Imperium – Uprising · Gaia Project · Gloomhaven · Gloomhaven: JotL · Lost Ruins of Arnak · Nemesis · Pandemic Legacy S1 · Sky Team · Star Wars: Rebellion · Terraforming Mars · Twilight Imperium 4E · War of the Ring 2E · Flip 7 | document-scoped | 7–15 each | 0.1.0–0.2.0 |

Each migrated corpus carries a `migration` block naming its origin package;
run `boardgame_list_supported_games` for live coverage details.

## First-play companion

The companion serves ONE sitting — one table, one game, one night. It asks
what the players have played before, teaches in layers (goal → turn loop →
exceptions, with a short comprehension check between layers), stays available
for mid-game "can I do this now?" questions, and — when the corpus has a real
mapping — bridges a ruling to a game the players already know ("like claiming
a route in Ticket to Ride, except…"). Every analogy states both the shared
mechanic and the important difference.

Two layers of data make that work:

- **Analog hooks** live ON corpus entries (`analog_hooks[]`: `known_game_id`,
  `known_game_title`, `likeness`, `exception`). Analogies are corpus-owned so
  they can be *missing* — an entry without a hook makes the tool abstain from
  analogizing rather than improvise. Wingspan currently hooks into Catan,
  Ticket to Ride, Dominion, and Azul; Cribbage hooks into Poker and Blackjack.
  Hooks exist only where the mapping is real — Cribbage has none for the
  Wingspan target games because none would be honest.
- **Sittings** are per-conversation state under `data/sittings/`, keyed by the
  conversation id from `ToolContext`: game, edition, known games, last cited
  ruling, last analog used.

Invariants: cite first, analog second; never analogize an abstention; the
analogy is a teaching aid — the citation is the ruling.

### Where "who knows what" lives (do not collapse these)

- **Assistant memory** owns people and which games they already know. The
  plugin never invents that list.
- **`config.json`** (optional, user-edited, not shipped) can hold a standing
  `known_games` list merged into every sitting and a `web_fallback` toggle.
  Empty or absent is valid. It is read through one validated loader:
  `boardgame_list_supported_games` echoes the effective values plus any
  `unknown_keys` (typos) or `invalid_keys` (wrong type, default kept), so a
  misconfiguration is visible rather than silently ignored.
- **`data/sittings/`** holds this-sitting-only state, including the known
  games actually named for this table.
- **Corpora** own the analogies themselves.

### Sitting lifecycle and cleanup

Sittings are deleted by the `conversation-deleted` hook when their
conversation is deleted, and wiped wholesale by `conversations-cleared` on the
clear-all reset (both on the assistant ≥ 0.11 hook surface). As a belt on top,
a sitting untouched for ~12h is treated as over: ignored on read and purged at
init/shutdown. Live sittings deliberately survive a plain daemon restart — the
table may still be mid-game.

## Score validator

`boardgame_check_scenario` is a different job from `ask_rules`. Users describe
a specific play situation ("my 4-card Cribbage hand was J-5-5-5, starter was
the fourth 5 matching the Jack's suit — did I score 29?") and get back a
matching pre-authored worked example with its expected outcome and
point-by-point decomposition. **Hard-abstains when no worked example matches**
— never falls back to general rules retrieval, because guessing at a score is
worse than "I don't have this one."

Two pieces of schema power it:

- **`worked_example`** on a corpus entry — `scenario`, `expected_outcome`, optional `decomposition[]`
- **`applies_when`** on a corpus entry — trigger phrases the retriever also matches against ("did I score 29", "how many points for 8-7-7-6-2", …)

Retrieval only considers entries with a `worked_example` field, scores against
distinct query tokens (a one-word query cannot leak in via denominator
shrink), and requires the top result to clear both a score threshold and a
minimum of 2 distinct-token matches before returning anything.

Cribbage ships with two worked examples: the perfect 29 and the classic
8-7-7-6-2 double-run counting set. Any of the 19 corpora can add worked
examples the same way.

## Surfaces

- `tools/boardgame_ask_rules.ts` — answer a rules question with evidence or
  abstain; sitting-aware (defaults to the sitting's game, filters
  `analog_hooks` to the sitting's known games, records the cited ruling)
- `tools/boardgame_check_scenario.ts` — validate a specific play situation
  against a pre-authored worked example, or hard-abstain
- `tools/boardgame_list_supported_games.ts` — list installed games, editions, coverage
- `tools/boardgame_start_sitting.ts` / `tools/boardgame_update_sitting.ts` —
  start or update the per-conversation sitting
- `hooks/` — `init`, `shutdown`, `user-prompt-submit` (injects a short sitting
  card when a sitting exists; never rewrites the prompt), `post-tool-use`
  (enforces the ask_rules invariants on the result before the model reads it:
  no analogies on an abstention, no web fallback on answers or input errors,
  no `used: true` fallback without sources; self-gated to our own tool,
  fail-open), `conversation-deleted`, `conversations-cleared`
- `skills/boardgame-rules/` and `skills/first-play-companion/` — assistant skill instructions
- `src/` — retrieval (ask + scenario), corpus loading, sitting store, shared types
- `scripts/validate-corpus.ts` — validate all corpora (plain-English errors)
- `scripts/evaluate.ts` — regression eval suite (routes on `mode?: "ask" | "scenario"`)
- `scripts/sync-source-audit.ts` — regenerate each corpus's `source_audit` block from the registry/manifests
- `corpora/` — one JSON file per game plus `eval.json`

Compare, refresh, embeddings, live BGG, PDF ingest, UI, and cross-night
syllabi are deferred.

## Return contract

Every `boardgame_ask_rules` result includes:

- `game_id`, `game_title`, `corpus_version`
- `edition_id` — the edition filter that was applied; `null` means all editions were in scope (per-ruling editions are on `evidence[].edition_ids`). Filtering by an expansion edition also includes the editions it `inherits`
- `coverage_boundary`
- `evidence[]` with citation locator, URL, confidence, and rights flags
- `abstention`, `abstention_reason`, and `abstention_kind` (`"coverage"` = searched but nothing matched, `"input"` = unanswerable request, `null` when answered)
- `supported_games`
- `analog_hooks[]` — hooks from the top evidence filtered to the sitting's
  known games; always `[]` with no sitting, no known-game match, or on
  abstention
- `web_fallback` — on coverage abstentions only, live web-search results
  fetched in the same call (answer, sources, and a mandatory disclaimer);
  `null` on answered results and input-error abstentions. `used: true`
  requires at least one web source; a provider answer without sources is
  discarded, never relayed as web findings. Two cost gates: the search is
  skipped (`attempted: false`) when the abstention carries zero scored
  evidence (the question shares no vocabulary with the game, so it is
  off-domain rather than uncovered) and after 5 searches in one sitting.
  Needs the host runtime and a provider with native web search; fails open
  to the plain abstention. Disable with `"web_fallback": false` in
  `config.json`.

If `abstention` is true, do not invent a ruling — and no analogy is offered.
Web-fallback content is table guidance with sources, never a corpus-cited
ruling; `abstention` stays true when it is present.

`boardgame_check_scenario` returns worked-example matches or hard-abstains:

- Same identity + rights fields as above
- `matches[]` — each with `scenario`, `expected_outcome`, optional `decomposition`, plus citation and `distinct_matches`
- `abstention` is set when either the top score is below threshold OR fewer than two distinct query tokens match — the tool never falls back to general rules retrieval

## Adding a worked example

Any entry can carry an optional `worked_example` payload, which is what `check_scenario` retrieves against:

```json
{
  "id": "counting-perfect-29",
  "kind": "example_walkthrough",
  "summary": "...",
  "worked_example": {
    "scenario": "4-card hand of J-5-5-5, starter is the fourth 5 matching the Jack's suit — counting set J-5-5-5-5",
    "expected_outcome": "29 points (the maximum possible score in a Cribbage show)",
    "decomposition": ["Fifteens (16): ...", "Pairs (12): double pair royal on the four 5s", "..."]
  },
  "applies_when": ["perfect 29 cribbage", "four fives and a jack"]
}
```

Entries without `worked_example` are still fully usable by `ask_rules`; `check_scenario` simply ignores them.

## Install

```bash
assistant plugins install https://github.com/vellum-ai/vellum-board-game-rules/tree/main/boardgame-rules --name boardgame-rules
```

The `peerDependencies["@vellumai/plugin-api"]` range (`>=0.10.0 <0.12.0`)
declares host compatibility against the running assistant version. Today's
loader treats an unsatisfied range as a boot-time error log and loads the
plugin anyway, but that check is slated to harden into a hard reject — keep
the range tracking the assistant versions the plugin is actually tested on
(0.10–0.11 as of this writing).

## Validate and test

```bash
bun scripts/validate-corpus.ts   # validate all corpora
bun scripts/evaluate.ts           # run regression eval
```

Current baseline: 230 entries (2 with worked examples), 29 editions, 19 games,
0 validation errors, **88/88 eval tests passing** (retrieval + factual
assertions + analog filtering + sitting store/tool flow + one migration smoke
test per migrated game + cribbage scenario matching).

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full contributor guide. The short version: write one JSON file, validate it, open a PR.

## Source audit

Every corpus carries a validator-required `source_audit` block generated by
`scripts/sync-source-audit.ts`: registry audit status (with a `registry_ref`
back-pointer for the games in the audited list), the official sources located
for the game (each with an explicit rights posture — a public URL is a
citation target, never permission), the quarantined source artifacts backing
the corpus (linked to their upload-batch manifests by id and sha256), and a
one-line `rights_note`. `boardgame_list_supported_games` surfaces
`source_audit_status` and `rights_note` per game. The raw registry stays in
[`source-audit/`](source-audit/); the corpora no longer need it at answer
time.

## Formerly separate packages

- `wingspan-rules/` (FAQ/errata overlay): its unique entries are merged into
  `corpora/wingspan.json`; see that file's `migration` block for the imported
  ids and the dedupe mapping.
- `interpreters/` (pre-corpus inventory): every package migrated into
  `corpora/` under the unified schema.
- `source-audit/` (rights/source discovery): now lives at
  [`source-audit/`](source-audit/) inside this plugin directory.
