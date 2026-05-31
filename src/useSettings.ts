import { useCallback, useEffect, useReducer } from 'react'
import { DEFAULT_THEME, isValidTheme } from './themes'
import { DEFAULT_CONFIG } from './scoring'
import type { MatchConfig } from './scoring'

// App settings live separately from match state: they are not part of the
// undo/redo history and must survive a "New match", so they get their own
// storage key rather than riding along in useMatch's history object.
const STORAGE_KEY = 'tennis-scoreboard:settings:v1'

export interface Settings {
  theme: string
  scoring: MatchConfig
}

type Action =
  | { type: 'SET_THEME'; theme: string }
  | { type: 'SET_SCORING'; scoring: MatchConfig }

function defaultSettings(): Settings {
  return { theme: DEFAULT_THEME, scoring: DEFAULT_CONFIG }
}

function reducer(settings: Settings, action: Action): Settings {
  switch (action.type) {
    case 'SET_THEME':
      if (settings.theme === action.theme) return settings
      return { ...settings, theme: action.theme }
    case 'SET_SCORING':
      return { ...settings, scoring: action.scoring }
    default:
      return settings
  }
}

// Lazy initializer: hydrate from localStorage, falling back to defaults and
// coercing an unknown/missing theme back to the default. Scoring is merged onto
// DEFAULT_CONFIG so older stored blobs (and any future field) stay valid.
function init(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings()
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return {
        theme: isValidTheme(parsed.theme) ? parsed.theme : DEFAULT_THEME,
        scoring: { ...DEFAULT_CONFIG, ...(parsed.scoring ?? {}) },
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return defaultSettings()
}

// Reflect the active theme onto <html> (so CSS [data-theme] applies) and keep
// the mobile browser chrome color in sync with the theme's background.
function applyTheme(theme: string): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) {
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue('--bg')
      .trim()
    if (bg) meta.setAttribute('content', bg)
  }
}

export function useSettings() {
  const [settings, dispatch] = useReducer(reducer, undefined, init)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // storage may be unavailable (private mode, quota) — non-fatal
    }
    applyTheme(settings.theme)
  }, [settings])

  const setTheme = useCallback(
    (theme: string) => dispatch({ type: 'SET_THEME', theme }),
    [],
  )
  const setScoring = useCallback(
    (scoring: MatchConfig) => dispatch({ type: 'SET_SCORING', scoring }),
    [],
  )

  return { settings, setTheme, setScoring }
}
