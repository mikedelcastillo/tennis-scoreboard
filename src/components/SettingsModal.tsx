import { useEffect } from 'react'
import { THEMES } from '../themes'
import { SCORING_PRESETS } from '../scoring'
import type { DeucePolicy, MatchConfig } from '../scoring'

interface Props {
  open: boolean
  onClose: () => void
  theme: string
  onSelectTheme: (id: string) => void
  scoring: MatchConfig
  onChangeScoring: (config: MatchConfig) => void
}

const BEST_OF: { label: string; setsToWin: number }[] = [
  { label: '1', setsToWin: 1 },
  { label: '3', setsToWin: 2 },
  { label: '5', setsToWin: 3 },
]

const DEUCE_OPTIONS: { value: DeucePolicy; label: string }[] = [
  { value: 'advantage', label: 'Advantage' },
  { value: 'sudden-death-2nd-deuce', label: '2nd-deuce' },
  { value: 'no-deuce', label: 'No deuce' },
]

// A row of mutually-exclusive choices (segmented control).
function Segmented<T extends string | number>(props: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onSelect: (value: T) => void
}) {
  const { label, value, options, onSelect } = props
  return (
    <div className="set-row">
      <span className="set-label">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            className={`segment${o.value === value ? ' selected' : ''}`}
            aria-pressed={o.value === value}
            onClick={() => onSelect(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// A −/value/+ numeric stepper, clamped to [min, max].
function Stepper(props: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  const { label, value, min, max, onChange } = props
  return (
    <div className="set-row">
      <span className="set-label">{label}</span>
      <div className="stepper">
        <button
          className="step-btn"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            remove
          </span>
        </button>
        <span className="step-value" aria-live="polite">
          {value}
        </span>
        <button
          className="step-btn"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            add
          </span>
        </button>
      </div>
    </div>
  )
}

// A labelled on/off toggle row.
function Toggle(props: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  const { label, checked, disabled, onChange } = props
  return (
    <button
      className={`toggle-row${checked ? ' on' : ''}`}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-label">{label}</span>
      <span className="toggle-switch" aria-hidden="true">
        <span className="toggle-knob" />
      </span>
    </button>
  )
}

// Bottom-sheet settings pane. Themed via the same CSS tokens as the app, so it
// recolors with whatever theme is active. Closes on backdrop tap, the close
// icon, or Escape.
export default function SettingsModal({
  open,
  onClose,
  theme,
  onSelectTheme,
  scoring,
  onChangeScoring,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  // Patch a single field of the scoring config.
  const set = <K extends keyof MatchConfig>(key: K, value: MatchConfig[K]) =>
    onChangeScoring({ ...scoring, [key]: value })

  const singleSet = scoring.setsToWin === 1
  const activePreset = SCORING_PRESETS.find(
    (p) => JSON.stringify(p.config) === JSON.stringify(scoring),
  )

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        <section className="settings-section">
          <h3 className="settings-section-title">Scoring</h3>

          <div className="theme-grid">
            {SCORING_PRESETS.map((p) => {
              const selected = activePreset?.id === p.id
              return (
                <button
                  key={p.id}
                  className={`theme-option${selected ? ' selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => onChangeScoring(p.config)}
                >
                  <span className="theme-label">{p.label}</span>
                  {selected && (
                    <span
                      className="material-symbols-outlined theme-check"
                      aria-hidden="true"
                    >
                      check
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <Segmented
            label="Best of"
            value={scoring.setsToWin}
            options={BEST_OF.map((b) => ({ value: b.setsToWin, label: b.label }))}
            onSelect={(setsToWin) => set('setsToWin', setsToWin)}
          />

          <Stepper
            label="Games per set"
            value={scoring.gamesToWinSet}
            min={1}
            max={21}
            onChange={(n) => set('gamesToWinSet', n)}
          />

          <Segmented
            label="Deuce"
            value={scoring.deuce}
            options={DEUCE_OPTIONS}
            onSelect={(deuce) => set('deuce', deuce)}
          />

          <Toggle
            label="Win set by 2 (slide to 7)"
            checked={scoring.gamesSlideTwo}
            onChange={(v) => set('gamesSlideTwo', v)}
          />
          <Toggle
            label="Tiebreak at set-all"
            checked={scoring.tiebreakEnabled}
            onChange={(v) => set('tiebreakEnabled', v)}
          />
          <Toggle
            label="Tiebreak in last set"
            checked={scoring.tiebreakInLastSet}
            onChange={(v) => set('tiebreakInLastSet', v)}
          />

          {(scoring.tiebreakEnabled || scoring.tiebreakInLastSet) && (
            <>
              <Stepper
                label="Tiebreak to"
                value={scoring.tiebreakTo}
                min={1}
                max={21}
                onChange={(n) => set('tiebreakTo', n)}
              />
              <Toggle
                label="Win tiebreak by 2"
                checked={scoring.tiebreakSlideTwo}
                onChange={(v) => set('tiebreakSlideTwo', v)}
              />
            </>
          )}

          <Toggle
            label="Barangay draw (single set, tie at last game)"
            checked={scoring.barangayDraw}
            disabled={!singleSet}
            onChange={(v) => set('barangayDraw', v)}
          />

          <p className="settings-note">
            Scoring changes apply to your next New match.
          </p>
        </section>

        <section className="settings-section">
          <h3 className="settings-section-title">Theme</h3>
          <div className="theme-grid">
            {THEMES.map(({ id, label, swatches }) => {
              const selected = id === theme
              return (
                <button
                  key={id}
                  className={`theme-option${selected ? ' selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => onSelectTheme(id)}
                >
                  <span className="theme-swatches" aria-hidden="true">
                    {swatches.map((c, n) => (
                      <span
                        key={n}
                        className="theme-swatch"
                        style={{ background: c }}
                      />
                    ))}
                  </span>
                  <span className="theme-label">{label}</span>
                  {selected && (
                    <span
                      className="material-symbols-outlined theme-check"
                      aria-hidden="true"
                    >
                      check
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
