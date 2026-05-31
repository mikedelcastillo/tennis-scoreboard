// Pure tennis scoring engine — no React, no side effects.
// `applyPoint` always returns a brand-new state object (safe to snapshot for undo/redo).

export type PlayerIndex = 0 | 1

// How a game resolves once both players reach 40 (3 points each):
//  - advantage:            classic, win by two points forever.
//  - sudden-death-2nd-deuce: one advantage is allowed; if the game returns to
//                          deuce (both reach 4) the very next point wins.
//  - no-deuce:             no advantage at all — 40-40 is decided by one point.
export type DeucePolicy = 'advantage' | 'sudden-death-2nd-deuce' | 'no-deuce'

// A finished match is won by a player, or drawn (barangay single-set draw).
export type MatchOutcome = PlayerIndex | 'draw'

export interface MatchConfig {
  setsToWin: number // Best of 1/3/5 → 1/2/3
  gamesToWinSet: number // games to win a set (4, 6, 8, 10, …)
  gamesSlideTwo: boolean // win a set by two games (else first-to-target)
  tiebreakEnabled: boolean // play a tiebreak at games target-all (normal sets)
  tiebreakInLastSet: boolean // play a tiebreak in the deciding set
  tiebreakTo: number // points to win a tiebreak (7, 10, …)
  tiebreakSlideTwo: boolean // win the tiebreak by two points (else first-to-target)
  deuce: DeucePolicy // how a game resolves at deuce
  barangayDraw: boolean // single-set only: draw at (gamesToWinSet − 1) all
}

export interface MatchState {
  players: [string, string]
  completedSets: Array<[number, number]> // [gamesP0, gamesP1] for finished sets
  setsWon: [number, number]
  games: [number, number] // games in the current set
  points: [number, number] // raw point counts in the current game / tiebreak
  inTiebreak: boolean
  winner: MatchOutcome | null
  config: MatchConfig
}

export const DEFAULT_CONFIG: MatchConfig = {
  setsToWin: 2, // best-of-3
  gamesToWinSet: 6,
  gamesSlideTwo: true,
  tiebreakEnabled: true,
  tiebreakInLastSet: true,
  tiebreakTo: 7,
  tiebreakSlideTwo: true,
  deuce: 'advantage',
  barangayDraw: false,
}

// Quick-pick formats for the settings pane. Both are standard tennis (6-game
// sets, slide-2, tiebreak to 7 including the last set, advantage deuce); they
// differ only in match length.
export interface ScoringPreset {
  id: string
  label: string
  config: MatchConfig
}

export const SCORING_PRESETS: ScoringPreset[] = [
  { id: 'bo3', label: 'Best of 3', config: { ...DEFAULT_CONFIG, setsToWin: 2 } },
  { id: 'bo5', label: 'Best of 5', config: { ...DEFAULT_CONFIG, setsToWin: 3 } },
]

export function createInitialState(
  players: readonly [string, string] = ['Player 1', 'Player 2'],
  config: MatchConfig = DEFAULT_CONFIG,
): MatchState {
  return {
    players: [players[0], players[1]],
    completedSets: [], // array of [gamesP0, gamesP1] for finished sets
    setsWon: [0, 0],
    games: [0, 0], // games in the current set
    points: [0, 0], // raw point counts in the current game / tiebreak
    inTiebreak: false,
    winner: null, // 0 | 1 | null
    config: { ...config },
  }
}

const other = (i: PlayerIndex): PlayerIndex => (i === 0 ? 1 : 0)

// Map a raw point count (0,1,2,3) to the classic tennis label.
const POINT_LABELS = ['0', '15', '30', '40']

// Display strings for the current game, accounting for deuce / advantage.
export function formatPoints(state: MatchState): [string, string] {
  const { points, inTiebreak } = state

  if (inTiebreak) {
    // Tiebreak is just a running count.
    return [String(points[0]), String(points[1])]
  }

  const [a, b] = points

  // Deuce territory: both have at least 3 points (40-40 or beyond).
  if (a >= 3 && b >= 3) {
    if (a === b) return ['40', '40'] // deuce
    return a > b ? ['AD', '—'] : ['—', 'AD'] // em-dash for the trailing side
  }

  return [POINT_LABELS[a] ?? '40', POINT_LABELS[b] ?? '40']
}

