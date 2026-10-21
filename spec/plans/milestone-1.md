# תוכנית – Milestone 1: בסיס אפליקציה ושני מסכים מעוצבים

> מקורות: `MILESTONES.md` (Milestone 1), `PRD.md`, `DESIGN.md` + התמונות, `ARCHITECTURE.md` (כולל ADR-1, ADR-2, ADR-8).
> בסוף ה-Milestone הלוח והכפתור **לא** מריצים משחק. אין אודיו, קונפטי, PWA או `localStorage` – אלה שייכים ל-Milestones 2–5.

## 0. דרישה מוקדמת (חוסם בנייה)
- **Node.js לא מותקן במחשב** (`node`/`npm` לא נמצאו). לפני הבנייה המשתמש צריך להתקין את גרסת **Node.js LTS** מ-nodejs.org (Windows Installer), ולפתוח מחדש את Claude כדי שהפקודה תזוהה. Claude ידריך צעד אחר צעד.
- אין צורך ב-`.env`, בחשבונות או במפתחות ב-Milestone הזה.

## 1. הקמת הפרויקט
הפרויקט נבנה ישירות בשורש ה-Repository (לא בתת-תיקייה), בלי `npm create vite` אינטראקטיבי – הקבצים נכתבים ידנית ואז `npm install`.

**Dependencies:** `react`, `react-dom`, `@fontsource/heebo`
**devDependencies:** `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`

**Scripts ב-`package.json`:**
| פקודה | מה עושה |
|---|---|
| `npm run dev` | `vite` – שרת פיתוח, `http://localhost:5173/simon/` |
| `npm run typecheck` | `tsc -b --noEmit` (או `tsc --noEmit` לפי מבנה ה-tsconfig) |
| `npm run build` | `tsc -b && vite build` |
| `npm run preview` | `vite preview` |
| `npm run test` | `vitest run` |

**קבצי תצורה:**
- `package.json` (`"type": "module"`, `"private": true`) + `package-lock.json` (נוצר אוטומטית, נכנס ל-Repo).
- `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` – `strict: true`, `jsx: react-jsx`, טיפוסי `vitest/globals` ו-`@testing-library/jest-dom`.
- `vite.config.ts` – plugin React, **`base: '/simon/'`** (לפי ADR-8 כבר עכשיו), ובלוק `test` של Vitest: `environment: 'jsdom'`, `globals: true`, `setupFiles: './src/test/setup.ts'`.
- `.gitignore` – כבר מכיל `node_modules/` ו-`dist/`; אין צורך בשינוי.

## 2. מבנה קבצים
```text
index.html                  lang="he" dir="rtl", <title>סיימון</title>, viewport + theme-color #0A1628
src/
  main.tsx                  ייבוא גופני Heebo (400/600/700) ו-CSS, רינדור <App/> ב-StrictMode
  App.tsx                   App Shell: state של המסך הפעיל ('home' | 'about'), כותרת, תוכן, פס ניווט
  styles/
    tokens.css              CSS Variables: צבעים, טיפוגרפיה, ריווח, רדיוסים, צללים
    global.css              reset, body, פריסת ה-Shell, מניעת גלילה אופקית
  game/
    colors.ts               ארבעת הצבעים: id, שם עברי (aria-label), משתנה צבע, מיקום בגריד
  components/
    AppHeader.tsx (+.css)   כותרת המסך ("סיימון" בבית / "אודות" באודות) + קו הפרדה
    BottomNav.tsx (+.css)   שתי לשוניות "בית"/"אודות" עם אייקון מעל התווית
    icons.tsx               אייקוני SVG פשוטים: בית, i
    SimonBoard.tsx (+.css)  הלוח העגול (ADR-1)
    PrimaryButton.tsx (+.css)
  screens/
    HomeScreen.tsx (+.css)  חיווי שלב, לוח, אזור סטטוס, כפתור "התחל משחק"
    AboutScreen.tsx (+.css) כרטיס "על המשחק", כותרת היסטוריה, חיווי ריק
  test/
    setup.ts                ייבוא @testing-library/jest-dom
  App.test.tsx              בדיקות Render ו-Navigation
```
CSS לצד כל רכיב (קובץ `.css` רגיל שמיובא ברכיב). אין ספריית UI ואין Router.

## 3. App Shell וניווט
- `App` מחזיק `const [screen, setScreen] = useState<'home' | 'about'>('home')`. מעבר מסך = החלפת תצוגה בלבד, בלי שינוי URL ובלי טעינה מחדש.
- `App` נשאר הבעלים של ה-State גם בהמשך (ADR-2: `useGame` ייכנס ל-`App` ב-Milestone 2), ולכן המבנה כבר עכשיו: `App` → `AppHeader` + (`HomeScreen` | `AboutScreen`) + `BottomNav`.
- `BottomNav`: אלמנט `<nav aria-label="ניווט ראשי">` עם שני `<button>`; ללשונית הפעילה `aria-current="page"` ורקע Primary Blue. סדר ב-RTL: "בית" מימין, "אודות" משמאל (כמו בתמונות – יוצא טבעי מ-`dir="rtl"`).
- פריסה: עמודה אנכית בגובה `100dvh`, רוחב מקסימלי ~`480px` במרכז. הכותרת למעלה, התוכן באמצע (גולל אם צריך), פס הניווט קבוע בתחתית בתוך מיכל עם ריווח ו-`env(safe-area-inset-bottom)`.

