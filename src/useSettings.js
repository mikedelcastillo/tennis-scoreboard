import { useCallback, useEffect, useReducer } from 'react'
import { DEFAULT_THEME, isValidTheme } from './themes.js'

// App settings live separately from match state: they are not part of the
// undo/redo history and must survive a "New match", so they get their own
// storage key rather than riding along in useMatch's history object.
const STORAGE_KEY = 'tennis-scoreboard:settings:v1'

function defaultSettings() {
  return { theme: DEFAULT_THEME }
}

function reducer(settings, action) {
  switch (action.type) {
    case 'SET_THEME':
      if (settings.theme === action.theme) return settings
      return { ...settings, theme: action.theme }
    default:
      return settings
  }
}

// Lazy initializer: hydrate from localStorage, falling back to defaults and
// coercing an unknown/missing theme back to the default.
function init() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings()
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return {
        theme: isValidTheme(parsed.theme) ? parsed.theme : DEFAULT_THEME,
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return defaultSettings()
}

// Reflect the active theme onto <html> (so CSS [data-theme] applies) and keep
// the mobile browser chrome color in sync with the theme's background.
function applyTheme(theme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
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
    (theme) => dispatch({ type: 'SET_THEME', theme }),
    [],
  )

  return { settings, setTheme }
}
