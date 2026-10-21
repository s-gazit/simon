import SimonBoard from '../components/SimonBoard';
import PrimaryButton from '../components/PrimaryButton';
import ResultOverlay from '../components/ResultOverlay';
import { TOTAL_ROUNDS } from '../game/constants';
import { isGameActive, type GameStatus } from '../game/gameReducer';
import type { Game } from '../game/useGame';
import './HomeScreen.css';

const STATUS_TEXT: Record<GameStatus, string> = {
  idle: '',
  presenting: 'המשחק מציג את הרצף',
  awaitingInput: 'התור שלך',
  advancing: '',
  paused: 'המשחק מושהה',
  won: '',
  lost: '',
};

// Audio can only be unlocked from these buttons, so a failure names the one to press again.
const AUDIO_RETRY_BUTTON: Partial<Record<GameStatus, string>> = { idle: 'התחל משחק', paused: 'המשך משחק' };

const audioErrorText = (button: string) => `לא ניתן להפעיל את הצלילים. נסו ללחוץ שוב על "${button}".`;

type Props = {
  game: Game;
};

export default function HomeScreen({ game }: Props) {
  const { state, activeColor, audioError, resultVisible } = game;
  const { status, round, completedRounds } = state;
  const ended = status === 'won' || status === 'lost';
  const retryButton = audioError ? AUDIO_RETRY_BUTTON[status] : undefined;

  return (
    <section className="home-screen">
      <p className="home-screen__round">{`שלב ${round} מתוך ${TOTAL_ROUNDS}`}</p>
      <p className="home-screen__status" aria-live="polite">
        {retryButton ? audioErrorText(retryButton) : STATUS_TEXT[status]}
      </p>
      <div className="home-screen__board">
        <SimonBoard
          activeColor={activeColor}
          interactive={status === 'awaitingInput'}
          dimmed={status === 'presenting' || status === 'advancing' || status === 'paused'}
          onPadDown={game.pressColor}
        />
        {ended && resultVisible && (
          <ResultOverlay outcome={status === 'won' ? 'win' : 'loss'} completedRounds={completedRounds} />
        )}
      </div>
      <div className="home-screen__action">
        {status === 'idle' && <PrimaryButton onClick={game.start}>התחל משחק</PrimaryButton>}
        {status === 'paused' && <PrimaryButton onClick={game.resume}>המשך משחק</PrimaryButton>}
        {status === 'awaitingInput' && <p className="home-screen__hint">הקש על הצבעים לפי הסדר</p>}
        {isGameActive(status) && <PrimaryButton onClick={game.pause}>השהה משחק</PrimaryButton>}
        {ended && resultVisible && <PrimaryButton onClick={game.dismiss}>אישור</PrimaryButton>}
      </div>
    </section>
  );
}