## 4. מסך הבית (מצב "לפני תחילת משחק" בלבד)
לפי DESIGN §1.1 וה-Mockup "בית – התחלה":
1. כותרת **"סיימון"** (H1, 32px Bold, ממורכזת) וקו הפרדה דק בצבע Border.
2. חיווי **"שלב 1 מתוך 10"** – טקסט רגיל H3 (20px Semibold), לא Badge.
3. אזור סטטוס מתחת לחיווי השלב – במצב ההתחלה ריק (שומר מקום כדי שהפריסה לא תקפוץ ב-Milestone 2).
4. **לוח Simon** (ראה סעיף 5).
5. כפתור ראשי **"התחל משחק"** – כחול מלא, רחב, מעוגל, טקסט לבן 16px Semibold, צל רך. ב-Milestone 1 הלחיצה לא עושה כלום (אין handler), אבל הכפתור נראה פעיל.
- אין כפתורי הגדרות או מתג סאונד.
- הקשת הדקורטיבית העדינה ברקע שב-Mockups – אופציונלית, רק אם פשוטה (pseudo-element עם border בצבע Border ושקיפות). לא חובה.

## 5. לוח Simon (לפי ADR-1)
- מיכל עגול (`aspect-ratio: 1`, `border-radius: 50%`), רקע Charcoal `#0F0F0F`, מסגרת חיצונית עבה בגוון Border, צל רך.
- בתוכו CSS Grid 2×2 עם `gap` עבה (~10–12px) = פסי ההפרדה הכהים. **`direction: ltr`** על המיכל כדי שהסידור לא יתהפך.
- `src/game/colors.ts` מגדיר מקור אמת אחד:
  ```ts
  // Spatial layout is fixed and must not flip in RTL.
  export const COLORS = [
    { id: 'green',  label: 'ירוק',  area: 'tl' },
    { id: 'red',    label: 'אדום',  area: 'tr' },
    { id: 'yellow', label: 'צהוב',  area: 'bl' },
    { id: 'blue',   label: 'כחול',  area: 'br' },
  ] as const;
  ```
  ירוק למעלה משמאל, אדום למעלה מימין, צהוב למטה משמאל, כחול למטה מימין (ה-Mockups גוברים על ה-Wireframes, לפי DESIGN).
- כל רבע הוא `<button type="button" aria-label="ירוק">` וכו', עם `border-radius` גדול רק בפינה החיצונית (רבע עיגול). צבעים מ-tokens: `#00D26A`, `#FF3B30`, `#FFD600`, `#00A3FF`. אין טקסט גלוי על הרבעים (כמו ב-Mockups).
- דיסק מרכזי מוחלט (`position: absolute`, ~32% מהקוטר), רקע כהה (`#12213A`/Charcoal) עם טבעת Border, הכיתוב **"סיימון"**, `aria-hidden="true"` ו-`pointer-events: none`.
- גודל: `width: min(82vw, 340px)` ומוגבל גם לפי גובה המסך (`max-height`/`vh`) כך שהכול נכנס בטלפון אנכי בלי גלילה במסך הבית.
- מגע: `touch-action: manipulation`, `user-select: none`, `-webkit-tap-highlight-color: transparent`. ב-Milestone 1 אין handlers ואין Glow/עמעום – רק הכנת CSS בסיסית (מצבי Glow ייכנסו ב-Milestone 2).

## 6. מסך אודות
לפי DESIGN §1.2 וה-Wireframe "אודות" (ה-Wireframes קובעים תוכן → כותרת המסך "אודות"):
1. כותרת **"אודות"** באותו רכיב `AppHeader`.
2. כרטיס Surface (`#12213A`, גבול `#1E3556`, פינות מעוגלות) עם כותרת **"על המשחק"** (H2) ותוכן Body:
   - תיאור קצר: "סיימון הוא משחק זיכרון: המשחק מציג רצף של צבעים וצלילים, ועליך לחזור עליו."
   - הוראות (רשימה): "לחצו על "התחל משחק" וצפו ברצף." / "הקישו על הצבעים באותו סדר." / "בכל שלב נוסף צבע אחד לרצף." / "טעות אחת מסיימת את המשחק – נסו להגיע עד שלב 10!"
   - (ה-PRD משאיר את ניסוח ההוראות ליישום; הנוסח יתאים לחוקי ה-PRD בלבד.)
