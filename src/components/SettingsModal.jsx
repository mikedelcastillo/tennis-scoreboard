import { useEffect } from 'react'
import { THEMES } from '../themes.js'

// Bottom-sheet settings pane. Themed via the same CSS tokens as the app, so it
// recolors with whatever theme is active. Closes on backdrop tap, the close
// icon, or Escape.
export default function SettingsModal({ open, onClose, theme, onSelectTheme }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

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
