# תוכנית – Milestone 2: משחק מלא מקצה לקצה

> מקורות: `MILESTONES.md` (Milestone 2), `PRD.md` §3–4.2, `DESIGN.md` §1.1 (מצבי תצוגה וטבלת "קצב הצגת הרצף"), `ARCHITECTURE.md` §2.3–2.5, ADR-1, ADR-2, ADR-3 (Action זמני `abandon`), ADR-5.
> הקוד הקיים (Milestone 1) הוא נקודת המוצא: `App` מחזיק את המסך הפעיל, `HomeScreen` סטטי, `SimonBoard` בלי handlers.
> מחוץ לתכולה: מצב `paused` ו-"המשך משחק" (M3), `localStorage`/היסטוריה (M4), PWA (M5).

## 0. דרישות מוקדמות
- אין צורך ב-`.env`, בחשבונות או במפתחות.
- Dependencies חדשות: `canvas-confetti` (dependency) ו-`@types/canvas-confetti` (devDependency). אין אחרות.

## 1. מבנה קבצים
```text
src/
  game/
    colors.ts              (קיים) + שדה frequency לכל צבע (או מפה נפרדת ב-audio)
    constants.ts           TOTAL_ROUNDS = 10 וקבועי הקצב מ-DESIGN §1.1 (ראה סעיף 4)
    random.ts              randomColor(): ColorId – Math.random() לאינדקס 0–3
    gameReducer.ts         State, Actions, initialGameState, gameReducer – טהור, בלי אודיו/Timers
    useGame.ts             Hook שמחבר Reducer + Sequence Controller + Audio + Timers; נקרא ב-App
    sleep.ts               sleep(ms, signal) – Promise שנדחה מיד ב-abort ומנקה את ה-Timer
  audio/
    audioEngine.ts         unlockAudio, startTone/stopTone, playWin, playLoss, stopAll
  effects/
    confetti.ts            fireWinConfetti(), clearConfetti() – עטיפה ל-canvas-confetti
  components/
    SimonBoard.tsx (+.css) props: activeColor, interactive, dimmed, onPadDown, onPadUp; מצבי Glow/עמעום
    ResultOverlay.tsx (+.css) כרטיס ניצחון/הפסד מעל הלוח
  screens/
    HomeScreen.tsx (+.css) מקבל את מצב המשחק ופעולותיו כ-props; סטטוס, חיווי שלב, כפתור לפי מצב
  App.tsx                  useGame ב-App; ניווט ל"אודות" קורא ל-game.abandon()
  game/gameReducer.test.ts בדיקות יחידה ל-Reducer
  game/Game.test.tsx       בדיקות אינטגרציה עם Fake Timers ו-Mocks
  audio/audioEngine.test.ts בדיקה שארבעת הצלילים שונים זה מזה
```

## 2. מודל המצב (`gameReducer.ts`)
```ts
type GameStatus = 'idle' | 'presenting' | 'awaitingInput' | 'advancing' | 'won' | 'lost';
type GameState = {
  status: GameStatus;
  sequence: ColorId[];      // 0–10 colors
  round: number;            // 1–10
  inputIndex: number;
  completedRounds: number;  // 0–10
  gameId: number;           // increments on every start (history guard in M4)
  presentationId: number;   // increments on every new presentation; stale playback ends are ignored
};
```
- `advancing` הוא מצב מעבר פנימי (קלט חסום) בין שחזור נכון של שלב לבין השלב הבא, כדי לממש את ה-`1000ms` שבהם "חיווי השלב שהושלם נשאר על המסך". יתועד כ-**ADR-10** ב-`ARCHITECTURE.md` בזמן הבנייה.

**Actions וכללים** (כל Action שלא חוקי במצב הנוכחי מחזיר את אותו State בדיוק):
| Action | מותר מ- | תוצאה |
|---|---|---|
| `start { firstColor }` | `idle` | `presenting`, `sequence=[firstColor]`, `round=1`, `inputIndex=0`, `completedRounds=0`, `gameId+1`, `presentationId+1` |
| `presentationDone { presentationId }` | `presenting` עם אותו id | `awaitingInput`, `inputIndex=0` |
| `press { color }` נכון, לא אחרון | `awaitingInput` | `inputIndex+1` |
| `press` נכון ואחרון, `round<10` | `awaitingInput` | `advancing`, `completedRounds=round` |
| `press` נכון ואחרון, `round=10` | `awaitingInput` | `won`, `completedRounds=10` |
| `press` שגוי | `awaitingInput` | `lost`, `completedRounds=round-1` (0 בשלב 1) |
| `nextRound { nextColor }` | `advancing` | `presenting`, `round+1`, `sequence=[...sequence, nextColor]`, `inputIndex=0`, `presentationId+1` |
| `dismiss` | `won`/`lost` | `initialGameState` עם שמירת `gameId`/`presentationId` (ADR-5) |
| `abandon` (זמני, ADR-3) | `presenting`/`awaitingInput`/`advancing` | כמו `dismiss` + `presentationId+1` |

