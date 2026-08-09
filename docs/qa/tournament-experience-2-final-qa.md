# Tournament Experience 2.0 – Final QA, Regression Audit & Corrective Fixes

Dátum: 2026-08-09

## Végső verdict

**READY FOR REAL DEVICE QA**

Az automatizált web/PWA/standalone/mobil/Android ellenőrzés a javításokat tartalmazó kód-headen teljesen zöld. Fizikai Android készülékes kézi QA ebben a környezetben nem végezhető hitelesen, ezért a release candidate előtti következő kapu a real-device teszt.

## 1. GitHub állapot a QA kezdetén

A vizsgálat elején frissen ellenőrzött állapot:

- `main`: `9468220c64136987f37562b6ad877e889c594ee9`;
- PR #160 – Duel Visual Polish + Kickoff Countdown 1.0:
  - OPEN;
  - mergeable;
  - nincs merge-elve;
  - base: `main`;
  - head: `feat/duel-visual-kickoff-countdown-1`;
  - head SHA: `efe33ac5ade99ee434d42cddbe25a6318e9abb68`;
  - a branch a `main`-hez képest diverged állapotban volt: 16 commit előny / 2 commit lemaradás;
- PR #161 – Tournament Experience 2.0:
  - OPEN;
  - mergeable;
  - nincs merge-elve;
  - base: `feat/duel-visual-kickoff-countdown-1`;
  - a stackelés indokolt, mert a Tournament Matchday a #160 kickoff rétegére épül.

Automatikus merge nem történt.

## 2. Ellenőrzött területek

A QA az alábbiakat fedte le:

- Tornaindítás és kupaválasztó;
- Magyar Bajnokság;
- Magyar Kupa domain/regresszió;
- nemzetközi preset/domain szerződés;
- saját torna wizard/domain szerződés;
- csapatválasztás és központi branding;
- Tournament center;
- tabella;
- mobil bracket;
- Tournament Lineup state/UI;
- Matchday;
- kickoff integráció;
- mérkőzés- és eredményvezérlő;
- Tournament staging/rollback;
- Session Recovery;
- rapid interactionhoz kapcsolódó operation/busy/staging védelem;
- accessibility;
- PWA/offline shell;
- standalone build/runtime;
- 320/360/390/412/480 px valós Chrome mobil-flow;
- Android WebView bundle;
- Android `lintDebug` és `assembleDebug`.

## 3. Bizonyított hibák és javítások

### Hiba 1 – Kritikus tabellaadatok eltűntek mobilon

**Súlyosság:** közepes / release előtt javítandó UX-hiba.

**Reprodukció:** 520 px alatti viewporton Magyar Bajnokság → Torna központ → Tabella.

**Ok:** a Tournament Experience kompatibilitási CSS a 4–8. oszlopokat elrejtette. A tényleges oszlopok:

`# | Csapat | M | GY | D | V | +/− | P`

Ezért mobilon eltűnt a GY, D, V, gólkülönbség és a pontszám.

**Javítás:** két soros, kompakt mobil grid. Mind a 8 adat látható marad, rövid mobilcímkékkel (`M`, `GY`, `D`, `V`, `+/−`, `P`).

**Regresszióvédelem:** `test/tournament-ui-improvement.test.mjs` tiltja a régi nth-child elrejtést és megköveteli a teljes mobil grid szerződést.

### Hiba 2 – Öngerjesztő Tournament center MutationObserver frissítés

**Súlyosság:** magas / potenciális UI-freeze és CPU-terhelés.

**Reprodukció:** Tournament center megnyitása a Tournament Experience 2.0 vizuális observerével.

**Ok:** a polish réteg minden observer-frissítéskor feltétel nélkül újra beállította az `Áttekintés` gomb `textContent` értékét. A `MutationObserver` `childList` változásokat figyel, így az írás újabb refresh-t generálhatott.

**Javítás:** a felirat csak akkor íródik át, ha ténylegesen eltér az `Áttekintés` szövegtől.

**Regresszióvédelem:** a célzott teszt megköveteli az idempotens feltételt, és tiltja a régi feltétel nélküli textContent-írást.

### Hiba 3 – Standalone Torna center runtime ReferenceError

**Súlyosság:** magas / standalone és ebből készülő mobil WebView működési hiba.

**Reprodukció:** standalone buildben Tournament center elérése, ahol a rapid Tournament UI `TOURNAMENT_STATUS` és kapcsolódó domain értékeket használ.

