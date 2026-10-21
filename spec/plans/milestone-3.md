# תוכנית – Milestone 3: השהיה וחידוש משחק

> מקורות: `MILESTONES.md` (Milestone 3), `PRD.md` §3ב ("מעבר למסך אודות והמשך משחק"), §4.1, §4.3, §4ב (מקרי קצה), `DESIGN.md` §1.1 (מצב "מושהה", חיווי שלב, טבלת הקצב – `1000ms` לפני הצגה גם אחרי "המשך משחק"), `ARCHITECTURE.md` §2.3–2.4, ADR-3, ADR-10.
> נקודת המוצא היא הקוד הקיים (Milestone 2): `gameReducer` עם Action זמני `abandon`, `useGame` שמנהל אודיו/Timers עם `AbortController` + `presentationId`, ו-`App.navigate` שקורא ל-`game.abandon()` במעבר ל"אודות".
> מחוץ לתכולה: היסטוריה/`localStorage` (M4), PWA (M5).

## 0. דרישות מוקדמות
- אין צורך ב-`.env`, בחשבונות, במפתחות או ב-Dependencies חדשות.

## 1. קבצים שישתנו
```text
src/game/gameReducer.ts       + מצב 'paused', Actions 'pause'/'resume'; הסרת 'abandon'
src/game/useGame.ts           pause(), resume(), מאזיני visibilitychange/pagehide; הסרת abandon()
src/App.tsx                   ניווט ל"אודות" קורא ל-game.pause() (במקום abandon)
src/screens/HomeScreen.tsx    מצב מושהה: חיווי "המשחק מושהה", לוח מעומעם, כפתור "המשך משחק"; הודעת כשל אודיו גם במצב מושהה
src/game/gameReducer.test.ts  בדיקות pause/resume; הסרת בדיקת abandon
src/game/Game.test.tsx        החלפת בדיקות "יציאה לאודות מבטלת" בבדיקות השהיה/חידוש
spec/ARCHITECTURE.md          ADR-11 (השהיה בזמן advancing); עדכון ADR-3 אינו נדרש – הוא כבר מתאר את M3
spec/MILESTONES.md            🟡 ליד Milestone 3 בסיום הבנייה
```
אין קבצים חדשים. `sleep.ts`, `audioEngine.ts`, `SimonBoard` נשארים כמו שהם (ל-`SimonBoard` כבר יש `dimmed` ו-`interactive`).

## 2. Reducer (`gameReducer.ts`)
```ts
type GameStatus = 'idle' | 'presenting' | 'awaitingInput' | 'advancing' | 'paused' | 'won' | 'lost';
type GameAction = ... | { type: 'pause'; nextColor: ColorId } | { type: 'resume' };   // 'abandon' removed
```
- `isGameActive` מחזיר `true` גם ל-`paused` (משחק קיים שלא הסתיים). לצורך "האם להשהות" ייעשה שימוש ב-guard של ה-Reducer עצמו (pause מ-`paused` מחזיר אותו State).

| Action | מותר מ- | תוצאה |
|---|---|---|
| `pause` | `presenting`, `awaitingInput` | `paused`, אותו `sequence` ו-`round`, `inputIndex=0`, `presentationId+1` (סיום Playback מיושן מתעלם) |
| `pause { nextColor }` | `advancing` | `paused`, עם השלב הבא כבר מוכן: `sequence=[...sequence, nextColor]`, `round+1`, `inputIndex=0`, `presentationId+1` (ראה סעיף 5) |
| `resume` | `paused` | `presenting`, אותו `sequence` ו-`round`, `inputIndex=0`, `presentationId+1` |
| `pause`/`resume` מכל מצב אחר | – | אותו State בדיוק (כולל `idle`, `won`, `lost` – משחק שהסתיים או לא התחיל אינו מושפע) |

- `press` ו-`presentationDone` כבר מתעלמים מכל מצב שאינו `awaitingInput`/`presenting`, ולכן ב-`paused` אין קלט ואין השפעה ל-Callback ישן.
- `completedRounds` אינו משתנה בהשהיה/חידוש; אין `gameId` חדש (זה אותו משחק – חשוב ל-Guard ההיסטוריה של M4).

