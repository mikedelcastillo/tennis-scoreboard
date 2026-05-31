// Pure tennis scoring engine — no React, no side effects.
// `applyPoint` always returns a brand-new state object (safe to snapshot for undo/redo).

export type PlayerIndex = 0 | 1

export interface MatchConfig {
  setsToWin: number // best-of-3 → 2
  gamesToWinSet: number
  tiebreakTo: number
  winBy: number
}

export interface MatchState {
  players: [string, string]
  completedSets: Array<[number, number]> // [gamesP0, gamesP1] for finished sets
  setsWon: [number, number]
  games: [number, number] // games in the current set
  points: [number, number] // raw point counts in the current game / tiebreak
  inTiebreak: boolean
  winner: PlayerIndex | null
  config: MatchConfig
}

export const DEFAULT_CONFIG: MatchConfig = {
  setsToWin: 2, // best-of-3
  gamesToWinSet: 6,
  tiebreakTo: 7,
  winBy: 2,
}

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
  const { gamesToWinSet, winBy } = state.config
  const games: [number, number] = [...state.games]
  games[i] += 1
  const opp = other(i)

  const base: MatchState = { ...state, games, points: [0, 0], inTiebreak: false }

  // Set won outright (e.g. 6-4, 7-5).
  if (games[i] >= gamesToWinSet && games[i] - games[opp] >= winBy) {
    return recordSet(base, i, [games[0], games[1]])
  }

  // 6-6 → start a tiebreak.
  if (games[0] === gamesToWinSet && games[1] === gamesToWinSet) {
    return { ...base, inTiebreak: true, points: [0, 0] }
  }

  return base
}

// --- public reducer ---------------------------------------------------------

// Award one point to player `i`. Returns a new state (no-op once there is a winner).
export function applyPoint(state: MatchState, i: PlayerIndex): MatchState {
  if (state.winner !== null) return state

  const { winBy } = state.config
  const points: [number, number] = [...state.points]
  points[i] += 1
  const opp = other(i)
  const next: MatchState = { ...state, points }

  if (state.inTiebreak) {
    const { tiebreakTo } = state.config
    if (points[i] >= tiebreakTo && points[i] - points[opp] >= winBy) {
      // Tiebreak winner takes the set 7-6.
      const games: [number, number] = [...state.games]
      games[i] += 1 // -> 7-6
      return recordSet(next, i, [games[0], games[1]])
    }
    return next
  }

  // Regular game: need >= 4 points and a 2-point lead.
  if (points[i] >= 4 && points[i] - points[opp] >= winBy) {
    return winGame(next, i)
  }

  return next
}