- הצבע האקראי נוצר ב-`useGame` דרך `random.ts` ומועבר ב-Action (ADR-2) – ה-Reducer דטרמיניסטי.
- אין שלב 11: מ-`won` אין `nextRound`.

## 3. Audio Engine (`audioEngine.ts`, Web Audio API)
- `AudioContext` יחיד, נוצר בעצלות. `unlockAudio(): Promise<boolean>` – יוצר/מחדש (`resume()`) את ה-Context; נקרא **רק** מתוך ה-click של "התחל משחק" (ADR-5: "אישור" אינו Gesture אודיו). מחזיר `false` אם אין תמיכה, אם `resume()` נדחה, או אם המצב אינו `running`.
- `startTone(color): ToneHandle` – Oscillator (`triangle`) + GainNode עם Attack/Release קצרים (~10ms) למניעת קליקים; `handle.stop()` מכבה עם Release. גבהים שונים לכל צבע (בהשראת Simon המקורי, למשל ירוק 392Hz, אדום 330Hz, צהוב 262Hz, כחול 196Hz – הערכים המדויקים נקבעים ביישום; החובה היא ארבעה שונים).
- `playWin()` – מוטיב עולה קצר (3–4 תווים); `playLoss()` – מוטיב יורד/נמוך, שונה בבירור.
- `stopAll()` – עוצר מיד כל צליל פעיל (רשימת Nodes פעילים).
- **כשל אודיו:** אם `unlockAudio()` מחזיר `false`, המשחק **לא מתחיל** (נשאר `idle`), ומוצגת באזור הסטטוס הודעה קצרה: **"לא ניתן להפעיל את הצלילים. נסו ללחוץ שוב על "התחל משחק"."** ההודעה נעלמת בהתחלה מוצלחת.

## 4. קצב ו-Sequence Controller (`useGame.ts`)
קבועים ב-`constants.ts` (DESIGN §1.1, זהים בכל השלבים):
`TONE_MS=600`, `GAP_MS=250`, `LEAD_IN_MS=1000`, `ROUND_HOLD_MS=1000`, `RESULT_DELAY_MS=1000`, `PRESS_MIN_MS=300`.

**הצגת רצף:** Effect שתלוי ב-`status==='presenting'` וב-`presentationId`:
1. יוצר `AbortController`; ב-Cleanup – `abort()`, `stopAll()`, ניקוי `activeColor`.
2. `await sleep(LEAD_IN_MS)` ← לכל צבע: `activeColor=color` + `startTone`, `await sleep(TONE_MS)`, כיבוי, ואם אינו האחרון `await sleep(GAP_MS)`.
3. בסיום (אם לא בוטל) – `dispatch(presentationDone{presentationId})`. ה-Reducer מתעלם מ-id מיושן.
- `LEAD_IN_MS` חל גם בתחילת משחק וגם אחרי מעבר שלב ("אחרי הצגת מספר השלב הבא: המתנה עד הצבע הראשון שלו").

**מעבר שלב:** Effect על `status==='advancing'` – Timer של `ROUND_HOLD_MS` ואז `dispatch(nextRound{nextColor: randomColor()})` (חיווי השלב מתעדכן רק עכשיו). Cleanup מבטל את ה-Timer.

**לחיצת שחקן (ADR-2):**
- `pointerdown` על רבע (רק ב-`awaitingInput`): קוטע מיד הארה/צליל לחיצה קודמים, מדליק `activeColor` + `startTone`, ושולח `press`. ההארה והצליל נמשכים עד המאוחר מבין `PRESS_MIN_MS` לבין שחרור האצבע (`pointerup`/`pointercancel` נקלטים על `window`).
- מקלדת: `Enter`/`Space` על רבע = לחיצה של `PRESS_MIN_MS`.
- לחיצה שגויה משמיעה מיד את צליל הרבע שנלחץ, כמו כל לחיצה.
- במצבים אחרים הלחיצה מתעלמת (גם ברמת ה-UI וגם ב-Reducer).

**סיום משחק:** ה-Reducer עובר ל-`won`/`lost` **מיד** (קלט נחסם; ב-M4 הרישום יתבצע כאן, לפי ADR-4). ב-`useGame` נשמר `resultVisible` (false בכניסה), Timer של `RESULT_DELAY_MS` ואז: `resultVisible=true` + `playWin()` + `fireWinConfetti()` בניצחון, או `playLoss()` בהפסד. `dismiss` מאפס את `resultVisible` ומריץ `clearConfetti()`.

