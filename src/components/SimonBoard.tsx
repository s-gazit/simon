import { COLORS, type ColorId } from '../game/colors';
import './SimonBoard.css';

type Props = {
  activeColor?: ColorId | null;
  interactive?: boolean;
  dimmed?: boolean;
  // holdUntilRelease: pointer presses last while the finger is down; keyboard presses use the minimum duration.
  onPadDown?: (color: ColorId, holdUntilRelease: boolean) => void;
};

export default function SimonBoard({ activeColor = null, interactive = false, dimmed = false, onPadDown }: Props) {
  return (
    <div className={`simon-board${dimmed ? ' simon-board--dimmed' : ''}${interactive ? ' simon-board--interactive' : ''}`}>
      <div className="simon-board__grid">
        {COLORS.map(({ id, label, area }) => (
          <button
            key={id}
            type="button"
            className={`simon-board__pad simon-board__pad--${id}`}
            data-area={area}
            data-active={activeColor === id ? 'true' : undefined}
            aria-label={label}
            aria-disabled={interactive ? undefined : 'true'}
            onPointerDown={(event) => {
              if (!interactive || event.button !== 0) return;
              event.preventDefault();
              onPadDown?.(id, true);
            }}
            onKeyDown={(event) => {
              if (!interactive || event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
              event.preventDefault();
              onPadDown?.(id, false);
            }}
          />
        ))}
      </div>
      <div className="simon-board__center" aria-hidden="true">
        סיימון
      </div>
    </div>
  );
}
