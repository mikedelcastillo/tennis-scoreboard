// Bottom controls: +score per player, then undo / redo / settings, then reset.
function Icon({ name }) {
  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {name}
    </span>
  )
}

export default function Controls({
  state,
  canUndo,
  canRedo,
  onScore,
  onUndo,
  onRedo,
  onReset,
  onOpenSettings,
}) {
  const matchOver = state.winner !== null

  return (
    <div className="controls">
      <div className="score-buttons">
        {[0, 1].map((i) => (
          <button
            key={i}
            className="btn-score"
            data-player={i}
            onClick={() => onScore(i)}
            disabled={matchOver}
            aria-label={`Point for ${state.players[i]}`}
          >
            <Icon name="add" />
            <span className="who">{state.players[i]}</span>
          </button>
        ))}
      </div>

      <div className="history-buttons">
        <button
          className="btn-secondary"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
        >
          <Icon name="undo" />
        </button>
        <button
          className="btn-secondary"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
        >
          <Icon name="redo" />
        </button>
        <button
          className="btn-secondary"
          onClick={onOpenSettings}
          aria-label="Settings"
        >
          <Icon name="settings" />
        </button>
      </div>

      <button className="reset-link" onClick={onReset} aria-label="New match">
        <Icon name="restart_alt" />
        New match
      </button>
    </div>
  )
}
