# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # type-check (tsc --noEmit) then production build to dist/
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit — type-check only (also gated inside build)
npm run test       # Vitest: unit (scoring.ts) + integration (App) — run once
npm run test:watch # Vitest in watch mode
npm run test:e2e   # Playwright E2E (auto-starts the dev server)
```

The codebase is **TypeScript** (`.ts` / `.tsx`) with `strict` mode on; `build` is gated on `tsc --noEmit`. There is no linter or formatter configured.

## Testing

The suite is a pyramid — unit (`src/scoring.test.ts`, the pure engine), integration (`src/App.test.tsx`, the React app via Testing Library + jsdom), and E2E (`e2e/scoreboard.spec.ts`, Playwright) reserved for things only a real browser can test (true page-reload persistence, real-browser render). Vitest reads its config from the `test` block in `vite.config.ts`; `e2e/` is excluded from Vitest so Playwright owns it.

Two rules:

- **Always add tests for new features and bug fixes.** Put logic-only cases as unit tests against `scoring.ts`, anything involving React state/persistence/UI as integration tests against `App`, and use E2E only when a real browser is the only honest way to cover it. A bug fix should ship with a regression test that fails on the old code.
- **Always run `npm run test` before pushing to `main`, and it must pass.** Run `npm run test:e2e` too when the change touches the UI, persistence, or build. Never push with failing or skipped tests.

## Architecture

A mobile-first, single-page React 18 + TypeScript + Vite tennis scoreboard. The design deliberately separates *pure scoring logic* from *React state plumbing* from *presentation*:

- **`src/scoring.ts`** — the pure, framework-agnostic scoring engine. No React, no side effects. `applyPoint(state, playerIndex)` is an immutable reducer that returns a brand-new state object, resolving all point→game→set→tiebreak→match transitions internally. Because every call returns a fresh object, the whole match state can be snapshotted cheaply. Match rules (best-of-3, 6 games/set, tiebreak to 7, win-by-2) live in `DEFAULT_CONFIG`; the engine reads them from `state.config`, so changing format is a config change, not a logic change. Display formatting (`formatPoints`, `isDeuce`) also lives here so the UI never computes `0/15/30/40/AD`/deuce logic itself. The **shared domain types** (`MatchState`, `MatchConfig`, `PlayerIndex`) are exported from here and imported by the hooks and components.

- **`src/useMatch.ts`** — the single source of state for the app, a `useReducer` wrapping `scoring.ts`. The reducer's state is a **history object** `{ past, present, future }` (undo/redo stacks of full scoring-engine snapshots). `SCORE` pushes `present` onto `past` and clears `future`; `UNDO`/`REDO` move snapshots between the stacks. `RENAME` is treated as cosmetic and mutates `present` *without* touching the history stacks (renaming is not an undoable move). The entire history object is persisted to `localStorage` under key `tennis-scoreboard:v1` on every change, and hydrated via a lazy initializer that validates shape before trusting stored data. **If you change the persisted state shape, bump `STORAGE_KEY`** to avoid hydrating incompatible old data.

- **`src/App.tsx` + `src/components/`** — presentation only. `App` consumes `useMatch` and wires callbacks to `Scoreboard` (the 2-row grid) and `Controls` (+score / undo / redo / reset buttons). Components receive state + callbacks as props and render; they hold no scoring logic.

### Theming / layout
- **`src/theme.css`** — all design tokens (colors, radii, fonts) as CSS custom properties. Restyling is intended to be a one-file change; prefer editing tokens here over hardcoding values in component styles.
- **`src/index.css`** — the no-scroll, full-viewport layout (`100dvh`, large tap targets). The whole UI is meant to fit one screen with no scrolling — preserve that constraint when adding UI.

## Deployment

Deployed to **Vercel** (team `mikedelcastillos-projects`) as project `tennis-scoreboard`, live at https://scoreboard.mikedc.io. Deploy with:

```bash
npx vercel deploy --prod --yes --scope mikedelcastillos-projects
```

The custom domain `scoreboard.mikedc.io` is attached in Vercel, but `mikedc.io` uses **Cloudflare** nameservers — DNS records must be managed in Cloudflare (`CNAME scoreboard → cname.vercel-dns.com`), not Vercel. GitHub repo: https://github.com/mikedelcastillo/tennis-scoreboard.