## 3. `useGame.ts`
- **`pause()`**: `endPress()` (עוצר הארה וצליל של לחיצת שחקן), `stopAll()`, ואז `dispatch({ type: 'pause', nextColor: randomColor() })`. ניקוי ה-Effects הקיימים כבר מבטל את ה-Playback (`controller.abort()` + `stopAll()` + `setActiveColor(null)`) ואת Timer ה-`advancing` ברגע שהסטטוס משתנה.
- **`resume()`** (מופעל רק מלחיצה על "המשך משחק" – Gesture אודיו): אם `status !== 'paused'` – לא עושה דבר. `await unlockAudio()`; בכשל – `setAudioError(true)` ונשארים מושהים. בהצלחה – בדיקה נוספת ש-`document.visibilityState === 'visible'` (אם האפליקציה הוסתרה בזמן ההמתנה, נשארים מושהים) ואז `dispatch({ type: 'resume' })`. לחיצה כפולה מהירה: הדיספאץ' השני נופל על `presenting` וה-Reducer מתעלם ממנו.
- ה-Effect של ה-Playback לא משתנה: כניסה ל-`presenting` עם `presentationId` חדש מציגה מחדש את **כל** הרצף, כולל `LEAD_IN_MS` (`1000ms`) לפני הצבע הראשון, כנדרש ב-DESIGN.
- **Visibility Handler** – Effect אחד ב-`useGame`:
  - `document` → `visibilitychange`: אם `document.visibilityState === 'hidden'` → `pause()`. חזרה ל-`visible` לא עושה דבר (אין Resume אוטומטי).
  - `window` → `pagehide`: `pause()` (Safety Net).
  - `pause` נקרא דרך `ref` לפונקציה העדכנית כדי שהמאזינים יירשמו פעם אחת וינוקו ב-Unmount.
- הסרת `abandon` מה-Hook ומה-type המוחזר; החזרת `pause` ו-`resume`.
- `audioError` מתאפס בלחיצה מוצלחת הבאה (כמו היום ב-`start`).

## 4. UI
- **`App.tsx`**: `navigate('about')` קורא ל-`game.pause()` (ה-Reducer מתעלם אם אין משחק פעיל). מעבר חזרה ל"בית" לא עושה דבר מעבר להחלפת המסך. ההערה "Temporary" מוסרת.
- **`HomeScreen.tsx`**:
  - `STATUS_TEXT.paused = 'המשחק מושהה'`.
  - לוח: `dimmed` גם ב-`paused`; `interactive` נשאר רק ב-`awaitingInput`.
  - כפתור: `status === 'paused'` → `<PrimaryButton onClick={game.resume}>המשך משחק</PrimaryButton>`. הכפתור לא מופיע בשום מצב אחר.
  - הודעת כשל אודיו: במצב `paused` הטקסט הוא `לא ניתן להפעיל את הצלילים. נסו ללחוץ שוב על "המשך משחק".` (במצב `idle` נשאר הנוסח הקיים עם "התחל משחק").
  - חיווי השלב מציג את `round` כרגיל – כולל במצב מושהה (DESIGN §1.1).

## 5. החלטה שתתועד כ-ADR-11 (השהיה בזמן `advancing`)
**הקשר:** ADR-10 קובע ש-`advancing` (ההמתנה של `1000ms` אחרי שחזור נכון) נחשב משחק פעיל לצורכי השהיה, אבל לא מגדר מה מוצג בחידוש. השחקן כבר השלים את השלב, והמעבר לשלב הבא הוכרע לפני ההשהיה.
**החלטה:** `pause` מ-`advancing` משלים את המעבר: הצבע האקראי הבא (מועבר ב-Action, כי הרנדום מחוץ ל-Reducer לפי ADR-2) נוסף, השלב עולה באחד, והמשחק נכנס ל-`paused`. "המשך משחק" מציג את הרצף המלא של השלב החדש.
**השלכות:** השחקן לא נדרש לשחק שוב שלב שכבר השלים, וההשהיה עצמה לא משנה מספר שלב (השינוי נובע מהשלמת השלב שקדמה לה). לחיצה אחרונה נכונה בשלב 10 עוברת ישר ל-`won` ולכן אינה מושפעת. משחק ב-`won`/`lost` שהודעתו עוד לא נחשפה (`RESULT_DELAY_MS`) אינו מושהה, וההודעה תופיע כרגיל בחזרה לבית.

