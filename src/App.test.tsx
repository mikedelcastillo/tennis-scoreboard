import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { createInitialState, applyPoint } from './scoring'
import type { PlayerIndex } from './scoring'

const STORAGE_KEY = 'tennis-scoreboard:v2'
const SETTINGS_KEY = 'tennis-scoreboard:settings:v1'

// --- DOM helpers ------------------------------------------------------------

// The "+score" button for a given player row.
function scoreButton(container: HTMLElement, i: PlayerIndex): HTMLElement {
  return container.querySelector(`.btn-score[data-player="${i}"]`)!
}

// Read a score cell ("sets" | "games" | "points") for a player row.
function cell(
  container: HTMLElement,
  i: PlayerIndex,
  kind: 'sets' | 'games' | 'points',
): string | null {
  return container.querySelector(`[data-player="${i}"] .score.${kind}`)!
    .textContent
}

function clickScore(container: HTMLElement, i: PlayerIndex, times = 1) {
  for (let n = 0; n < times; n++) fireEvent.click(scoreButton(container, i))
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('initial render', () => {
  it('renders both players at love-all without crashing', () => {
    const { container } = render(<App />)
    expect(screen.getByLabelText('Player 1 name')).toHaveValue('Player 1')
    expect(screen.getByLabelText('Player 2 name')).toHaveValue('Player 2')
    expect(cell(container, 0, 'points')).toBe('0')
    expect(cell(container, 1, 'points')).toBe('0')
    expect(cell(container, 0, 'games')).toBe('0')
  })
})

describe('blank-screen regression (game point via the UI)', () => {
  it('keeps rendering after a game is won; games increments and points reset', () => {
    const { container } = render(<App />)
    // Four taps takes player 0 from love through 40 and past the game point —
    // the exact path that used to unmount the whole app (blank screen).
    clickScore(container, 0, 4)

    // App is still mounted and shows the scoreboard.
    expect(container.querySelector('.scoreboard')).toBeInTheDocument()
    expect(cell(container, 0, 'games')).toBe('1')
    expect(cell(container, 0, 'points')).toBe('0')
  })
})

describe('undo / redo', () => {
  it('disables undo/redo appropriately and reverts a point', () => {
    const { container } = render(<App />)
    const undo = screen.getByRole('button', { name: /Undo/ })
    const redo = screen.getByRole('button', { name: /Redo/ })

    expect(undo).toBeDisabled()
    expect(redo).toBeDisabled()

    clickScore(container, 0, 1) // 15-0
    expect(cell(container, 0, 'points')).toBe('15')
    expect(undo).toBeEnabled()

    fireEvent.click(undo)
    expect(cell(container, 0, 'points')).toBe('0')
    expect(redo).toBeEnabled()

    fireEvent.click(redo)
    expect(cell(container, 0, 'points')).toBe('15')
  })
})

describe('reset / new match', () => {
  it('clears the score when the confirm dialog is accepted', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { container } = render(<App />)
    clickScore(container, 0, 2) // 30-0
    expect(cell(container, 0, 'points')).toBe('30')

    fireEvent.click(screen.getByRole('button', { name: /New match/ }))
    expect(cell(container, 0, 'points')).toBe('0')
  })

  it('keeps the score when the confirm dialog is dismissed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { container } = render(<App />)
    clickScore(container, 0, 2)

    fireEvent.click(screen.getByRole('button', { name: /New match/ }))
    expect(cell(container, 0, 'points')).toBe('30')
  })
})

describe('renaming a player', () => {
  it('updates the name and is not an undoable move', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('Player 1 name')

    await user.clear(input)
    await user.type(input, 'Serena')
    expect(input).toHaveValue('Serena')

    // Renaming is cosmetic — it must not push onto the undo stack.
    expect(screen.getByRole('button', { name: /Undo/ })).toBeDisabled()
  })
})

