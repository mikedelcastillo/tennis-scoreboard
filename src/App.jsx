import { useState } from 'react'
import Controls from './components/Controls.jsx'
import Scoreboard from './components/Scoreboard.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import { useMatch } from './useMatch.js'
import { useSettings } from './useSettings.js'

export default function App() {
  const {
    state,
    canUndo,
    canRedo,
    scorePoint,
    undo,
    redo,
    reset,
    editName,
  } = useMatch()

  const { settings, setTheme } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleReset = () => {
    if (window.confirm('Start a new match? Current score will be cleared.')) {
      reset()
    }
  }

  return (
    <div className="app">
      <Scoreboard state={state} onRename={editName} />

      {state.winner !== null && (
        <div className="winner-banner">
          <span className="material-symbols-outlined" aria-hidden="true">
            emoji_events
          </span>
          {state.players[state.winner]} wins the match
        </div>
      )}

      <Controls
        state={state}
        canUndo={canUndo}
        canRedo={canRedo}
        onScore={scorePoint}
        onUndo={undo}
        onRedo={redo}
        onReset={handleReset}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={settings.theme}
        onSelectTheme={setTheme}
      />
    </div>
  )
}