3. כותרת **"10 המשחקים האחרונים"** (H3).
4. חיווי ריק בכרטיס מאופק: **"עדיין אין משחקים שמורים."**
5. **אין** כפתור "מחק היסטוריה" (מוצג רק כשיש רשומות – Milestone 4).
- התוכן גולל בתוך אזור התוכן אם הוא ארוך; פס הניווט נשאר במקום.

## 7. שפה עיצובית (tokens.css)
- **צבעים:** green `#00D26A`, red `#FF3B30`, yellow `#FFD600`, blue `#00A3FF`, charcoal `#0F0F0F`, soft-gray `#E5E5E5`, white `#FFFFFF`, background `#0A1628`, surface `#12213A`, border `#1E3556`.
- **טיפוגרפיה:** `font-family: 'Heebo', Arial, sans-serif`; גדלים: H1 32/700, H2 24/700, H3 20/600, Body 16/400, Caption 14/400, Button 16/600. הגופן מיובא מ-`@fontsource/heebo` במשקלים 400/600/700 בלבד (ללא Google Fonts).
- **ריווח:** `8 / 12 / 16 / 24px` בלבד.
- **רדיוסים וצללים:** כפתורים מעוגלים מלא (pill), כרטיסים ~16px; צל רך לכפתור ולוח.
- Theme כהה בלבד (לפי ה-Mockups). טקסט ראשי לבן, טקסט משני Soft Gray.
- `html, body { overflow-x: hidden }` ובדיקה שאין רכיב רחב מה-Viewport.

## 8. בדיקות אוטומטיות (`src/App.test.tsx`, Vitest + RTL)
1. מסך הבית מוצג כברירת מחדל: כותרת "סיימון", הטקסט "שלב 1 מתוך 10", כפתור "התחל משחק".
2. ארבעה כפתורי לוח עם השמות "ירוק", "אדום", "צהוב", "כחול", ולכל אחד ה-`area` הנכון (בדיקה מול `data-area` או class).
3. לחיצה על "אודות" מציגה "על המשחק", "10 המשחקים האחרונים" ו-"עדיין אין משחקים שמורים"; לשונית "אודות" מסומנת `aria-current="page"`; כפתור "מחק היסטוריה" לא קיים.
4. לחיצה על "בית" מחזירה למסך הבית.
5. בפס הניווט יש בדיוק שתי לשוניות (אין מסך שלישי).
6. `document.documentElement` – `lang="he"` ו-`dir="rtl"` (בדיקה על `index.html` כקריאת קובץ, או בדיקה ידנית בדפדפן).

## 9. בדיקה עצמית בזמן הבנייה (לפני סימון 🟡)
- `npm run typecheck`, `npm run test`, `npm run build` – כולם עוברים.
- `npm run dev` ופתיחה בדפדפן המובנה בגודל Mobile (375×812) ובגודל קטן יותר (360×640):
  - השוואה ויזואלית ל-Mockup "בית – התחלה" ו"אודות": מיקום הצבעים, דיסק מרכזי, כפתור, פס ניווט.
  - מעבר בין המסכים בלי טעינה מחדש (בדיקה שה-URL ונתוני Network לא משתנים).
  - אין גלילה אופקית (`document.documentElement.scrollWidth <= innerWidth`).
  - כל הטקסטים בעברית ומיושרים ימינה.
- סגירת שרת הפיתוח בסיום.
- עדכון `CLAUDE.md` – סעיף "פקודות הרצה": `npm run dev` (כתובת `http://localhost:5173/simon/`) ו-`npm run test`.
- סימון 🟡 ליד כותרת Milestone 1 ב-`MILESTONES.md`. בלי commit.

## 10. מחוץ לתכולה ב-Milestone הזה
לוגיקת משחק, `useReducer`, הארה/Glow בזמן ריצה, Web Audio, קונפטי, Overlays של ניצחון/הפסד, השהיה, `localStorage`, Dialog מחיקה, PWA/Manifest/אייקונים, GitHub Actions.

## 11. מיפוי ל-Definition of Done
| תנאי | איך נבדק |
|---|---|
| Build ו-typecheck עוברים; בדיקת Render/Navigation עוברת | סעיפים 8 ו-9 |
| שני המסכים נפתחים, מעבר בלי רענון, אין מסך שלישי | בדיקות 3–5 + בדיקה בדפדפן |
| ארבעת האזורים במיקום הנכון, חיווי שלב, "התחל משחק"; אודות עם הסבר והודעת היסטוריה ריקה | בדיקות 1–3 + השוואה ל-Mockup |
| עברית, RTL, נוח ב-Smartphone אנכי, בלי גלילה אופקית | `index.html` + בדיקה ב-375/360px |
| בלי יכולות מחוץ ל-PRD, בלי Backend/Database | סקירת קבצים ו-Dependencies (סעיף 1, 10) |
