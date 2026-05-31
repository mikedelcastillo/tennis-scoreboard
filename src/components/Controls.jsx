// Bottom controls: +score per player, then undo/redo, then a small reset.
export default function Controls({
  state,
  canUndo,
  canRedo,
  onScore,
  onUndo,
  onRedo,
  onReset,
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
          >
            <span className="plus">+</span>
            <span className="who">{state.players[i]}</span>
          </button>
        ))}
      </div>

      <div className="history-buttons">
        <button className="btn-secondary" onClick={onUndo} disabled={!canUndo}>
          ↶ Undo
        </button>
        <button className="btn-secondary" onClick={onRedo} disabled={!canRedo}>
          ↷ Redo
        </button>
      </div>

      <button className="reset-link" onClick={onReset}>
        New match
      </button>
    </div>
  )
}
