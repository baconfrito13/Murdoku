# Murdoku 🔎

A fully interactive, browser-based implementation of the **Murdoku** puzzle
mechanics — sudoku-style placement meets murder-mystery deduction. All cases,
characters, stories and art in this repository are original.

**Play it:** serve the folder statically and open `index.html`:

```bash
npx http-server -p 8080 .
# → http://localhost:8080
```

No build step, no dependencies — plain HTML/CSS/ES modules.

## How the game works

- The board is an N×N **crime-scene map** divided into colored rooms; furniture
  blocks squares.
- Place all suspects **and the victim** so every **row and column contains
  exactly one person**.
- Every clue on every card must be **true** ("beside" = orthogonally adjacent
  and in the same room; "south of" = strictly lower on the map).
- The murderer is whoever ends up **alone with the victim in the same room**.
  Make your accusation!

## Guarantees

- **Exactly one solution** per case — proven by exhaustive enumeration
  (`js/engine/solver.js`), tested for every shipped case.
- **No guessing** — every case is solvable start-to-finish by the
  human-technique logic engine that also powers hints.
- Campaign cases are generated offline (`scripts/build-cases.mjs`), verified,
  and frozen into `js/cases-data.js`. Daily/random cases are generated in the
  browser with the same guarantees enforced at generation time.

## Features

Campaign of 8 original cases (4×4 → 7×7), daily case, random cases, ✕-marks,
undo/redo, live error checking, reasoned hints, auto-✕, timer, autosave &
resume, keyboard controls, touch + long-press, light/dark themes, ARIA grid
semantics and reduced-motion support.

## Fidelity notes

Mechanics follow the published Murdoku rules: one person per row and column
(victim included, placed by the solver), clues as hard rules, *beside* =
adjacent **and** in the same room, strict compass directions, ✕-elimination,
and the murderer read off the solved layout as the one person alone with the
victim. Scope choices vs. the book: boards are square (4×4 → 7×7 — the book
scales to larger and non-square grids) and there are no scene-specific twist
rules. All characters, case titles, stories and clue wording here are
original.

## Development

```bash
npm test          # engine + case-integrity tests (node --test)
npm run e2e       # Playwright end-to-end play-through
npm run build     # regenerate + re-verify frozen campaign cases
```
