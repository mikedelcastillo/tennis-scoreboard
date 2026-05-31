import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CONFIG,
  SCORING_PRESETS,
  createInitialState,
  applyPoint,
  formatPoints,
  isDeuce,
} from './scoring'
import type { MatchConfig, MatchState, PlayerIndex } from './scoring'

// --- helpers ----------------------------------------------------------------

// Play a sequence of points, where each entry is the player index (0 | 1).
function play(state: MatchState, sequence: PlayerIndex[]): MatchState {
  return sequence.reduce((s, i) => applyPoint(s, i), state)
}

// Award player `i` exactly `n` points in a row.
function score(state: MatchState, i: PlayerIndex, n: number): MatchState {
  return play(state, Array(n).fill(i))
}

// Win `n` complete games for player `i` (4 straight points each), assuming the
// opponent has < 3 points so each game is a clean 4-0.
function winGames(state: MatchState, i: PlayerIndex, n: number): MatchState {
  let s = state
  for (let g = 0; g < n; g++) s = score(s, i, 4)
  return s
}

// Drive a set to 6-6 (and thus into a tiebreak) by winning games alternately,
// so neither player ever leads by the two games needed to take the set outright.
function toSixAll(state: MatchState): MatchState {
  let s = state
  for (let g = 0; g < 6; g++) {
    s = score(s, 0, 4)
    s = score(s, 1, 4)
  }
  return s
}

describe('createInitialState', () => {
  it('starts a clean love-all match', () => {
    const s = createInitialState()
    expect(s.players).toEqual(['Player 1', 'Player 2'])
    expect(s.setsWon).toEqual([0, 0])
    expect(s.games).toEqual([0, 0])
    expect(s.points).toEqual([0, 0])
    expect(s.completedSets).toEqual([])
    expect(s.inTiebreak).toBe(false)
    expect(s.winner).toBeNull()
  })

  it('copies players/config so callers cannot mutate internal state', () => {
    const players: [string, string] = ['A', 'B']
    const config = { ...DEFAULT_CONFIG }
    const s = createInitialState(players, config)
    players[0] = 'mutated'
    config.gamesToWinSet = 99
    expect(s.players[0]).toBe('A')
    expect(s.config.gamesToWinSet).toBe(6)
  })
})

describe('point label progression', () => {
  it('maps raw counts to 0 / 15 / 30 / 40', () => {
    let s = createInitialState()
    expect(formatPoints(s)).toEqual(['0', '0'])
    s = applyPoint(s, 0)
    expect(formatPoints(s)).toEqual(['15', '0'])
    s = applyPoint(s, 0)
    expect(formatPoints(s)).toEqual(['30', '0'])
    s = applyPoint(s, 0)
    expect(formatPoints(s)).toEqual(['40', '0'])
  })
})

describe('winning a game (game-point regression)', () => {
  it('does NOT throw when scoring the game-winning point at 40', () => {
    // 40-0: player 0 has 3 points. The 4th point is "game point" and used to
    // crash with `ReferenceError: winBy is not defined`.
    const atGamePoint = score(createInitialState(), 0, 3)
    expect(atGamePoint.points).toEqual([3, 0])
    expect(() => applyPoint(atGamePoint, 0)).not.toThrow()
  })

  it('awards the game, increments games, and resets points', () => {
    const s = score(createInitialState(), 0, 4)
    expect(s.games).toEqual([1, 0])
    expect(s.points).toEqual([0, 0])
    expect(s.winner).toBeNull()
  })
})

describe('deuce and advantage', () => {
  it('is deuce at 40-40', () => {
    const s = play(createInitialState(), [0, 1, 0, 1, 0, 1]) // 3-3
    expect(isDeuce(s)).toBe(true)
    expect(formatPoints(s)).toEqual(['40', '40'])
  })

  it('shows advantage to the leader and an em-dash for the trailer', () => {
    let s = play(createInitialState(), [0, 1, 0, 1, 0, 1]) // deuce
    s = applyPoint(s, 0) // AD player 0
    expect(formatPoints(s)).toEqual(['AD', '—'])
    expect(isDeuce(s)).toBe(false)

    s = applyPoint(s, 1) // back to deuce
    expect(isDeuce(s)).toBe(true)

    s = applyPoint(s, 1) // AD player 1
    expect(formatPoints(s)).toEqual(['—', 'AD'])
  })

  it('requires winning by two from deuce', () => {
    let s = play(createInitialState(), [0, 1, 0, 1, 0, 1]) // deuce
    s = applyPoint(s, 0) // AD
    s = applyPoint(s, 0) // game to player 0
    expect(s.games).toEqual([1, 0])
    expect(s.points).toEqual([0, 0])
  })

  it('does not award the game on a single point from deuce', () => {
    let s = play(createInitialState(), [0, 1, 0, 1, 0, 1]) // deuce
    s = applyPoint(s, 0) // AD only
    expect(s.games).toEqual([0, 0])
    expect(s.points).toEqual([4, 3])
  })
})