describe('persistence across remount', () => {
  it('hydrates the score from localStorage', () => {
    const first = render(<App />)
    clickScore(first.container, 0, 1) // 15-0, written to localStorage
    first.unmount()

    const { container } = render(<App />)
    expect(cell(container, 0, 'points')).toBe('15')
  })

  it('falls back to a fresh match when storage is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json{')
    const { container } = render(<App />)
    expect(cell(container, 0, 'points')).toBe('0')
    expect(cell(container, 0, 'games')).toBe('0')
  })
})

describe('match over', () => {
  it('shows the winner banner and disables the score buttons', () => {
    // Seed a won match directly via the engine, then load it.
    let s = createInitialState()
    for (let set = 0; set < 2; set++) {
      for (let game = 0; game < 6; game++) {
        for (let pt = 0; pt < 4; pt++) s = applyPoint(s, 0)
      }
    }
    expect(s.winner).toBe(0)
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ past: [], present: s, future: [] }),
    )

    const { container } = render(<App />)
    expect(screen.getByText(/wins the match/)).toBeInTheDocument()
    expect(scoreButton(container, 0)).toBeDisabled()
    expect(scoreButton(container, 1)).toBeDisabled()
  })
})

describe('settings: theme', () => {
  const theme = () => document.documentElement.getAttribute('data-theme')

  it('applies the default theme (rg) on a fresh load', () => {
    render(<App />)
    expect(theme()).toBe('rg')
  })

  it('opens the settings modal from the cog and closes it', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Close settings/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the modal on Escape', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('selecting a theme applies it and persists across remount', async () => {
    const user = userEvent.setup()
    const first = render(<App />)
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: 'Wimbledon' }))
    expect(theme()).toBe('wimbledon')
    first.unmount()

    // Wipe the live attribute so the remount must rehydrate from storage.
    document.documentElement.removeAttribute('data-theme')
    render(<App />)
    expect(theme()).toBe('wimbledon')
  })

  it('falls back to the default theme when settings storage is corrupt', () => {
    localStorage.setItem(SETTINGS_KEY, 'not-valid-json{')
    render(<App />)
    expect(theme()).toBe('rg')
  })

  it('coerces an unknown stored theme back to the default', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: 'bogus' }))
    render(<App />)
    expect(theme()).toBe('rg')
  })
})

describe('settings: scoring config', () => {
  it('applies a new scoring config on the next New match, not the current one', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { container } = render(<App />)

    // Win set 1 (6-0) under the default best-of-3 rules.
    for (let game = 0; game < 6; game++) clickScore(container, 0, 4)
    expect(cell(container, 0, 'sets')).toBe('1')

    // Switch to a single set (Best of 1) mid-match.
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: '1' }))
    fireEvent.click(screen.getByRole('button', { name: /Close settings/ }))

    // The running match keeps best-of-3 — one set is not enough to win.
    expect(screen.queryByText(/wins the match/i)).not.toBeInTheDocument()
    expect(scoreButton(container, 0)).not.toBeDisabled()

    // New match now uses best-of-1: a single set wins it.
    fireEvent.click(screen.getByRole('button', { name: /New match/ }))
    for (let game = 0; game < 6; game++) clickScore(container, 0, 4)
    expect(screen.getByText(/wins the match/i)).toBeInTheDocument()
  })

  it('shows a draw and disables scoring for a barangay single-set tie', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { container } = render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: '1' })) // Best of 1
    // Games per set 6 → 2 (so the set is drawn at 1-1).
    for (let n = 0; n < 4; n++)
      fireEvent.click(
        screen.getByRole('button', { name: 'Decrease Games per set' }),
      )
    fireEvent.click(screen.getByRole('switch', { name: /Barangay draw/i }))
    fireEvent.click(screen.getByRole('button', { name: /Close settings/ }))

    fireEvent.click(screen.getByRole('button', { name: /New match/ }))
    clickScore(container, 0, 4) // 1-0
    clickScore(container, 1, 4) // 1-1 → draw

    expect(screen.getByText(/drawn/i)).toBeInTheDocument()
    expect(scoreButton(container, 0)).toBeDisabled()
    expect(scoreButton(container, 1)).toBeDisabled()
  })
})
