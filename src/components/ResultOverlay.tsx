import './ResultOverlay.css';

type Props = {
  outcome: 'win' | 'loss';
  completedRounds: number;
};

function completedText(completedRounds: number): string {
  if (completedRounds === 0) return 'לא השלמת אף שלב';
  if (completedRounds === 1) return 'השלמת שלב אחד';
  return `השלמת ${completedRounds} שלבים`;
}

export default function ResultOverlay({ outcome, completedRounds }: Props) {
  return (
    <div className={`result-overlay result-overlay--${outcome}`} role="alert">
      {outcome === 'win' ? (
        <h2 className="result-overlay__title">
          <span className="result-overlay__accent">כל הכבוד!</span> <span>ניצחת!</span>
        </h2>
      ) : (
        <>
          <h2 className="result-overlay__title result-overlay__accent">נפסלת!</h2>
          <p className="result-overlay__detail">{completedText(completedRounds)}</p>
        </>
      )}
    </div>
  );
}
