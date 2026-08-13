---
name: boardgame-rules
description: >-
  Answer board-game rules questions from the installed boardgame-rules plugin.
  Use when the user asks how a supported game works, what a rule is, whether a
  move is legal, or wants a "did I score this right?" scenario check. Currently
  Wingspan and Cribbage are installed.
metadata:
  vellum:
    display-name: Board Game Rules
    activation-hints:
      - User asks a rules question about Wingspan, Cribbage, or another installed game
      - User wants a cited ruling, edition check, or whether a game is supported
      - User describes a scenario ("did I score this right?") and wants a worked-example check
    avoid-when:
      - User wants strategy advice rather than a rules answer
      - User asks to copy or paste a rulebook
---

Answer from the installed `boardgame-rules` plugin. Do not invent a ruling.

## Choose a tool

- `boardgame_ask_rules` — general rule question ("how do birdfeeder food dice work", "what's His Nobs").
- `boardgame_check_scenario` — user describes a concrete situation and wants the outcome ("my 4-card hand was J-5-5-5, starter was the fourth 5 matching the Jack's suit — did I score 29?"). This tool only returns pre-authored worked examples and hard-abstains when none match.
- `boardgame_list_supported_games` — call first if you don't already know the game is installed.

## Steps

1. If the game isn't obviously installed, call `boardgame_list_supported_games`.
2. Pick the right tool: scenario → `boardgame_check_scenario`; general rule → `boardgame_ask_rules`.
3. Pass `game_id` when known. Pass `edition_id` when the user names an edition or variant.
4. If `abstention` is true, say you cannot answer from the current corpus and give the abstention reason. Do not guess. Do not fall back from `check_scenario` to `ask_rules` silently — the tools do different things.
5. If `abstention` is false, answer from the top evidence or match only. Include game, edition, corpus version, and the citation locator.
6. Stay inside `coverage_boundary`. Limited documents are not complete rulebooks.

Never reproduce rulebook, card, or artwork text. The plugin stores original interpretations only.