// True when the current game/tiebreak is "deuce" (both 40+ and level).
export function isDeuce(state: MatchState): boolean {
  return (
    !state.inTiebreak &&
    state.points[0] >= 3 &&
    state.points[1] >= 3 &&
    state.points[0] === state.points[1]
  )
}

// --- internal helpers -------------------------------------------------------

// Record a finished set for player `i` and advance match/set state.
// `finalGames` is the [g0, g1] tally to store for display.
function recordSet(
  state: MatchState,
  i: PlayerIndex,
  finalGames: [number, number],
): MatchState {
  const completedSets: Array<[number, number]> = [
    ...state.completedSets,
    finalGames,
  ]
  const setsWon: [number, number] = [...state.setsWon]
  setsWon[i] += 1
  const next: MatchState = {
    ...state,
    completedSets,
    setsWon,
    games: [0, 0],
    points: [0, 0],
    inTiebreak: false,
  }
  if (setsWon[i] >= state.config.setsToWin) {
    return { ...next, winner: i }
  }
  return next
}

// Award player `i` a game, then resolve set/tiebreak transitions.
function winGame(state: MatchState, i: PlayerIndex): MatchState {
  const {
    setsToWin,
    gamesToWinSet,
    gamesSlideTwo,
    tiebreakEnabled,
    tiebreakInLastSet,
    barangayDraw,
  } = state.config
  const games: [number, number] = [...state.games]
  games[i] += 1
  const opp = other(i)
  const a = games[i]
  const b = games[opp]

  const base: MatchState = { ...state, games, points: [0, 0], inTiebreak: false }

  // The deciding set (both one set from the match) can use a different tiebreak
  // rule; a single-set match just follows `tiebreakEnabled`.
  const isLastPossibleSet =
    setsToWin > 1 &&
    state.setsWon[0] === setsToWin - 1 &&
    state.setsWon[1] === setsToWin - 1
  const useTiebreak = isLastPossibleSet ? tiebreakInLastSet : tiebreakEnabled
  const gameWinBy = gamesSlideTwo ? 2 : 1

  // Set won outright (e.g. 6-4, 7-5; or first-to-target when slide-2 is off).
  if (a >= gamesToWinSet && a - b >= gameWinBy) {
    return recordSet(base, i, [games[0], games[1]])
  }

  // Barangay draw (single set only): tied at (target − 1) all → drawn match.
  if (barangayDraw && setsToWin === 1 && a === gamesToWinSet - 1 && b === gamesToWinSet - 1) {
    return { ...base, winner: 'draw' }
  }

  // Target-all (e.g. 6-6) → start a tiebreak.
  if (useTiebreak && a === gamesToWinSet && b === gamesToWinSet) {
    return { ...base, inTiebreak: true, points: [0, 0] }
  }

  return base
}

// --- public reducer ---------------------------------------------------------

// Award one point to player `i`. Returns a new state (no-op once there is a winner).
export function applyPoint(state: MatchState, i: PlayerIndex): MatchState {
  if (state.winner !== null) return state

  const points: [number, number] = [...state.points]
  points[i] += 1
  const opp = other(i)
  const a = points[i]
  const b = points[opp]
  const next: MatchState = { ...state, points }

  if (state.inTiebreak) {
    const { tiebreakTo, tiebreakSlideTwo } = state.config
    const tbWinBy = tiebreakSlideTwo ? 2 : 1
    if (a >= tiebreakTo && a - b >= tbWinBy) {
      // Tiebreak winner takes the set 7-6.
      const games: [number, number] = [...state.games]
      games[i] += 1 // -> 7-6
      return recordSet(next, i, [games[0], games[1]])
    }
    return next
  }

  // Regular game. A game always needs at least 4 points; how a tie at 40
  // resolves depends on the configured deuce policy.
  if (a >= 4 && wonGamePoint(a, b, state.config.deuce)) {
    return winGame(next, i)
  }

  return next
}

// Given the scorer is at `a` points and the opponent at `b` (with a >= 4),
// decide whether the game is won under the deuce policy.
function wonGamePoint(a: number, b: number, deuce: DeucePolicy): boolean {
  switch (deuce) {
    case 'no-deuce':
      // No advantage: 40-40 is decided by the next point.
      return a - b >= 1
    case 'sudden-death-2nd-deuce':
      // One advantage allowed; once both reach 4 (2nd deuce) the next point wins.
      return a - b >= 2 || (b >= 4 && a - b >= 1)
    case 'advantage':
    default:
      return a - b >= 2
  }
}
