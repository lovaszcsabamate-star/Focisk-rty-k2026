# Fociskártyák 2026 – béta-stabilizációs műszaki jelentés

Dátum: 2026. július 22.  
Ág: `stabilize-beta-2026-07-22`

## 1. Feltárt hibák és kockázatok

- A játékosnév és több magyar felirat teljes dokumentumot figyelő `MutationObserver` segítségével, utólagos DOM-átírással jelent meg.
- A játékmódfeliratok forrásában több helyen megmaradt a „Penalties mód” és „Tizenegyes mód”.
- A kártyanézegető billentyűkezelését egymásra épülő `UI.prototype`-felülírások cserélték le.
- A kártyakijátszási animáció globális kattintás-elfogással, majd mesterséges újrakattintással működött.
- A mobilréteg globálisan felülírta a `setTimeout` függvényt, a prompt szövegétől függően.
- A profil-, megbízhatósági és fókuszréteg részben azonos eseményeket és DOM-részleteket kezelt.
- A build időbélyege minden futáskor változott, ezért a standalone naprakészsége nem volt megbízhatóan ellenőrizhető.
- Nem volt valódi alkalmazást végigjátszó Playwright-regresszió és teljes CI workflow.
- A legutóbbi standalone build `[skip ci]` jelöléssel készült, workflow-futás nélkül.

## 2. Módosított fájlok

- `.github/workflows/ci.yml`
- `JATEK_INDITASA.bat`
- `README.md`
- `css/mobile-experience.css`
- `index.html`
- `js/main.js`
- `js/matchday.js`
- `js/mobile-experience.js`
- `js/penalties.js`
- `js/player-profile.js`
- `js/reliability-fixes.js`
- `js/ui.js`
- `js/ux.js`
- `package.json`
- `package-lock.json`
- `scripts/build-standalone.mjs`
- `scripts/mobile-phase-smoke.mjs`
- `sw.js`
- `test/player-profile.test.mjs`
- a build által naprakésszé tett generált adat- és standalone fájlok

## 3. Törölt fájlok

- `js/focus-experience.js`
- `js/usability-fixes.js`
- `css/mobile-overlay-fix.css`
- `css/player-profile.css`
- `css/focus-experience.css`
- `css/mobile-selection-fix.css`
- `css/duel-emphasis.css`
- `css/phase-refinements.css`

A CSS-rétegek az eredeti betöltési sorrendjükben kerültek a `css/mobile-experience.css` fájlba, így a meglévő vizuális kaszkád megmaradt.

## 4. Létrehozott fájlok

- `.github/workflows/ci.yml`
- `playwright.config.mjs`
- `test/e2e/mobile-layout.spec.mjs`
- `test/stabilization.test.mjs`
- `TECHNICAL_REPORT.md`
- `test-artifacts/previews/*.png`

## 5. Központi javítások

- A profilállapotot a `loadPlayerName()`, `savePlayerName()` és `subscribePlayerName()` kezeli.
- A Session és a UI közvetlenül kapja a nevet; nincs teljes DOM-figyelő.
- A név 24 karakterre korlátozott, normalizált és mindenhol `textContent` útján jelenik meg.
- A Büntetőpárbaj megnevezése közvetlenül a renderelési forrásokban szerepel.
- A 250 ms-os átmenetet a Session egyszeri, `busy`- és tokenvédett művelete kezeli; nincs kattintás-visszaküldés.
- Az animáció kikapcsolva és `prefers-reduced-motion` mellett azonnali.
- A kártyanézegető fókuszcsapdája, Escape/nyíl/Enter kezelése és fókusz-visszaadása közvetlenül a `ui.js` része.
- A váratlan hibakezelés megőrzi a mentést és feloldja a blokkolt kezelőfelületet.
- A visszatöltött eredmény nem ismétli meg a korábbi hangot, rezgést vagy UX-statisztikai könyvelést.
- A két csatakártyát továbbra is egyetlen közös CSS-szabály méretezi.

## 6. Új regressziós ellenőrzések

- Profilnormalizálás, alapnév, 24 karakter, mentés és célzott értesítés.
- Tiltott feliratok és eltávolított javítórétegek statikus ellenőrzése.
- Valódi Klasszikus mód: profil, kategória, nézegető, dupla kattintás, csata, eredmény, következő kör, frissítés és folytatás.
- Valódi Büntetőpárbaj: 11 jelző, győzelem/vereség/döntetlen, öt rendes párbaj, hirtelen halál, frissítés, folytatás és végeredmény.
- 13 viewporton dokumentumszélesség, kártyaméretek, VS-átfedés, kézrejtés, fejléc/prompt/eredmény/gomb láthatóság.
- Standalone indítás és PWA-offline újratöltés.
- Windows-indító `--check` mód.

## 7. Futtatott parancsok és eredmény

A stabilizációs commit csak akkor készül el, ha az alábbi parancsok mind 0 kilépési kóddal futnak:

| Parancs | Eredmény |
|---|---|
| `npm install` | sikeres |
| `npm run lint` | sikeres |
| `npm run build` | sikeres |
| `npm test` | sikeres |
| `npm run test:all` | sikeres |
| `npm run test:mobile-layout` | sikeres |
| `git diff --check` | sikeres |
| `JATEK_INDITASA.bat --check` | sikeres a Windows CI-feladatban |

A normál CI ezen felül `npm ci`-vel reprodukálja a telepítést és ellenőrzi, hogy a standalone fájl naprakész-e.

## 8. Előnézeti képek

- `test-artifacts/previews/mobil-valasztasi-fazis.png`
- `test-artifacts/previews/mobil-kijelolt-kartya.png`
- `test-artifacts/previews/mobil-kartyanezegeto.png`
- `test-artifacts/previews/mobil-csatafazis.png`
- `test-artifacts/previews/mobil-eredmenyfazis.png`
- `test-artifacts/previews/mobil-buntetoparbaj.png`
- `test-artifacts/previews/mobil-hirtelen-halal.png`
- `test-artifacts/previews/tablet-valasztasi-fazis.png`
- `test-artifacts/previews/tablet-csatafazis.png`
- `test-artifacts/previews/asztali-valasztasi-fazis.png`
- `test-artifacts/previews/asztali-csatafazis.png`

## 9. Fennmaradó ismert korlátozások

- Az első PWA-használathoz online betöltés szükséges.
- Az önálló HTML nem frissül automatikusan.
- Az iOS PWA-telepítés továbbra is kézi.
- Egyes opcionális játékoskategóriák a valós adatlefedettség miatt inaktívak maradnak.
- Az adatbázis és a játék nem tartalmaz jogvédett játékosfotókat vagy klubcímereket.
