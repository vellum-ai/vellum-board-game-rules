---
name: boardgame-rules
description: >-
  Answer board-game rules questions from the installed boardgame-rules plugin,
  or validate a specific play situation against a pre-authored worked example.
  Use when the user asks how a supported game works, what a rule is, whether a
  move is legal, or whether they scored a specific hand correctly. Call
  boardgame_list_supported_games for what is installed.
metadata:
  vellum:
    display-name: Board Game Rules
    activation-hints:
      - User asks a rules question about an installed board game
      - User wants a cited ruling, edition check, or whether a game is supported
      - User describes a specific play situation and wants to check whether they scored it correctly
    avoid-when:
      - User wants strategy advice rather than a rules answer
      - User asks to copy or paste a rulebook
---

Answer from the installed `boardgame-rules` plugin. Do not invent a ruling.

## Which tool

- `boardgame_ask_rules` — user asks a general rules question ("how does the birdfeeder work?"). Returns evidence entries with citations, or abstains.
- `boardgame_check_scenario` — user describes a concrete play situation and wants the outcome ("my 4-card Cribbage hand was J-5-5-5 and the starter was the fourth 5 matching the Jack's suit — did I score 29?"). Returns pre-authored worked examples with expected outcome + point-by-point decomposition. **Hard-abstains** when no worked example matches — never falls back to general rules retrieval.
- `boardgame_list_supported_games` — enumerate installed games.

The two retrieval tools do different jobs on purpose. `ask_rules` returns rule paraphrases with citations. `check_scenario` returns concrete worked examples or nothing. Do not mix results between them silently.

## Steps

1. Call `boardgame_list_supported_games` if the game is not obviously installed.
2. Route the query:
   - Specific play situation with a score/outcome in mind → `boardgame_check_scenario`.
   - General rules question → `boardgame_ask_rules`.
3. Pass `game_id` explicitly (there are many games installed and `ask_rules` requires a game — either from `game_id` or from an active sitting).
4. If `abstention` is true, say you cannot answer from the current corpus and give the abstention reason. Do not guess. Do not fall back from `check_scenario` to `ask_rules` unless the user asks. If an `ask_rules` result carries `web_fallback` with `used: true`, you may then relay its answer and sources, clearly labeled as live web information rather than a corpus ruling.
5. If `abstention` is false, answer from the top evidence (or top match) only. Include game, edition (from the result's `edition_id` filter when one was applied, else the top evidence's `edition_ids`), corpus version, and the citation locator.
6. Stay inside `coverage_boundary`. Limited documents are not complete rulebooks.

## Image inputs (Wingspan scoring)

Wingspan end-game scoring is a computation over the player's tableau, not a lookup against pre-authored outcomes. The plugin has no Wingspan worked examples and `boardgame_check_scenario` will hard-abstain. When the user attaches photos and wants help counting:

1. Read the images inline. Extract the counts you need — birds per habitat, cards on each bonus card, eggs, cached food, tucked cards, whichever the scoring path requires.
2. Call `boardgame_ask_rules` (`game_id: wingspan`) for the base rule of whichever bonus card or end-of-round objective governs the score. Anchor the ruling to the corpus, not to text visible on the card image.
3. Do the arithmetic yourself. Show what you counted from the image and the sum. Do not claim the plugin computed the score.
4. If a count is ambiguous or the image is unclear, ask the user to confirm before adding it in.

Never reproduce rulebook, card, or artwork text. The plugin stores original interpretations only.
