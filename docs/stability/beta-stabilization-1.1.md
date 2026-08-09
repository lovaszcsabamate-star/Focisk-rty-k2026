# Beta Stabilization 1.1 – Real Device QA & Release Hardening

Dátum: 2026-08-08

## Cél és scope

Ez a kör nem ad új nagy funkciót a Fociskártyák 2026-hoz. A cél a jelenlegi web/PWA/standalone/Android kiadás regressziós lezárása, különös tekintettel a mentésre, lifecycle-ra, Torna módra, Tournament Lineup 1.1-re, Tournament Statistics 1.0-ra és a `📏 Magasabb játékos` kategóriára.

A stabilizáció elve: **hibakeresés → reprodukció → minimális javítás → regressziós teszt → teljes release gate**.

## Kiindulási állapot

- Repository: `lovaszcsabamate-star/Focisk-rty-k2026`
- Kiindulási `main` SHA: `f4871fe028d6b2c9883506f8d2cb699fa0d99595`
- A kiindulási commit üzenete: `Önálló build, vizuális előnézetek és audit frissítése [skip ci]`
- Alkalmazásverzió: `1.2.0`
- Storage schema: `1`
- Saved match schema: `2`
- Stabilizációs ág: `fix/beta-stabilization-1-1`

A kiinduláskor nem volt nyitott pull request.

### Releváns, már beolvasztott PR-ek

- #152 – Visual Polish 1.0
- #153 – Torna UI Cleanup + Tournament Statistics 1.0
- #154 – Player Data Expansion – Height 1.0 + `📏 Magasabb játékos`
- #155 – Tournament Lineup 1.0
- #156 – Tournament Lineup 1.1 – Matchday Experience

A #156 head commitján minden releváns korábbi release gate zöld volt, beleértve a Height, Torna, Quick Match, standalone/PWA és Android ellenőrzéseket. A #156 után a `main` kapott egy `[skip ci]` commitot, ezért az exact aktuális `main` állapothoz új, egységes Beta 1.1 release gate készült.

## Feltárt hibák és QA-rések

### BS11-01 – a tényleges `main` head nem futotta végig a teljes CI-t

**Tünet:** a #156 után érkező `f4871fe...` commit `[skip ci]` jelölést tartalmazott, ezért a release szempontjából tényleges kiindulási headhez nem tartozott friss, teljes Actions-bizonyíték.

**Reprodukció:** a `main` legfrissebb commitján nem volt kombinált CI-státusz, miközben a közvetlenül előtte lévő #156 headen a releváns workflow-k zöldek voltak.

**Root cause:** a post-merge standalone/preview/audit frissítő commit szándékosan kihagyta a CI-t.

**Javítás:** létrejött a `.github/workflows/beta-stabilization-1-1.yml`, amely egyetlen release gate-ben ismét lefuttatja a teljes web/PWA/mobile regressziót, a release-kritikus játékmeneti teszteket és az Android debug buildet.

**Regressziós védelem:** a workflow pull requesten, a stabilizációs ág pushain és manuálisan is indítható.

### BS11-02 – az első Android release-smoke hibásan megfogalmazott shell assertiont tartalmazott

**Tünet:** az első Beta 1.1 Android job az Android WebView asset smoke lépésnél shell parse hibával leállt, miközben a standalone build és a Capacitor `add/sync` már sikeresen elkészült.

**Reprodukció:** az idézőjeleket tartalmazó `grep` reguláris kifejezés `unexpected EOF while looking for matching quote` hibát okozott.

**Root cause:** CI tesztharness-hiba, nem alkalmazás-runtime hiba.

**Javítás:** az Android standalone bundle szerződésének ellenőrzése Python-alapú, idézőjelezéstől független vizsgálatra váltott. Az ellenőrzés a tényleges architektúrát követi: az APK egyetlen WebView-kompatibilis `index.html` bundle-t használ, külső `script src` és `type=module` nélkül.

**Regressziós védelem:** a Beta 1.1 Android job minden buildnél ellenőrzi a Height, Lineup 1.1 és Android startup markereket, majd `lintDebug` + `assembleDebug` fut.

