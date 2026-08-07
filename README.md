# Fociskártyák 2026

Magyar nyelvű, kocsmai hangulatú összehasonlító fociskártya-játék a 2025/26-os NB I **440 egyedi játékosból és 464 játékos–klub regisztrációból** álló, MLSZ-elsődleges adatbázisával. Böngészőben, offline PWA-ként, egyfájlos standalone változatban és Android tesztalkalmazásként is futtatható.

## Projektazonosítók

- Megjelenített név: **Fociskártyák 2026**
- NPM-csomagnév: `fociskartyak-2026`
- Verzió: **1.2.0**
- Android alkalmazásazonosító: `hu.fociskartyak.game2026`
- Önálló játékfájl: `Fociskartyak2026.html`
- Kanonikus repónév: `fociskartyak2026`

A GitHub technikai útvonal a korábbi hibás karakterátalakítás miatt jelenleg `Focisk-rty-k2026`. Az alkalmazáskód és a kiadási csomagok a kanonikus Fociskártyák-neveket használják.

## Letöltés és indítás

### Önálló játék

A `main` ág legfrissebb `Fociskartyak2026.html` fájlja közvetlenül megnyitható modern böngészőben, hálózati kiszolgáló nélkül is.

### Windows

Kattints duplán a `JATEK_INDITASA.bat` fájlra. Ez a standalone játékfájlt nyitja meg.

### Fejlesztői indítás

```bash
npm ci
npm start
```

Ezután nyisd meg a `http://localhost:8901` címet.

### Standalone build

```bash
npm run build:standalone
```

### Mobil webcsomag

```bash
npm run mobile:prepare
```

### Android

A `.github/workflows/android-apk.yml` workflow Node.js 22, Java 21 és Android 16 SDK használatával készít debug APK-t. A workflow mobil runtime smoke tesztet, teljes játéktesztet, mobil layout ellenőrzést és böngészős runtime smoke tesztet is futtat az APK fordítása előtt.

## Játékmódok

- **Klasszikus mód:** 20, 36 vagy 52 lapos mérkőzés; öt lapos kéz és felváltott kategóriaválasztás. A rövidebb formátumok a teljes pakli megőrzése mellett 10, illetve 18 párbaj után zárulnak.
- **Büntetőpárbaj:** 11–11 lap, öt rendes párbaj, döntetlennél hirtelen halál.
- **Gyors meccs:** klub-, liga-, válogatott- és föderációs csapatválasztás a meglévő játékoskártyákból, külön ellenfélválasztással és biztonságos indítási staginggel.
- **Torna mód:** Magyar bajnokság, Magyar Kupa és egyéb liga/kieséses/csoportkörös formátumok, menthető tornaállapottal és AI-mérkőzésszimulációval.

A pontos születési dátum az összehasonlításhoz használható; a kártyán csak a kerekített életkor jelenik meg. A számított játékospontszám nem látható és nem játékkategória.

## Beta release gate

A `main` ágra nyitott pull requestek központi ellenőrzése a `.github/workflows/validate-pull-request.yml` workflow. A Beta Stabilization 1.0-tól ez egy összevont release gate, amely többek között ellenőrzi:

```bash
npm ci
npm run lint
npm test
npm run test:all
npm run test:accessibility
npm run audit:pwa
npm run test:pwa-cache
npm run build
npm run build:standalone
npm run mobile:prepare
npm run test:mobile-layout
npm run test:runtime
```

Emellett külön regresszió védi a Gyors meccs automatikus indítását, a pakliválasztási tranzakciót, a Torna indítási tranzakciót, a Torna domain/kupaélményt és a mobil runtime-ot. Az Android APK továbbra is külön, teljes Android workflow-ban készül.

## Mentési és stabilitási elvek

- a játékindítás és a mentés-visszatöltés nem hagyhat félkész runtime-állapotot;
- hibás vagy inkompatibilis mentést a rendszer nem töröl automatikusan;
- a 20/36/52 lapos Klasszikus formátumoknál megmarad a teljes kártyakészlet invariánsa;
- hiányzó játékoskártyát tartalmazó mentés nem tölthető vissza csendben;
- a Torna és Gyors meccs indítási folyamatát külön tranzakciós regressziós tesztek védik;
- a PWA cache telepítése és frissítése automatikus audit alatt áll.

