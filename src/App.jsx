import Controls from './components/Controls.jsx'
import Scoreboard from './components/Scoreboard.jsx'
import { useMatch } from './useMatch.js'

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
          🎾 {state.players[state.winner]} wins the match
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
      />
    </div>
  )
}