describe('winning a set', () => {
  it('records a 6-4 set and increments setsWon', () => {
    let s = createInitialState()
    s = winGames(s, 1, 4) // 0-4
    s = winGames(s, 0, 6) // player 0 reaches 6-4
    expect(s.setsWon).toEqual([1, 0])
    expect(s.completedSets).toEqual([[6, 4]])
    expect(s.games).toEqual([0, 0]) // new set
  })

  it('requires win-by-two: 5-5 → 6-5 does not win, 7-5 does', () => {
    let s = createInitialState()
    s = winGames(s, 0, 5)
    s = winGames(s, 1, 5) // 5-5
    s = winGames(s, 0, 1) // 6-5, not enough
    expect(s.setsWon).toEqual([0, 0])
    expect(s.games).toEqual([6, 5])
    s = winGames(s, 0, 1) // 7-5
    expect(s.setsWon).toEqual([1, 0])
    expect(s.completedSets).toEqual([[7, 5]])
  })
})

describe('tiebreak', () => {
  it('enters a tiebreak at 6-6', () => {
    const s = toSixAll(createInitialState())
    expect(s.inTiebreak).toBe(true)
    expect(s.points).toEqual([0, 0])
    expect(s.games).toEqual([6, 6])
  })

  it('displays the tiebreak as a running count', () => {
    let s = toSixAll(createInitialState())
    s = play(s, [0, 0, 1]) // 2-1
    expect(formatPoints(s)).toEqual(['2', '1'])
    expect(isDeuce(s)).toBe(false)
  })

  it('wins the set 7-6 when reaching 7 by two', () => {
    let s = toSixAll(createInitialState())
    s = score(s, 0, 7) // 7-0 tiebreak
    expect(s.setsWon).toEqual([1, 0])
    expect(s.completedSets).toEqual([[7, 6]])
    expect(s.inTiebreak).toBe(false)
  })

  it('requires win-by-two inside the tiebreak (6-6 → 8-6)', () => {
    let s = toSixAll(createInitialState())
    s = play(s, [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]) // 6-6 in TB
    expect(s.inTiebreak).toBe(true)
    s = applyPoint(s, 0) // 7-6, not by two
    expect(s.inTiebreak).toBe(true)
    expect(s.setsWon).toEqual([0, 0])
    s = applyPoint(s, 0) // 8-6 → set
    expect(s.setsWon).toEqual([1, 0])
    expect(s.completedSets).toEqual([[7, 6]])
  })
})

describe('winning the match', () => {
  it('declares a winner after taking the required sets', () => {
    let s = createInitialState()
    // Player 0 wins two 6-0 sets.
    for (let set = 0; set < 2; set++) s = winGames(s, 0, 6)
    expect(s.winner).toBe(0)
    expect(s.setsWon).toEqual([2, 0])
    expect(s.completedSets).toEqual([[6, 0], [6, 0]])
  })

  it('ignores further points once the match is won (no-op, same reference)', () => {
    let s = createInitialState()
    for (let set = 0; set < 2; set++) s = winGames(s, 0, 6)
    expect(applyPoint(s, 0)).toBe(s)
    expect(applyPoint(s, 1)).toBe(s)
  })
})

describe('immutability', () => {
  it('returns a brand-new state and never mutates the input', () => {
    const s = createInitialState()
    const snapshot = JSON.stringify(s)
    const next = applyPoint(s, 0)
    expect(next).not.toBe(s)
    expect(JSON.stringify(s)).toBe(snapshot) // original untouched
  })
})

// --- customizable scoring config ------------------------------------------

const cfg = (over: Partial<MatchConfig>): MatchConfig => ({
  ...DEFAULT_CONFIG,
  ...over,
})

describe('match length (best of)', () => {
  it('best of 1 ends after a single set', () => {
    let s = createInitialState(undefined, cfg({ setsToWin: 1 }))
    s = winGames(s, 0, 6)
    expect(s.winner).toBe(0)
  })

  it('best of 5 needs three sets', () => {
    let s = createInitialState(undefined, cfg({ setsToWin: 3 }))
    s = winGames(s, 0, 6)
    s = winGames(s, 0, 6)
    expect(s.winner).toBeNull()
    s = winGames(s, 0, 6)
    expect(s.winner).toBe(0)
  })

  it('presets carry the expected set counts', () => {
    expect(SCORING_PRESETS.find((p) => p.id === 'bo3')?.config.setsToWin).toBe(2)
    expect(SCORING_PRESETS.find((p) => p.id === 'bo5')?.config.setsToWin).toBe(3)
  })
})

describe('games per set', () => {
  it('wins a 4-game set at 4-1', () => {
    let s = createInitialState(undefined, cfg({ setsToWin: 1, gamesToWinSet: 4 }))
    s = winGames(s, 1, 1) // 0-1
    s = winGames(s, 0, 4) // 4-1
    expect(s.completedSets).toEqual([[4, 1]])
    expect(s.winner).toBe(0)
  })

  it('an 8-game set is not won until 8 games', () => {
    let s = createInitialState(undefined, cfg({ setsToWin: 1, gamesToWinSet: 8 }))
    s = winGames(s, 0, 7) // 7-0
    expect(s.setsWon).toEqual([0, 0])
    s = winGames(s, 0, 1) // 8-0
    expect(s.winner).toBe(0)
  })
})

