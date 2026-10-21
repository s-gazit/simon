import SimonBoard from '../components/SimonBoard';
import PrimaryButton from '../components/PrimaryButton';
import './HomeScreen.css';

const TOTAL_ROUNDS = 10;

export default function HomeScreen() {
  return (
    <section className="home-screen">
      <p className="home-screen__round">{`שלב 1 מתוך ${TOTAL_ROUNDS}`}</p>
      {/* Status line placeholder, filled with game status in Milestone 2 */}
      <p className="home-screen__status" aria-live="polite" />
      <SimonBoard />
      <div className="home-screen__action">
        <PrimaryButton>התחל משחק</PrimaryButton>
      </div>
    </section>
  );
}