**Ok:** a `scripts/postprocess-standalone.mjs` modul-flattenelése eltávolította a `tournament-rapid-upgrade.js` ESM importjait, de a rapid modul nem kapta vissza explicit módon a szükséges Tournament domain függőségeket. Valós runtime hiba: `ReferenceError: TOURNAMENT_STATUS is not defined`.

**Javítás:** a meglévő standalone Tournament flow bridge kibővült `TOURNAMENT_MATCH_STATUS` értékkel, a rapid modul pedig explicit `rapidTournamentDependencies` hidat kap a flattenelt kód elé. Nem készült új globális domainrendszer.

**Regresszióvédelem:** build-time és célzott teszt ellenőrzi a rapid dependency bridge meglétét és tényleges beillesztését.

### Hiba 4 – Legacy 590 px minimumszélesség miatt mobil tabella belső overflow

**Súlyosság:** közepes / mobil használhatósági regresszió.

**Reprodukció:** 320–480 px szélességen Magyar Bajnokság → Torna központ → Tabella.

**Ok:** a legacy `css/tournament-mode.css` `.tournament-table` szabálya `min-width:590px` értéket tartott fenn. Az új kompakt grid ezért is belső vízszintes görgetést kényszerített.

**Javítás:** kizárólag a Tournament Experience 2.0 mobil center scope-jában a tabella `min-width:0!important`, a wrapper `min-width:0; overflow-x:visible` értéket kapott. A desktop legacy viselkedés változatlan maradt.

**Regresszióvédelem:** statikus CSS-szerződés és valós Chrome mérés ellenőrzi, hogy nincs belső table overflow.

## 4. Tesztinfrastruktúra-korrekció

A bővített mobil smoke első verziójában a helyszíngombok méretét olyan DOM-node-okon mérte a teszt, amelyeket a Magyar Bajnokság kiválasztásakor történő újrarender már leválasztott a dokumentumról. Ez 0 px magasságú hamis hibajelzést okozott.

Ez **nem termékhiba** volt.

A teszt most a rerender után újra lekéri a `.tx-cup-locations button` elemeket, és csak az élő node-okat méri.

## 5. Vizsgált, de nem javítandó terület

### Tournament staging / rollback

A QA során felmerült a félkész Tournament launch state kockázata, de az ellenőrzés igazolta, hogy a meglévő rendszer már használ:

- pending-launch tranzakciót;
- transactional staginget;
- sikertelen Quick Match/Tournament handoff rollbacket;
- Session Recovery reconciliációt.

Kapcsolódó regressziós tesztek zöldek, ezért domain-refaktor nem indokolt.

## 6. Kibővített valós mobil QA

A `scripts/tournament-ui-mobile-smoke.mjs` már nem csak a kupa- és csapatválasztót méri, hanem végigjárja:

`Magyar Bajnokság → Puskás Akadémia FC → tornaindítás → Torna központ → Tabella`

Viewportok:

- 320 px;
- 360 px;
- 390 px;
- 412 px;
- 480 px.

Minden viewporton ellenőrzi:

- Magyar Bajnokság explicit kiválasztását;
- PAFC csapatnév és generált klubjel egyezését;
- mini-klubfal rejtettségét;
- elsődleges touch targeteket;
- Torna center megjelenését;
- Tabella megnyithatóságát;
- 8/8 cella meglétét;
- 8/8 cella láthatóságát;
- pontszám láthatóságát;
- belső tabella-overflow hiányát;
- pontosan egy `MÉRKŐZÉS` CTA-t;
- runtime hibák hiányát.

Eredmény a javításokat tartalmazó kód-headen:

**PASS – 320/360/390/412/480 px, 8/8 tabellaadat, nincs overflow, egy MÉRKŐZÉS CTA.**

Az általános mobil layout smoke is 0 px dokumentum-overflow-t mért mind az öt szélességen.

## 7. Automatizált regresszió

A javításokat tartalmazó kód-head release gate-je:

**GitHub Actions run: `31324151753`**

Head:

`1c53a62b18944e56e06c2a92d605677ba1aff358`

### Web/PWA/mobil

`web-pwa-mobile`: **SUCCESS**

Sikeres:

- Tournament Experience 2.0 focused contract;
- Tournament Cup Experience;
- Tournament Statistics;
- Tournament domain;
- Tournament Lineup state/UI/Matchday;
- result controller;
- round freeze recovery;
- Session Recovery;
- round-operation liveness;
- Quick Match / deck selection safety;
- asset audit;
- PWA shell/cache;
- accessibility;
- teljes `npm test`;
- production build;
- standalone build/runtime;
- standalone Tournament Experience markers;
- Classic és Penalties valós Chrome runtime;
- kibővített Tournament full mobile flow;
- általános mobil layout/selection/phase smoke.

