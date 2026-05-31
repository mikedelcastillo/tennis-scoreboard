import { formatPoints } from '../scoring.js'

// The big 2-row grid: Player | Sets | Games | Points.
export default function Scoreboard({ state, onRename }) {
  const points = formatPoints(state)

  return (
    <div className="scoreboard">
      <div className="row header">
        <div className="cell">Player</div>
        <div className="cell center">Sets</div>
        <div className="cell center">Games</div>
        <div className="cell center">Points</div>
      </div>

      {[0, 1].map((i) => {
        const isWinner = state.winner === i
        return (
          <div
            key={i}
            className={`row player${isWinner ? ' winner' : ''}`}
            data-player={i}
          >
            <div className="cell">
              <span className="swatch" />
              <input
                className="player-name"
                value={state.players[i]}
                onChange={(e) => onRename(i, e.target.value)}
                aria-label={`Player ${i + 1} name`}
                maxLength={16}
              />
            </div>
            <div className="cell center">
              <span className="score sets">{state.setsWon[i]}</span>
            </div>
            <div className="cell center">
              <span className="score games">{state.games[i]}</span>
            </div>
            <div className="cell center">
              <span className="score points">{points[i]}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