**ביטול זמני במעבר ל"אודות":** `App` עוטף את `onNavigate`: מעבר ל-`about` בזמן `presenting`/`awaitingInput`/`advancing` קורא ל-`game.abandon()`. ה-Cleanups של ה-Effects עוצרים Timers, הארה וצליל; `abandon` גם עוצר צליל לחיצה פעיל. משחק שכבר הסתיים (`won`/`lost`) לא מושפע. (יוחלף בהשהיה ב-M3.)

**Refresh:** כל המצב ב-Memory בלבד; אין שימוש ב-`localStorage`/`sessionStorage`.

## 5. UI
**`SimonBoard`:**
- Props: `activeColor`, `interactive` (רק ב-`awaitingInput`), `dimmed` (בזמן `presenting`/`advancing`), `onPadDown(color)`.
- Glow: רבע פעיל מקבל `data-active="true"` → צבע בהיר יותר + `box-shadow`/`filter` זוהר. בזמן הצגה הרבעים הלא-פעילים מעומעמים (כמו ב-Mockup "הצגת רצף"); בתור השחקן הלוח מלא.
- כשלא `interactive`: `aria-disabled="true"` ו-`pointer-events` חסומים (לא `disabled` אמיתי, כדי שה-`pointerup` לא ייבלע). שמות נגישים בעברית נשארים.
- `prefers-reduced-motion`: ללא transitions; ההארה עצמה נשארת (היא חלק מהמשחק).

**`HomeScreen` לפי מצב (DESIGN §1.1):**
| מצב | חיווי שלב | סטטוס מעל הלוח | אזור הפעולה מתחת ללוח |
|---|---|---|---|
| `idle` | "שלב 1 מתוך 10" | ריק (או הודעת כשל אודיו) | **"התחל משחק"** |
| `presenting` | `round` | "המשחק מציג את הרצף" | ללא כפתור |
| `awaitingInput` | `round` | "התור שלך" | הנחיה "הקש על הצבעים לפי הסדר" |
| `advancing` | השלב שהושלם | ריק | ריק |
| `won`/`lost` | השלב האחרון שהיה פעיל | ריק | **"אישור"** (מופיע יחד עם ההודעה, אחרי `RESULT_DELAY_MS`) |
- אזור הפעולה שומר גובה קבוע כדי שהלוח לא יקפוץ.

**`ResultOverlay`** (Mockups "ניצחון"/"הפסד"): כרטיס Surface עם גבול כחול ופינות מעוגלות, ממוקם מעל הלוח (הלוח נראה מסביב). `role="alert"`.
- ניצחון: **"כל הכבוד! ניצחת!"** (H1; "כל הכבוד!" בירוק כמו ב-Mockup) + קונפטי.
- הפסד: **"נפסלת!"** (H1, אדום) ומתחתיו: 0 → **"לא השלמת אף שלב"**, 1 → **"השלמת שלב אחד"**, אחרת **"השלמת X שלבים"**. ללא קונפטי.
- הכפתור **"אישור"** (PrimaryButton) – באזור הפעולה מתחת ללוח, כמו מיקום הכפתור ב-Mockups.

**קונפטי (`confetti.ts`):** `canvas-confetti` עם צבעי ארבעת הרבעים, כמה פרצים במשך ~2 שניות, `disableForReducedMotion: true`. `clearConfetti()` קורא ל-`confetti.reset()` ומבטל פרצים ממתינים.

## 6. בדיקות אוטומטיות
**`gameReducer.test.ts` (ללא Mocks):**
1. `start` יוצר רצף באורך 1, `round=1`, `gameId` חדש.
2. רצף בשלבים 1, 2, 10 באורך 1, 2, 10; כל שלב שומר את הרצף הקודם כתחילית ומוסיף צבע אחד בסוף; צבע חוזר מותר.
3. לחיצות ב-`idle`/`presenting`/`advancing`/`won`/`lost` לא משנות את המצב.
4. לחיצה שגויה בשלב 1 → `lost`, `completedRounds=0`; שגויה בשלב 5 → `lost`, `4`.
5. השלמת שלב 10 → `won`, `completedRounds=10`; `nextRound` מ-`won` לא יוצר שלב 11.
6. `presentationDone` עם id מיושן מתעלם.
7. `dismiss` → `idle` עם `gameId` שמור; `start` הבא מעלה `gameId`.
8. `abandon` מכל מצב פעיל → `idle`; מ-`won`/`lost` – ללא שינוי.