### Stresszteszt

- 330 Classic Tournament mérkőzés;
- 330 Penalties Tournament mérkőzés;
- összesen 660 mérkőzés;
- 9562 automatikus state transition;
- 132 `Magasabb játékos` párbaj;
- nincs végtelen loop vagy beragadt mérkőzés.

### Android

`android-debug-apk`: **SUCCESS**

Sikeres:

- mobil webbundle;
- Capacitor Android projekt;
- WebView sync;
- Tournament Experience marker contract;
- appikon;
- `lintDebug`;
- `assembleDebug`;
- APK + SHA-256 artifact.

Artifact a javításokat tartalmazó kód-headhez:

- név: `Fociskartyak2026-Tournament-Experience-2-debug-apk`;
- artifact ID: `9041067641`;
- méret: `4 931 033` byte;
- digest: `sha256:feeed484f4e5868987ace211922d4608710488b60b2e90387f09bd8edb2f8ae5`.

## 8. Módosított fájlok a Final QA során

- `js/tournament-experience-v2.js`
  - teljes mobil tabella;
- `js/tournament/tournament-ui-improvement.js`
  - idempotens center polish;
  - legacy 590 px minimum feloldása mobil scope-ban;
- `scripts/postprocess-standalone.mjs`
  - rapid Tournament domain dependency bridge;
- `scripts/tournament-ui-mobile-smoke.mjs`
  - teljes Magyar Bajnokság → center → Tabella valós Chrome QA;
- `test/tournament-ui-improvement.test.mjs`
  - új regressziós szerződések;
- `docs/qa/tournament-experience-2-final-qa.md`
  - jelen dokumentum.

## 9. Nem blokkoló, nem javított megfigyelések

### Asset audit

- 15 nyilvántartott asset;
- 18 fájl;
- 9 korábban is meglévő figyelmeztetés;
- **0 hiba**.

A warningok külön asset/legal cleanup körbe valók.

### NPM dependency audit

`npm ci` továbbra is jelez:

- 1 moderate;
- 1 high

dependency audit találatot. A Tournament QA alatt nem történt dependency-frissítés, mert ez külön hardening feladat és indokolatlanul növelné a UI/regressziós kör kockázatát.

### Legacy Tournament presentation fallback

A Tournament Experience 2.0 aktív UI-ja a központi brandinget használja. A `tournament-mode.js` történeti `TOURNAMENT_CLUB_PRESENTATION` fallbackje továbbra is létezik. Nem távolítottuk el, mert jelen QA nem bizonyította, hogy minden legacy/fallback útvonal biztonságosan nélkülözi.

### Branch-divergencia

A #160 a QA kezdetén a `main`-hez képest diverged volt. A biztonságos merge-sorrend továbbra is:

1. #160 friss ellenőrzése / szükség esetén main-szinkron;
2. #160 kézi merge;
3. #161 retarget `main`-re;
4. #161 teljes release gate újrafuttatása;
5. real-device QA;
6. csak utána kézi merge.

## 10. Mi nem változott

A Final QA javításai nem módosították:

- Tournament domain szabályokat;
- továbbjutást;
- pontozást;
- AI-t;
- Classic / Penalties szabályokat;
- játékosadatokat;
- Height 1.0 adatokat;
- Session Recovery mentési sémát;
- Quick Match adatmodellt;
- Tournament Lineup state-et;
- kickoff state machine-t.

## 11. Következő kapu – Real Device QA

Fizikai Android telefonon ellenőrizendő minimum:

- cold start;
- portrait és landscape;
- Magyar Bajnokság teljes indítása;
- mobil Tabella 8/8 adat;
- Magyar Kupa bracket;
- Lineup 10/11, 11/11, túl sok kijelölés;
- Matchday;
- `3 → 2 → 1 → Hajrá! → síp`;
- gyors dupla koppintás a `MÉRKŐZÉS` CTA-n;
- háttérbe küldés / visszatérés;
- process kill + újranyitás Tournament staging/meccs közben;
- mérkőzés eredménye → visszatérés a Torna központba;
- offline indulás, ha a PWA/WebView környezet ezt támogatja.

## Végkövetkeztetés

A Final QA **négy tényleges, javítást indokló regressziót** talált és javított:

1. mobilon eltűnő tabellaadatok;
2. Tournament center observer önfrissítési ciklus;
3. standalone rapid Tournament hiányzó domain-függőségei;
4. legacy 590 px minimum miatt kialakuló belső mobil tabella-overflow.

A javításokat tartalmazó kód-head teljes automatizált release gate-je zöld.

**Verdict: READY FOR REAL DEVICE QA**