### BS11-03 – a lineup release-határértékek nem mind voltak egy helyen explicit módon lefedve

**Tünet:** a meglévő tesztek erősen védték a 10/11, duplicate, foreign és deleted ID eseteket, de a Beta 1.1 követelmény 0/1/10/11/12 darabos határtesztet is kér.

**Root cause:** nem játékmotor-hiba, hanem regressziós coverage-rés.

**Javítás:** a `test/tournament-lineup-state.test.mjs` explicit ellenőrzi, hogy 0, 1, 10 és 12 játékos invalid, pontosan 11 különböző, érvényes játékos pedig valid.

**Regressziós védelem:** a teszt része a Beta 1.1 release gate-nek és a teljes projekt regressziónak.

## Ellenőrzött funkciók

### Quick Match

Ellenőrzési rétegek:

- dedikált Quick Match CI;
- teljes `npm test` / `npm run test:all`;
- Height 1.0 regresszió Quick Match oldalpárokkal;
- browser runtime smoke;
- 320/360/390/412/480 px mobil smoke.

Release-kritikus adatvédelmek: üres/hiányos attribute-adat esetén a kategória nem választható, a normalizált adatbázis 440 egyedi játékost és 464 szezonbeli klubregisztrációt tart meg.

### Classic

Ellenőrzött területek:

- játék- és pakliinicializálás;
- kategóriaelérhetőség;
- összehasonlítás és döntetlen;
- mentés/hidratálás;
- félbehagyott kör validálása;
- duplikált kártyaazonosító és hibás fázis elutasítása;
- standalone runtime.

### Penalties

Ellenőrzött területek:

- pontosan 11 fős csapatok;
- mentés és visszatöltés;
- Height kategória availability;
- Tournament Lineupból átadott büntetőrúgó-sorrend;
- rúgósorrend megtartása új ciklusban;
- tiebreak/finalization integráció.

### `📏 Magasabb játékos`

A release regresszió explicit ellenőrzi:

- 190 cm vs 185 cm → human;
- 178 cm vs 193 cm → AI;
- 184 cm vs 184 cm → döntetlen;
- hiányzó human height;
- hiányzó AI height;
- mindkét oldalon hiányzó height;
- invalid `0`, `235`, szöveges és nem egész érték;
- csak 140–220 cm közötti egész érték elfogadása;
- `0 cm`, `undefined` és `NaN` megjelenítés kizárása a normalizálási/formatting szerződéssel;
- Classic/Quick Match és Penalties availability;
- Tournament Statistics `heightCm` kategória-integráció.

### Tournament

A domain regresszió ellenőrzi:

- liga, csoport + kiesés és kieséses struktúra;
- Magyar Kupa 12 csapatos ág;
- AI mérkőzés-szimuláció;
- klasszikus és büntetős tiebreak;
- hiányzó match context;
- invalid result;
- azonos eredmény ismételt finalizálása;
- eltérő eredménnyel történő második finalizálási kísérlet;
- finalizationVersion/idempotencia;
- storage write failure esetén rollback/korábbi aktív állapot megtartása.

A központi `finalizeTournamentMatch()` mechanizmus nem lett újraírva.

### Tournament Lineup 1.1

Kötelező határtesztek:

- 0 játékos → invalid;
- 1 játékos → invalid;
- 10 játékos → invalid;
- 11 különböző, érvényes játékos → valid;
- 12 játékos → invalid;
- duplicate ID → invalid;
- foreign ID → invalid;
- deleted/stale ID → mentett keretből kiszűrve/invalid;
- Automatikus 11;
- Legutóbbi keret;
- Kedvenc keret;
- Mentés kedvencként;
- Alaphelyzet;
- penalty order;
- v1/v2 torna-lineup migráció.

A GK/DEF/MID/ATT eloszlás továbbra is tájékoztató, nem kötelező formáció.

### Tournament Statistics 1.0

A regresszió valós, strukturált duel snapshotokra épül, és ellenőrzi:

