import './AboutScreen.css';

export default function AboutScreen() {
  return (
    <section className="about-screen">
      <article className="about-card">
        <h2 className="about-card__title">על המשחק</h2>
        <p>סיימון הוא משחק זיכרון: המשחק מציג רצף של צבעים וצלילים, ועליך לחזור עליו.</p>
        <ul className="about-card__list">
          <li>לחצו על "התחל משחק" וצפו ברצף.</li>
          <li>הקישו על הצבעים באותו סדר.</li>
          <li>בכל שלב נוסף צבע אחד לרצף.</li>
          <li>טעות אחת מסיימת את המשחק – נסו להגיע עד שלב 10!</li>
        </ul>
      </article>

      <h3 className="about-screen__history-title">10 המשחקים האחרונים</h3>
      <p className="about-screen__empty">עדיין אין משחקים שמורים.</p>
    </section>
  );
}