**`Game.test.tsx` (אינטגרציה; `vi.useFakeTimers`, Mock ל-`random.ts`, `audioEngine.ts`, `canvas-confetti`; `fireEvent` סינכרוני):**
1. "התחל משחק" → אחרי 1000ms הרבע הראשון מואר 600ms ונכבה; ברצף של 2 – הפסקה של 250ms בין הצבעים; אותם זמנים בשלב 1 ובשלב 3 (קצב קבוע).
2. לחיצה בזמן הצגה לא משפיעה (המשחק לא נפסל ולא מתקדם).
3. הפסד בשלב 1: צליל הרבע מיד, אחרי 1000ms "נפסלת!" + "לא השלמת אף שלב" + `playLoss`; קונפטי לא נקרא.
4. הפסד בשלב מתקדם (למשל 4): "השלמת 3 שלבים".
5. ניצחון: מעבר 10 שלבים מלאים → אחרי 1000ms "כל הכבוד! ניצחת!" + `playWin` + קונפטי; אין שלב 11.
6. "אישור" → חזרה ל-"שלב 1 מתוך 10" ו-"התחל משחק"; התחלה נוספת יוצרת רצף חדש (ה-Mock של random מחזיר צבעים אחרים).
7. כשל `unlockAudio` → הודעת כשל, המשחק לא מתחיל; לחיצה חוזרת מוצלחת מתחילה משחק.
8. מעבר ל"אודות" באמצע הצגה ובאמצע קלט → `stopAll` נקרא, `vi.getTimerCount()===0`, ובחזרה לבית: "שלב 1 מתוך 10" ו-"התחל משחק", ללא רבע מואר.
9. לא מתבצעת כתיבה ל-`localStorage` במהלך משחק (Spy על `Storage.prototype.setItem`).

**`audioEngine.test.ts`:** ארבעת הגבהים שונים זה מזה (בדיקה על מפת התדרים).
- הבדיקות הקיימות ב-`App.test.tsx` ממשיכות לעבור.

## 7. בדיקה עצמית בזמן הבנייה (לפני סימון 🟡)
- `npm run typecheck`, `npm run test`, `npm run build` – עוברים.
- `npm run dev` בדפדפן המובנה ב-375×812: משחק מלא, הארה/עמעום לפי המצבים, Overlay הפסד וניצחון (ניצחון ייבדק בהרצה ידנית ארוכה או דרך הבדיקות האוטומטיות), "אישור", מעבר ל"אודות" באמצע משחק, Refresh באמצע משחק, אין שגיאות Console, אין גלילה אופקית. צילום מסך להשוואה מול ה-Mockups.
- **מגבלה:** Claude לא יכול לשמוע צלילים ולא לבדוק מכשיר אמיתי – בדיקת שמע ומגע בטלפון (כולל מתג שקט באייפון, ARCHITECTURE §1) תופיע ברשימת הבדיקות של המשתמש.
- הוספת **ADR-10** (מצב `advancing` + חשיפת התוצאה אחרי `RESULT_DELAY_MS` בעוד ה-Reducer כבר ב-`won`/`lost`) ל-`ARCHITECTURE.md`.
- סגירת שרת הפיתוח, סימון 🟡 ליד Milestone 2 ב-`MILESTONES.md`. בלי commit.

## 8. מיפוי ל-Definition of Done
| תנאי | איך נבדק |
|---|---|
| התחלה בלחיצה; אורכי רצף 1/2/10; כל שלב = הקודם + צבע אחד | Reducer 1–2, אינטגרציה 1, 5 |
| ארבעה צלילים שונים והארה נבדלת; קצב קבוע | `audioEngine.test`, אינטגרציה 1, בדיקה ויזואלית + בדיקת שמע של המשתמש |
| לחיצות בהצגה חסומות; נכונות מקדמות; שגויה אחת = הפסד | Reducer 3–4, אינטגרציה 2–3 |
| הפסד בשלב 1 (0), הפסד מתקדם, ניצחון אחרי 10, אין שלב 11, רצף חדש אחרי "אישור" | Reducer 4–5, 7; אינטגרציה 3–6 |
| טקסט וצליל סיום; קונפטי רק בניצחון | אינטגרציה 3, 5 + בדיקה בדפדפן |
| Refresh מאפס; אין שמירה מתמידה | אינטגרציה 9 + Refresh בדפדפן |
| קצב לפי DESIGN; לחיצה שגויה – צליל מיד, הפסד אחרי שנייה | אינטגרציה 1, 3 |
| מעבר ל"אודות" לא משאיר הארה/צליל/Timer | אינטגרציה 8 + בדיקה בדפדפן |
