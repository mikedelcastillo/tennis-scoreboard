import { useCallback, useEffect, useReducer, useRef } from 'react'
import { applyPoint, createInitialState, DEFAULT_CONFIG } from './scoring'
import type { MatchConfig, MatchState, PlayerIndex } from './scoring'

// Bumped to v2: the persisted state shape changed (granular MatchConfig fields
// and a `'draw'` match outcome). Old v1 blobs are simply ignored.
const STORAGE_KEY = 'tennis-scoreboard:v2'

// History wrapper enabling undo/redo over snapshots of match state.
export interface History {
  past: MatchState[]
  present: MatchState
  future: MatchState[]
}

type Action =
  | { type: 'SCORE'; player: PlayerIndex }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RENAME'; player: PlayerIndex; name: string }
  | { type: 'RESET'; config: MatchConfig }

function freshHistory(config: MatchConfig): History {
  return { past: [], present: createInitialState(undefined, config), future: [] }
}

function reducer(history: History, action: Action): History {
  const { past, present, future } = history

  switch (action.type) {
    case 'SCORE': {
      const next = applyPoint(present, action.player)
      if (next === present) return history // no-op (e.g. match already won)
      return { past: [...past, present], present: next, future: [] }
    }
    case 'UNDO': {
      if (past.length === 0) return history
      const previous = past[past.length - 1]
      return {
        past: past.slice(0, -1),
        present: previous,
        future: [present, ...future],
      }
    }
    case 'REDO': {
      if (future.length === 0) return history
      const [next, ...rest] = future
      return { past: [...past, present], present: next, future: rest }
    }
    case 'RENAME': {
      const players: [string, string] = [...present.players]
      players[action.player] = action.name
      // Names are cosmetic — update in place without disturbing history stacks.
      return { ...history, present: { ...present, players } }
    }
    case 'RESET':
      return freshHistory(action.config)
    default:
      return history
  }
}

// Lazy initializer: hydrate an in-progress match from localStorage (keeping its
// own embedded config), falling back to a fresh match using the current config.
function init(config: MatchConfig): History {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return freshHistory(config)
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      Array.isArray(parsed.past) &&
      Array.isArray(parsed.future) &&
      parsed.present &&
      Array.isArray(parsed.present.players)
    ) {
      return parsed as History
    }
  } catch {
    // ignore corrupt storage
  }
  return freshHistory(config)
}

// `config` is the scoring config used for the *next* new match. A running match
// keeps the config it was created with; changes only apply on RESET.
export function useMatch(config: MatchConfig = DEFAULT_CONFIG) {
  const [history, dispatch] = useReducer(reducer, config, init)

  // Keep the latest config available to reset() without re-creating the match.
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    } catch {
      // storage may be unavailable (private mode, quota) — non-fatal
    }
  }, [history])

  const scorePoint = useCallback(
    (player: PlayerIndex) => dispatch({ type: 'SCORE', player }),
    [],
  )
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])
  const reset = useCallback(
    () => dispatch({ type: 'RESET', config: configRef.current }),
    [],
  )
  const editName = useCallback(
    (player: PlayerIndex, name: string) =>
      dispatch({ type: 'RENAME', player, name }),
    [],
  )

  return {
    state: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    scorePoint,
    undo,
    redo,
    reset,
    editName,
  }
}