- meccs / win / draw / loss;
- eredménypontok és különbség;
- győzelmi arány;
- játékospárbajok és megnyert párbajok;
- kategóriahasználat;
- `heightCm`;
- penalty participation;
- azonos segment ismételt feldolgozásának idempotenciája;
- reload utáni determinisztikus újraszámítás.

### Mentés és visszaállítás

Automatizált ellenőrzés fedi:

- Klasszikus mentés/hidratálás;
- Penalties mentés/hidratálás;
- tournament state és pending-launch tranzakció;
- lineup last/favorite/by-match/penalty order;
- invalid JSON;
- ismeretlen save verzió;
- hibás fázis;
- hiányos vagy inkonzisztens kártyazónák;
- storage hiánya;
- storage read/write/remove exception;
- tournament write failure rollback.

Egy sérült klasszikus mentés nem kerül vakon a motorba: a validáció hibás mentésnél `null`/fallback eredményt ad, a tárolóhibák nem dobják el az egész alkalmazás futását.

### Lifecycle és Android back

Automatizált lifecycle teszt ellenőrzi:

- `visibilitychange` hidden → mentés;
- `pagehide` → mentés;
- runtime error/unhandled rejection → védett mentési kísérlet;
- idempotens event-listener telepítés;
- `popstate` history guard;
- korlátozott WebView/history API graceful fallback;
- mentési callback hibája nem okoz újabb uncaught exceptiont.

### PWA / offline

A service worker atomikus CORE cache-t használ. Az új cache csak akkor aktiválható, ha a teljes kötelező shell létrejött. Sikertelen install esetén a candidate cache törlődik, a korábbi aktív build marad használható.

Release gate:

- `npm run audit:pwa`;
- `npm run test:pwa-cache`;
- standalone build;
- runtime smoke.

### Mobil UI

A mobil phase smoke pontosan az alábbi viewport-szélességeken fut:

- 320 px;
- 360 px;
- 390 px;
- 412 px;
- 480 px.

Ellenőrzi többek között a horizontális dokumentum-overflow-t, a kiválasztási/battle fázisváltást, a kártyák és párbajterület láthatóságát. A meglévő Visual Polish/Lineup regressziók 44 px körüli fontos touch target guardokat is tartalmaznak.

## Beta 1.1 release gate

A `.github/workflows/beta-stabilization-1-1.yml` futtatja legalább:

- `npm ci`;
- magas súlyosságú production dependency audit (`npm audit --omit=dev --audit-level=high`);
- `git diff --check`;
- lint/syntax;
- `npm test`;
- `npm run test:all`;
- release-kritikus Height/Tournament/Lineup/Statistics/storage/lifecycle regressziók;
- accessibility;
- PWA audit + cache regresszió;
- production/standalone build;
- standalone runtime;
- browser runtime smoke;
- `mobile:prepare`;
- 320–480 px mobile layout smoke;
- Capacitor `add` + `sync`;
- Android WebView standalone bundle smoke;
- Gradle `lintDebug`;
- Gradle `assembleDebug`;
- APK SHA-256;
- APK artifact feltöltése.

Artifact neve: `Fociskartyak2026-Beta-Stabilization-1.1-debug-apk`.

## Manuális real-device checklist

A CI nem helyettesíti a fizikai Android-készüléket. A következő protokoll reprodukálhatóan végrehajtandó a release candidate APK-val.

### Fresh install

- [ ] Korábbi tesztverzió eltávolítása vagy tiszta tesztkészülék használata.
- [ ] `adb install Fociskartyak2026-Beta-Stabilization-1.1-debug.apk` sikeres.
- [ ] Első indítás hiba nélkül eljut a főmenüig.
- [ ] Profil/beállítás létrehozható.
- [ ] Quick Match elindítható.
- [ ] Classic elindítható.
- [ ] Penalties elindítható.
- [ ] Torna létrehozható és Meccsnapi keret megnyitható.

### App background

Minden fontos játékmódban legalább egyszer:

- [ ] Aktív mérkőzés közben Home/app switcher.
- [ ] 10–30 másodperc háttérben.
- [ ] Visszatérés után nincs indokolatlan új mérkőzés-inicializálás.
- [ ] Kör, score és kiválasztott/mentett állapot konzisztens.