A kapcsolódó technikai feljegyzések a `docs/stability/` mappában találhatók.

## Adatbázis

Az alapadatmodell MLSZ-elsődleges. A kluboldali kiegészítések csak dokumentált, visszakövethető rétegként tölthetnek üres mezőket; bizonytalan vagy ellentmondó adat nem írhatja felül automatikusan az elsődleges forrást.

### Aktuális adatbázis-audit

A 2026-08-07-i normalizált audit szerint:

- játékoskártyák: **440**;
- játékos–klub regisztrációk: **464**;
- pontos születési dátum: **440/440**;
- nemzetiség: **440/440**;
- poszt: **440/440**;
- mérkőzésszám: **440/440**;
- kezdések: **440/440**;
- gólok: **440/440**;
- sárga lap: **440/440**;
- piros lap: **440/440**;
- összes kiállítás: **440/440**;
- magasság: **285/440**;
- mezszám: **288/440**;
- játékperc: **29/440**;
- gólpassz: **29/440**;
- kritikus szerkezeti hiba: **0**;
- auditfigyelmeztetés: **2**;
- megőrzött forrásütközés: **6**.

A következő adatbővítési prioritás a **magasság**: jelenleg 155 játékosnál hiányzik. Magasságkategória csak megfelelően kiegyensúlyozott, valós adatokkal aktiválható.

A részletes aktuális jelentés: `data/database-review.md`.

## Hiányzó adatok kezelése

A `Nincs adat`, `n/a`, kötőjel, `null`, üres szöveg és más helyőrzők valódi hiányértékké alakulnak. Hiányzó statisztika nem válik automatikusan nullává vagy 0-vá, és az adott kategória összehasonlításából kizárható.

Nem kerül becslésre:

- játékperc vagy gólpassz hivatalos forrás nélkül;
- piaci érték;
- hiányzó magasság;
- nem közölt szerződéses adat;
- bizonytalan mezszám, poszt vagy nemzetiség.

## Hivatalos kiegészítő forrásrétegek

A projekt a 12 NB I-es klubhoz dokumentált hivatalos forrásrétegeket tart fenn. A forrásjegyzék a `data/club-official-sources.json`, a kiegészítések és korrekciók a `data/club-official-enrichment*.json`, `data/club-official-corrections*.json` és kapcsolódó auditfájlok alatt követhetők.

A korábbi kiegészítési auditban a használható hivatalos keret- és profilrekordok illesztése teljes volt, de a normalizált adatbázis aktuális állapotát mindig a `data/database-review.md` tekinti mérvadónak.

## Fő implementációs területek

| Terület | Fő fájlok |
|---|---|
| Alkalmazásindítás és runtime | `js/main.js`, `js/game/game-runtime.js`, `js/bootstrap.js` |
| Mentés | `js/services/save-service.js`, `js/services/season-save-service.js`, `js/services/storage-service.js` |
| Gyors meccs | `js/domain/quick-match-domain.js`, `js/services/quick-match-storage-service.js`, `js/deck-selection.js` |
| Torna | `js/tournament-mode.js`, `js/tournament/`, `js/services/tournament-storage-service.js` |
| PWA/offline | `sw.js`, `scripts/audit-pwa-shell.mjs`, `test/pwa-cache.test.mjs` |
| Mobil/Android | `scripts/prepare-mobile.mjs`, `scripts/mobile-runtime-smoke.mjs`, `.github/workflows/android-apk.yml` |
| Adatbázis | `js/database/`, `scripts/migrate-normalized-database.mjs`, `data/database-review.md` |

## Jogi megjegyzés

A projekt prototípus- és kutatási célú. Nyilvánosan megjelenített tényadatokat használ, de nem tartalmaz játékosfotókat, hivatalos klubcímereket, MLSZ-logót vagy Transfermarkt-piaci értéket. Nyilvános vagy kereskedelmi terjesztés előtt külön ellenőrizni kell az érintett források felhasználási feltételeit, az adatbázis-jogi kérdéseket, valamint a név- és képmáshasználatot.