describe('slide-2 for games', () => {
  it('off: a set is won outright at the target (6-5)', () => {
    let s = createInitialState(undefined, cfg({ setsToWin: 1, gamesSlideTwo: false }))
    for (let g = 0; g < 5; g++) {
      s = score(s, 0, 4)
      s = score(s, 1, 4)
    }
    expect(s.games).toEqual([5, 5])
    s = score(s, 0, 4) // 6-5
    expect(s.winner).toBe(0)
    expect(s.completedSets).toEqual([[6, 5]])
  })
})

describe('tiebreak configuration', () => {
  it('disabled: 6-6 becomes an advantage set (8-6)', () => {
    let s = createInitialState(
      undefined,
      cfg({ setsToWin: 1, tiebreakEnabled: false, tiebreakInLastSet: false }),
    )
    s = toSixAll(s)
    expect(s.inTiebreak).toBe(false)
    expect(s.games).toEqual([6, 6])
    s = score(s, 0, 4) // 7-6, not by two
    expect(s.winner).toBeNull()
    s = score(s, 0, 4) // 8-6
    expect(s.winner).toBe(0)
    expect(s.completedSets).toEqual([[8, 6]])
  })

  it('no win-by-two when tiebreakSlideTwo is off (first to 7)', () => {
    let s = createInitialState(undefined, cfg({ setsToWin: 1, tiebreakSlideTwo: false }))
    s = toSixAll(s)
    s = play(s, [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1]) // 6-6 in TB
    s = applyPoint(s, 0) // 7-6 wins (no win-by-two)
    expect(s.winner).toBe(0)
    expect(s.completedSets).toEqual([[7, 6]])
  })

  it('tiebreakInLastSet only affects the deciding set', () => {
    // Best of 3, no tiebreak in the last set: set 3 is an advantage set.
    let s = createInitialState(
      undefined,
      cfg({ setsToWin: 2, tiebreakInLastSet: false }),
    )
    s = winGames(s, 0, 6) // set 1 to P0
    s = winGames(s, 1, 6) // set 2 to P1 → deciding set
    expect(s.setsWon).toEqual([1, 1])
    s = toSixAll(s) // 6-6 in the deciding set
    expect(s.inTiebreak).toBe(false) // advantage set, no tiebreak
  })
})

describe('deuce policies', () => {
  it('advantage: 40-40 → AD → game needs win-by-two', () => {
    let s = createInitialState(undefined, cfg({ deuce: 'advantage' }))
    s = play(s, [0, 0, 0, 1, 1, 1]) // 40-40
    s = applyPoint(s, 0) // AD
    expect(s.games).toEqual([0, 0])
    s = applyPoint(s, 1) // back to deuce
    expect(s.games).toEqual([0, 0])
    s = applyPoint(s, 0) // AD
    s = applyPoint(s, 0) // game
    expect(s.games).toEqual([1, 0])
  })

  it('no-deuce: 40-40 is decided by the next point', () => {
    let s = createInitialState(undefined, cfg({ deuce: 'no-deuce' }))
    s = play(s, [0, 0, 0, 1, 1, 1]) // 40-40 (3-3)
    expect(isDeuce(s)).toBe(true)
    s = applyPoint(s, 0) // 4-3 wins immediately
    expect(s.games).toEqual([1, 0])
  })

  it('sudden-death-2nd-deuce: one ad, then the next point wins', () => {
    let s = createInitialState(undefined, cfg({ deuce: 'sudden-death-2nd-deuce' }))
    s = play(s, [0, 0, 0, 1, 1, 1]) // 40-40 (3-3)
    s = applyPoint(s, 0) // AD (4-3) — no win yet
    expect(s.games).toEqual([0, 0])
    s = applyPoint(s, 1) // 4-4, second deuce
    expect(s.games).toEqual([0, 0])
    s = applyPoint(s, 1) // 4-5 wins by one
    expect(s.games).toEqual([0, 1])
  })
})

describe('barangay draw', () => {
  it('single 8-game set is drawn at 7-7', () => {
    let s = createInitialState(
      undefined,
      cfg({ setsToWin: 1, gamesToWinSet: 8, barangayDraw: true }),
    )
    for (let g = 0; g < 7; g++) {
      s = score(s, 0, 4)
      s = score(s, 1, 4)
    }
    expect(s.games).toEqual([7, 7])
    expect(s.winner).toBe('draw')
  })

  it('is ignored for multi-set matches', () => {
    let s = createInitialState(
      undefined,
      cfg({ setsToWin: 2, gamesToWinSet: 8, barangayDraw: true }),
    )
    for (let g = 0; g < 7; g++) {
      s = score(s, 0, 4)
      s = score(s, 1, 4)
    }
    expect(s.games).toEqual([7, 7])
    expect(s.winner).toBeNull() // plays on (8-x), no draw
  })
})
