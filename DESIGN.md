# Murdoku Web — Design

A faithful, fully interactive browser implementation of the *Murdoku* logic-puzzle
mechanics (sudoku-style placement + murder-mystery deduction), with 100% original
cases, characters, art and writing.

## Game rules (fidelity targets)

1. The board is an N×N map of a crime scene, partitioned into colored, contiguous
   **rooms**. Some cells contain **furniture/objects** (nobody can stand there).
2. The **people** — (N−1) suspects plus **the victim** — must each be placed on an
   empty floor cell so that **every row and every column contains exactly one
   person** (the sudoku pressure).
3. Every person's card lists **clues**, and *every clue must be true* in the final
   layout. Clue vocabulary:
   - **Rooms** — "was in the Library" / "was not in the Kitchen"
   - **Objects** — "was beside a bookshelf" (*beside* = orthogonally adjacent
     AND in the same room — never diagonal, never across a wall),
     "was not beside a candle", "in the same row/column as the stove"
   - **Directions** — "was north/south/east/west of X" (strictly higher/lower
     row or column on the map; south = lower on the map)
   - **Relationships** — "was beside Y", "was in the same room as Y",
     "was not in the same room as Y", "was alone in a room"
   - **Walls** — "was against the north wall" (edge rows/columns)
4. When the layout is solved, **the murderer is the suspect who is alone with the
   victim in the same room** (the victim's room contains exactly two people).
5. The player marks impossible cells with ✕, places people, then **makes an
   accusation**.

## Hard guarantees

- **Exactly one solution** for every case: verified by exhaustive backtracking
  enumeration over row/column-disjoint placements (trivial for N ≤ 8).
- **No guessing required**: every shipped case must additionally be solvable by
  the deterministic logic engine (constraint propagation: unary clue filtering,
  row/column elimination, naked/hidden singles, AC-3 over binary clues, room
  capacity reasoning). This is also what powers **hints**.
- **Exactly one suspect** shares the victim's room in the solution, so the
  murderer is always well defined.

## Architecture

Static site, zero dependencies, ES modules shared verbatim between browser and
Node test runner.

```
index.html            single page app shell
css/style.css         noir theme, light/dark, responsive
js/engine/rng.js      mulberry32 seeded PRNG
js/engine/model.js    board/person/case model + geometry helpers
js/engine/clues.js    clue constructors, full evaluation, candidate filtering, text
js/engine/solver.js   exhaustive counter + logic (hint/fairness) engine
js/engine/generator.js seeded scene/solution/clue-set generator with minimization
js/cases-data.js      frozen, pre-verified campaign cases (generated, then locked)
js/ui/*.js            grid renderer, cards, input (mouse/touch/keyboard), undo,
                      storage, accusation flow, tutorial
tests/engine.test.mjs node:test — uniqueness + fairness of every shipped case,
                      engine unit tests
e2e/game.spec.mjs     Playwright end-to-end play-through
```

## UX (best practices adopted from mature sudoku web apps)

- Select-a-suspect → tap-a-cell placement; tap placed person to pick up.
- ✕-mark tool (right-click / long-press / `X` key) for eliminations.
- Undo/redo (buttons + Ctrl-Z / Ctrl-Y), full history.
- Optional live error checking; explicit "Check" otherwise; violated clues and
  row/column conflicts are highlighted with explanations.
- Hint system that names the *reasoning*, not just the answer.
- Keyboard-first play: arrows move focus, 1…N arm a person, Enter places, X marks.
- Touch targets ≥ 44px, responsive portrait/landscape, no zoom traps.
- Progress autosaved per case (localStorage); settings + stats persisted.
- ARIA grid semantics, live-region announcements, prefers-reduced-motion,
  light/dark themes.
