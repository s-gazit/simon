import SimonBoard from '../components/SimonBoard';
import PrimaryButton from '../components/PrimaryButton';
import ResultOverlay from '../components/ResultOverlay';
import { TOTAL_ROUNDS } from '../game/constants';
import type { GameStatus } from '../game/gameReducer';
import type { Game } from '../game/useGame';
import './HomeScreen.css';

const STATUS_TEXT: Record<GameStatus, string> = {
  idle: '',
  presenting: 'המשחק מציג את הרצף',
  awaitingInput: 'התור שלך',
  advancing: '',
  won: '',
  lost: '',
};

const AUDIO_ERROR_TEXT = 'לא ניתן להפעיל את הצלילים. נסו ללחוץ שוב על "התחל משחק".';

type Props = {
  game: Game;
};

export default function HomeScreen({ game }: Props) {
  const { state, activeColor, audioError, resultVisible } = game;
  const { status, round, completedRounds } = state;
  const ended = status === 'won' || status === 'lost';

  return (
    <section className="home-screen">
      <p className="home-screen__round">{`שלב ${round} מתוך ${TOTAL_ROUNDS}`}</p>
      <p className="home-screen__status" aria-live="polite">
        {status === 'idle' && audioError ? AUDIO_ERROR_TEXT : STATUS_TEXT[status]}
      </p>
      <div className="home-screen__board">
        <SimonBoard
          activeColor={activeColor}
          interactive={status === 'awaitingInput'}
          dimmed={status === 'presenting' || status === 'advancing'}
          onPadDown={game.pressColor}
        />
        {ended && resultVisible && (
          <ResultOverlay outcome={status === 'won' ? 'win' : 'loss'} completedRounds={completedRounds} />
        )}
      </div>
      <div className="home-screen__action">
        {status === 'idle' && <PrimaryButton onClick={game.start}>התחל משחק</PrimaryButton>}
        {status === 'awaitingInput' && <p className="home-screen__hint">הקש על הצבעים לפי הסדר</p>}
        {ended && resultVisible && <PrimaryButton onClick={game.dismiss}>אישור</PrimaryButton>}
      </div>
    </section>
  );
}