## 6. בדיקות אוטומטיות
**`gameReducer.test.ts`**
- `pause` מ-`presenting` ומ-`awaitingInput` (עם `inputIndex>0`): `paused`, אותו רצף ושלב, `inputIndex=0`, `presentationId` עולה.
- `pause` מ-`advancing`: רצף ארוך באחד, שלב+1, `paused`.
- `pause`/`resume` מ-`idle`, `won`, `lost` מחזירים אותו אובייקט; `resume` מחוץ ל-`paused` מתעלם; `pause` מ-`paused` מתעלם.
- `resume`: `presenting`, אותו רצף ושלב, `presentationId` חדש; `presentationDone` עם ה-id הישן (של לפני ההשהיה) מתעלם.
- `press` ב-`paused` מתעלם; `gameId` ו-`completedRounds` לא משתנים לאורך pause/resume.

**`Game.test.tsx`** (Fake Timers + Mocks קיימים לאודיו)
- מעבר ל"אודות" באמצע הצגת רצף: אין הארה פעילה, `stopAll` נקרא, וקידום הזמן לא מפעיל צלילים נוספים.
- מעבר ל"אודות" באמצע שחזור (אחרי לחיצה נכונה אחת): אותו דבר; חזרה ל"בית" מציגה "המשחק מושהה", "שלב X מתוך 10" זהה, וכפתור "המשך משחק"; קידום הזמן לא מתחיל הצגה.
- "המשך משחק": אחרי `1000ms` מוצג שוב **כל** הרצף מהצבע הראשון (גם החלק שכבר הוקש), אותו אורך – בלי צבע נוסף; אחר כך "התור שלך" והשחזור מתחיל מהצבע הראשון.
- `visibilitychange` ל-`hidden` (סימולציה של `document.visibilityState`) משהה; חזרה ל-`visible` לא מחדשת; `pagehide` משהה.
- לחיצות על הלוח במצב מושהה לא משפיעות.
- כשל `unlockAudio` ב"המשך משחק": נשארים מושהים עם הודעה בעברית; ניסיון חוזר מצליח.
- לחיצה כפולה מהירה על "המשך משחק" מציגה את הרצף פעם אחת בלבד.
- "המשך משחק" לא מוצג לפני תחילת משחק, ולא אחרי ניצחון/הפסד/"אישור"; מעבר לאודות כשאין משחק פעיל לא משנה דבר.
- משחק מושהה לא נחשב הפסד (אין הודעת הפסד/צליל הפסד), ו-Unmount + Mount מחדש (שקול ל-Refresh) מציג "התחל משחק" ו-"שלב 1 מתוך 10".
- הבדיקה הקיימת "does not persist the game to storage" נשארת ומכסה גם מצב מושהה.

## 7. בדיקה ידנית (בזמן הבנייה, באמולציית מובייל)
- התחלת משחק → מעבר לאודות באמצע הצגה → חזרה → "המשך משחק" → הרצף המלא מוצג שוב.
- הסתרת הלשונית/החלון ובדיקת החזרה (אין Resume אוטומטי). נעילת טלפון אמיתית לא ניתנת לבדיקה כאן – תסומן כבדיקה למכשיר אמיתי ולא תוצג כעוברת.

## 8. Definition of Done (מ-MILESTONES.md) ← איך נבדק
| תנאי | כיסוי |
|---|---|
| מעבר ל"אודות" בזמן הצגה ובזמן שחזור משהה ועוצר מיד הארה וצליל | בדיקות Game.test + בדיקה ידנית |
| חזרה ל"בית" לא מפעילה את הרצף; "המשך משחק" רק במשחק מושהה | Game.test |
| "המשך משחק" מציג מחדש את כל הרצף; שלב לא משתנה ואין צבע חדש | Reducer + Game.test |
| הסתרת האפליקציה וחזרה – אותו כלל, בלי שינוי מ-Callback שבוטל | Game.test (visibilitychange/pagehide, presentationId ישן) + בדיקה ידנית של הסתרת לשונית |
| משחק מושהה אינו הפסד; Refresh מאפס | Game.test (Unmount/Mount) + בדיקה ידנית ב-Refresh |