### App kill / process death

- [ ] Aktív, menthető Classic állapot létrehozása.
- [ ] App force-stop/kilövés.
- [ ] Újraindítás után a folytatás elérhető és konzisztens.
- [ ] Aktív Torna létrehozása, lineup mentése.
- [ ] App kilövés és újraindítás után torna/lineup megmarad.

Javasolt ADB-próba: `adb shell am force-stop hu.fociskartyak.game2026`, majd az app kézi újraindítása.

### Android rendszer-vissza

- [ ] Főmenü – nincs véletlen dupla navigáció.
- [ ] Quick Match team/category selector – egy logikai szintet lép vissza.
- [ ] Classic aktív játék – nem törli a mentést.
- [ ] Penalties – nem inicializál új rúgósorrendet.
- [ ] Torna wizard – nem törli az aktív tornát.
- [ ] Torna center – konzisztens visszalépés.
- [ ] Lineup – vissza a Torna centerbe, nincs dupla overlay.
- [ ] Statisztika/bracket – nincs váratlan appbezárás.

### Update install

- [ ] Egy korábbi APK-val hozz létre profilt, beállítást, mentett játékot, kedvenc lineupot és aktív tornát.
- [ ] Telepítsd rá az új APK-t: `adb install -r Fociskartyak2026-Beta-Stabilization-1.1-debug.apk`.
- [ ] Profil megmarad.
- [ ] Beállítások megmaradnak.
- [ ] Mentett Classic/Penalties állapot olvasható vagy biztonságosan elutasított, ha valóban inkompatibilis.
- [ ] Kedvenc lineup megmarad.
- [ ] Aktív torna megmarad.
- [ ] Tournament Statistics nem duplázódik reload/update után.

### Offline / PWA fizikai ellenőrzés

- [ ] Első online megnyitás és teljes betöltés.
- [ ] PWA telepítés.
- [ ] App/PWA bezárása.
- [ ] Repülő mód / Wi-Fi és mobilnet kikapcsolása.
- [ ] Újraindítás után főmenü betölt.
- [ ] Játékosadatbázis elérhető.
- [ ] Classic működik.
- [ ] Quick Match működik.
- [ ] Penalties működik.
- [ ] Torna + lineup működik.
- [ ] CSS/ikonok nem esnek szét.

## Ismert fennmaradó korlátozások

1. **A fizikai real-device checklistet GitHub Actions nem tudja tényleges készüléken végrehajtani.** A fenti lista dokumentált release-protokoll; a CI WebView/standalone/lifecycle smoke helyettesítő automatizált védelmet ad, de nem állítja, hogy kézi készülékteszt megtörtént.
2. A build asset audit jelenleg figyelmeztet néhány történeti federation/pub asset licencnyilvántartási állapotára, de 0 asset-audit hibát ad; a kiadási útvonal jogtiszta placeholder/CSS fallbackeket használ. Ezt külön jogi/asset hygiene körben érdemes tovább tisztítani, nem játékmeneti release-blocker.
3. A GK/DEF/MID/ATT lineup-megoszlás tájékoztató; nincs kötelező formáció, és ismeretlen pozícióból nem készül kitalált besorolás.
4. A Height adatbázis továbbra sem 100%-os; hiányzó magasság nem válik `0 cm`-mé és nem használható tisztességtelen automatikus vereségként.
5. A debug APK fejlesztői/QA artifact; store release signing és production distribution külön release-lépés.

## Release decision szabály

**READY FOR RELEASE CANDIDATE** csak akkor adható, ha a PR aktuális head commitján:

- a Beta Stabilization 1.1 release gate zöld;
- a releváns projekt/Quick Match/Android workflow-k nem mutatnak release-blockert;
- a production high-severity dependency gate zöld;
- az APK artifact elkészül;
- az APK SHA-256 rögzítve van;
- nincs ismert adatvesztés, runtime exception, torna-finalizáció duplázás, lineup vagy Height regresszió.

A PR nem merge-elhető automatikusan; merge csak külön review/döntés után történhet.
