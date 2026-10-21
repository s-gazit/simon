import { COLORS } from '../game/colors';
import './SimonBoard.css';

export default function SimonBoard() {
  return (
    <div className="simon-board">
      <div className="simon-board__grid">
        {COLORS.map(({ id, label, area }) => (
          <button
            key={id}
            type="button"
            className={`simon-board__pad simon-board__pad--${id}`}
            data-area={area}
            aria-label={label}
          />
        ))}
      </div>
      <div className="simon-board__center" aria-hidden="true">
        סיימון
      </div>
    </div>
  );
}
