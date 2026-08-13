# boardgame-rules

Installable Vellum plugin for cited board-game rules answers, with a first-play
companion for teaching a game at the table.

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
  `known_games` list merged into every sitting. Empty or absent is valid.
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

## Surfaces

- `tools/boardgame_ask_rules.ts` — answer a rules question with evidence or
  abstain; sitting-aware (defaults to the sitting's game, filters
  `analog_hooks` to the sitting's known games, records the cited ruling)
- `tools/boardgame_list_supported_games.ts` — list installed games, editions, coverage
- `tools/boardgame_start_sitting.ts` / `tools/boardgame_update_sitting.ts` —
  start or update the per-conversation sitting
- `hooks/` — `init`, `shutdown`, `user-prompt-submit` (injects a short sitting
  card when a sitting exists; never rewrites the prompt),
  `conversation-deleted`, `conversations-cleared`
- `skills/boardgame-rules/` and `skills/first-play-companion/` — assistant skill instructions
- `src/` — retrieval, corpus loading, sitting store, shared types
- `scripts/validate-corpus.ts` — validate all corpora (plain-English errors)
- `scripts/evaluate.ts` — regression eval suite
- `corpora/` — one JSON file per game plus `eval.json`

Compare, refresh, embeddings, live BGG, PDF ingest, UI, and cross-night
syllabi are deferred.

## Return contract

Every `boardgame_ask_rules` result includes:

- `game_id`, `game_title`, `corpus_version`
- `edition_id` — the edition filter that was applied; `null` means all editions were in scope (per-ruling editions are on `evidence[].edition_ids`). Filtering by an expansion edition also includes the editions it `inherits`
- `coverage_boundary`
- `evidence[]` with citation locator, URL, confidence, and rights flags
- `abstention` and `abstention_reason`
- `supported_games`
- `analog_hooks[]` — hooks from the top evidence filtered to the sitting's
  known games; always `[]` with no sitting, no known-game match, or on
  abstention

If `abstention` is true, do not invent a ruling — and no analogy is offered.

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

Current baseline: 230 entries, 29 editions, 19 games, 0 validation errors,
73/73 eval tests passing (retrieval + factual assertions + analog filtering +
sitting store/tool flow + a migration smoke test per migrated game).

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full contributor guide. The short version: write one JSON file, validate it, open a PR.

## Formerly separate packages

- `wingspan-rules/` (FAQ/errata overlay): its unique entries are merged into
  `corpora/wingspan.json`; see that file's `migration` block for the imported
  ids and the dedupe mapping.
- `interpreters/` (pre-corpus inventory): every package migrated into
  `corpora/` under the unified schema.
- `source-audit/` (rights/source discovery): now lives at
  [`source-audit/`](source-audit/) inside this plugin directory.
