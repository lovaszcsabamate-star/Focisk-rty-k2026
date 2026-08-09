# Tournament Experience 2.0 – Visual Redesign & Flow Cleanup

Dátum: 2026-08-09

## Release státusz

**READY FOR REVIEW / STACKED RELEASE CANDIDATE**

A fejlesztés a `feat/tournament-experience-2` ágon készült, stackelt PR-ként a #160 (`Duel Visual Polish + Kickoff Countdown 1.0`) fölött. Ennek oka, hogy a Torna Matchday a #160-ban elkészült kickoff kaput használja. A PR-t nem szabad automatikusan merge-elni.

## Audit összefoglaló

A fejlesztés teljes Torna UX/vizuális audittal indult. Részletes audit:

`docs/ux/tournament-experience-2-audit.md`

A legfontosabb megállapítás az volt, hogy a Torna módnak nem elsősorban új funkciókra volt szüksége: a repositoryban már létezett a Tournament Experience v2/v3 wizard/runtime, nagy kupaválasztó, csapat-carousel, mobil bracket és Matchday réteg. A fő probléma a sok egymásra rakódó prezentációs réteg, az ismétlődő információ és az azonos vizuális súlyú elemek voltak.

### Feltárt fő problémák

- a legacy Torna UI és a v2/v3 élményréteg több helyen egyszerre formázta ugyanazt a képernyőt;
- a csapatválasztó a nagy hero mellett egy második mini-klubfalat is megjelenített;
- a futó torna centerben a v2 státuszsáv mellett megmaradt a legacy fejléc és progress információ;
- a következő mérkőzés nem volt elég erős vizuális középpont;
- a Torna UI saját 12-klubos presentation mappinget tartott fenn a központi `branding.js` mellett;
- kisebb mobilokon túl sok metaelem és navigáció versenyzett a figyelemért.

## Előtte → utána flow

### Tornaindítás

**Előtte:**

`hely/preset + több opció → csapat hero + mini klubfal + random → további beállítások → indítás`

**Utána:**

`Kupa/hely → nagy csapat-carousel → [Saját torna: beállítások] → indítás`

A progressive disclosure elv megmaradt, de a vizuális zaj csökkent. Egy képernyő egy fő döntést támogat.

### Futó torna

**Előtte:**

`legacy fejléc + progress + v2 státusz + következő meccs + tabok + egyéb műveletek`

**Utána:**

`kompakt státuszsáv → következő mérkőzés hero → MÉRKŐZÉS CTA → másodlagos tabok → További lehetőségek`

### Mérkőzés után

**Előtte:**

`eredmény → fordulóinformáció → visszatérés`

**Utána:**

`Mérkőzés vége → eredmény → Hatása a tornára → következő szakasz/ellenfél → tovább a tornához`

### Tornazárás

A completion képernyő nagyobb vizuális súlyt kapott, miközben a domain logika változatlan maradt.

## Módosított komponensek

### `js/tournament/tournament-ui-improvement.js`

A korábbi polish modul Tournament Experience 2.0 prezentációs réteggé alakult.

Fő változások:

- `TOURNAMENT_UI_IMPROVEMENT_VERSION = 2`;
- központi `branding.js` import;
- megszűnt a külön `TOURNAMENT_UI_CLUB_PRESENTATION` mapping;
- a normál csapatválasztón a mini-klubfal rejtett;
- a nagy klub-carousel és generált embléma kapja a fókuszt;
- kupatípusonként visszafogott vizuális tónus;
- legacy center heading/progress eltávolítása;
- nagy next-match hero;
- egyetlen domináns `▶ MÉRKŐZÉS` CTA;
- kompakt tabella;
- mobilon egyfordulós bracket fókusz;
- explicit `Hatása a tornára` eredményblokk;
- completion hero;
- reduced-motion és forced-colors támogatás.

### `test/tournament-ui-improvement.test.mjs`

Új 2.0-s prezentációs szerződések:

- központi klubbranding mind a 12 NB I klubhoz;
- ismeretlen/válogatott fallback;
- nincs külön Torna klubpaletta;
- mini klubfal nem térhet vissza normál csapatválasztóként;
- next-match hero / `MÉRKŐZÉS` CTA;
- `Hatása a tornára` marker;
- mobil, reduced-motion és forced-colors szerződés;
- nincs távoli asset URL;
- standalone/PWA bekötés megmarad.

### `.github/workflows/tournament-experience-2.yml`

Külön release gate készült web/PWA/mobil és Android ágakkal.

### Dokumentáció

- `docs/ux/tournament-experience-2-audit.md`
- `docs/ux/tournament-experience-2.md`

## Új vizuális elemek

Nem készült új külső asset és nem került be CDN-függőség.

A fejlesztés újrahasználja:

