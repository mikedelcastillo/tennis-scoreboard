import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CONFIG,
  createInitialState,
  applyPoint,
  formatPoints,
  isDeuce,
} from './scoring'
import type { MatchState, PlayerIndex } from './scoring'

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
    config.winBy = 99
    expect(s.players[0]).toBe('A')
    expect(s.config.winBy).toBe(2)
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
