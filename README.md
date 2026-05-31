# 🎾 Tennis Scoreboard

A mobile-first, single-page tennis scoreboard. Tap to score, and the app handles
full tennis rules for you — points, games, sets, deuce/advantage, tiebreaks, and an
auto-declared match winner. The whole UI fits on one screen with **no scrolling**.

**Live:** https://scoreboard.mikedc.io

## Features

- **Full match scoring** — points (`0 / 15 / 30 / 40 / AD`), deuce, games, best-of-3
  sets, tiebreak at 6–6, and automatic winner detection.
- **One-tap scoring** — big `+` buttons for each player.
- **Undo / Redo** — step the score backward and forward through the whole match.
- **Persistent** — the match (and its undo history) survives a page refresh via
  `localStorage`.
- **Editable names** — tap a player's name to rename them.
- **Mobile-first, no-scroll layout** — sized to `100dvh` with large tap targets.
- **Easily re-themeable** — every color, radius, and font lives in
  [`src/theme.css`](src/theme.css) as CSS custom properties. Restyling is a one-file change.

## Scoreboard layout

A 2-row grid (one row per player):

| Player | Sets | Games | Points |
| ------ | ---- | ----- | ------ |
| Player 1 | 1 | 4 | 40 |
| Player 2 | 0 | 5 | AD |

## Tech stack

- [React 18](https://react.dev/) + [Vite](https://vite.dev/)
- Plain CSS with custom-property design tokens
- A pure, framework-agnostic scoring engine ([`src/scoring.js`](src/scoring.js))

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build to dist/
npm run preview  # preview the production build
```

## Project structure

```
src/
  main.jsx            # React entry point
  App.jsx             # app shell
  scoring.js          # pure tennis scoring engine (no React)
  useMatch.js         # state hook: undo/redo + localStorage persistence
  theme.css           # design tokens — the "easily updatable" knob
  index.css           # full-viewport, no-scroll layout
  components/
    Scoreboard.jsx    # the 2-row scoring grid
    Controls.jsx      # +score / undo / redo buttons
```

## How scoring works

`src/scoring.js` is a pure reducer: `applyPoint(state, playerIndex)` returns a brand-new
state with the point applied and any game/set/match transitions resolved. Because it's
pure and immutable, undo/redo is implemented simply by snapshotting state before each
point. The engine is configurable (sets to win, games per set, tiebreak target) via
`DEFAULT_CONFIG`.

## License

MIT
