---
name: boardgame-rules
description: >-
  Answer board-game rules questions from the installed boardgame-rules plugin.
  Use when the user asks how a supported game works, what a rule is, or whether
  a move is legal. Currently only Wingspan is installed.
metadata:
  vellum:
    display-name: Board Game Rules
    activation-hints:
      - User asks a rules question about Wingspan or another installed board game
      - User wants a cited ruling, edition check, or whether a game is supported
    avoid-when:
      - User wants strategy advice rather than a rules answer
      - User asks to copy or paste a rulebook
---

Answer from the installed `boardgame-rules` plugin. Do not invent a ruling.

## Steps

1. Call `boardgame_list_supported_games` if the game is not obviously installed.
2. Call `boardgame_ask_rules` with the question and `game_id` when known.
3. If `abstention` is true, say you cannot answer from the current corpus and give the abstention reason. Do not guess.
4. If `abstention` is false, answer from the top evidence only. Include game, edition, corpus version, and the citation locator.
5. Stay inside `coverage_boundary`. Limited documents are not complete rulebooks.

Never reproduce rulebook, card, or artwork text. The plugin stores original interpretations only.
