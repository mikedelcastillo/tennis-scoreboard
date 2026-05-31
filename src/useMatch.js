import { useCallback, useEffect, useReducer } from 'react'
import { applyPoint, createInitialState } from './scoring.js'

const STORAGE_KEY = 'tennis-scoreboard:v1'

// History wrapper enabling undo/redo over snapshots of match state.
function freshHistory() {
  return { past: [], present: createInitialState(), future: [] }
}

function reducer(history, action) {
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
      const players = [...present.players]
      players[action.player] = action.name
      // Names are cosmetic — update in place without disturbing history stacks.
      return { ...history, present: { ...present, players } }
    }
    case 'RESET':
      return freshHistory()
    default:
      return history
  }
}

// Lazy initializer: hydrate from localStorage, falling back to a fresh match.
function init() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return freshHistory()
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      Array.isArray(parsed.past) &&
      Array.isArray(parsed.future) &&
      parsed.present &&
      Array.isArray(parsed.present.players)
    ) {
      return parsed
    }
  } catch {
    // ignore corrupt storage
  }
  return freshHistory()
}

export function useMatch() {
  const [history, dispatch] = useReducer(reducer, undefined, init)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    } catch {
      // storage may be unavailable (private mode, quota) — non-fatal
    }
  }, [history])

  const scorePoint = useCallback((player) => dispatch({ type: 'SCORE', player }), [])
  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])
  const reset = useCallback(() => dispatch({ type: 'RESET' }), [])
  const editName = useCallback(
    (player, name) => dispatch({ type: 'RENAME', player, name }),
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