- a meglévő, jogtiszta generált kupaélményt;
- a központi klubbrandinget;
- a Tournament Lineup / Matchday vizuált;
- a #160 kickoffot (`3 → 2 → 1 → Hajrá! → síp`).

## Mobil QA

A Tournament mobil smoke a következő viewportokon futott:

| Viewport | Horizontális overflow | Fő CTA | Fő érintési célok |
|---|---:|---:|---:|
| 320×568 | 0 px | 46 px | ≥44 px |
| 360×800 | 0 px | 46 px | ≥44 px |
| 390×844 | 0 px | 46 px | ≥44 px |
| 412×915 | 0 px | 46 px | ≥44 px |
| 480×900 | 0 px | 46 px | ≥44 px |

A kupa- és csapatválasztó mind az öt szélességen működött, generált klubjelzéssel is.

## Teszteredmények

Első teljes, implementációs release gate:

**GitHub Actions run: `31322112577`**

### `web-pwa-mobile`

**SUCCESS**

Sikeres ellenőrzések:

- syntax + célzott Tournament Experience 2.0 contract;
- Tournament Cup Experience;
- Tournament Statistics;
- Tournament domain;
- Tournament Lineup state/UI/Matchday;
- Tournament match liveness stressz;
- round freeze recovery;
- result controller;
- Session Recovery;
- round-operation liveness;
- Quick Match/deck selection safety;
- asset audit;
- PWA audit/cache;
- accessibility;
- teljes `npm test`;
- production build;
- standalone build/runtime;
- Tournament Experience standalone markerek;
- valós Chrome runtime;
- Tournament mobil smoke;
- általános mobil layout/runtime.

A nagy Tournament liveness teszt eredménye:

- 660 automatizált mérkőzés;
- 9562 state transition;
- 132 height duel.

### `android-debug-apk`

**SUCCESS**

Sikeresen lefutott:

- mobil webbundle;
- Capacitor Android projekt;
- WebView bundle sync;
- Tournament Experience 2.0 marker contract;
- appikon;
- Android `lintDebug`;
- Android `assembleDebug`;
- debug APK + SHA-256 artifact.

Gradle eredmény:

`BUILD SUCCESSFUL` – 132 végrehajtott task.

APK artifact:

- név: `Fociskartyak2026-Tournament-Experience-2-debug-apk`;
- artifact ID: `9040496493`;
- artifact ZIP méret: 4 930 063 byte;
- artifact digest: `sha256:f4ea8a29d025030a613d1965ce58ce33fab25cec086e44bd78c45035a129a4e5`.

## Meglévő figyelmeztetések / ismert korlátozások

### Asset audit

A buildben 9 korábban is létező asset-figyelmeztetés maradt, **0 asset hiba** mellett. Ezek nem a Tournament Experience 2.0 által hozzáadott fájlokból erednek. Ebben a fejlesztési körben új vizuális asset nem került be.

### NPM dependency audit

Az `npm ci` jelenleg 2 dependency audit találatot jelez:

- 1 moderate;
- 1 high.

A release gate ettől függetlenül sikeres. Ezek kezelése külön dependency-hardening körbe való; a Tournament Experience 2.0 során nem történt függőségfrissítés, hogy a UI-fejlesztés ne változtassa meg indokolatlanul a technikai alapot.

### Legacy Torna mapping

Az aktív Tournament Experience UI saját duplikált klubmappingje megszűnt és a központi brandinget használja. A legacy `tournament-mode.js` történeti fallback rétegének teljes eltávolítása ebben a körben nem cél, mert az már domain/fallback refaktor kockázatát hordozná. Ezt csak külön regressziós refaktorban érdemes lezárni.

### Screenshot baseline

A repository meglévő valós Chrome és mobil smoke infrastruktúráját használtuk. Külön pixel-diff vizuális baseline rendszert nem vezettünk be ebben a körben.

## Nem változott

- Tournament domain és továbbjutási szabályok;
- Classic / Penalties szabályok;
- pontozás;
- AI döntési algoritmus;
- játékosadatok és Height 1.0;
- Session Recovery mentési séma;
- Quick Match adatmodell;
- Tournament Lineup / Matchday state;
- kickoff state machine.

## Következő lehetséges finomhangolások

1. valódi Android készülékes QA a Torna teljes flow-jára;
2. külön vizuális screenshot baseline, ha a későbbi UI-változások száma indokolja;
3. legacy Torna presentation fallbackek külön refaktorja;
4. opcionális, nagyon rövid forduló-/tornagyőzelem animációk real-device ellenőrzés után;
5. dependency-hardening külön, funkciófüggetlen fejlesztési körben.

## Merge-stratégia

1. #160 külön review és kézi merge a `main`-be;
2. #161 retarget `main`-re;
3. teljes Tournament Experience 2.0 release gate újrafuttatása a végleges `main` alapon;
4. csak zöld végső CI és real-device QA után kézi merge.

**Automatikus merge nincs.**
