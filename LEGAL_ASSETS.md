# Fociskártyák 2026 – grafikai asset- és licencnyilvántartás

Ez a dokumentum a grafikai, hang- és arculati elemek kiadási ellenőrzésének központi leírása. Nem minősül jogi szakvéleménynek. Az ellenőrizhető licenc vagy írásos engedély nélküli elem nem tekinthető automatikusan kiadhatónak.

## Biztonságos alapállapot

- `allowOfficialBranding: false` minden környezetben.
- Hivatalos klub-, liga- vagy szövetségi arculat csak dokumentált, az adott felhasználási módra érvényes engedéllyel jelenhet meg.
- A kapcsoló átállítása önmagában nem elegendő: az assetnek a `src/assets/licenses/assets-licenses.json` fájlban `approvedForRelease: true` státuszúnak is kell lennie.
- Külső URL-ről játékosfotó vagy klublogó nem tölthető be.
- Ismeretlen eredetű játékosfotó helyett semleges sziluett, ismeretlen címer helyett geometrikus helyettesítő jelvény jelenik meg.

## Jóváhagyott saját és helyettesítő assetek

| Asset | Fájl | Forrás/jogosult | Licenc | Attribúció | Kereskedelmi használat | Státusz |
|---|---|---|---|---|---|---|
| Semleges játékos-sziluett | `src/assets/placeholders/player-silhouette.svg` | Fociskártyák 2026 projekt | projektben létrehozott eredeti helyettesítő grafika | nem szükséges | engedélyezett | kiadásra jóváhagyva |
| Semleges klubjelvény | `src/assets/placeholders/club-badge.svg` | Fociskártyák 2026 projekt | projektben létrehozott eredeti helyettesítő grafika | nem szükséges | engedélyezett | kiadásra jóváhagyva |
| Semleges FK26 alkalmazásikon | `src/assets/placeholders/app-icon.svg` | Fociskártyák 2026 projekt | projektben létrehozott eredeti ikon | nem szükséges | engedélyezett | kiadásra jóváhagyva |
| Mobilos QR-kód | `assets/qr/mobil-eleres.svg` | Fociskártyák 2026 projekt | technikailag generált QR-kód | nem szükséges | engedélyezett | kiadásra jóváhagyva |

A helyettesítő klubjelvények és az alkalmazásikon belső státusza: `brandingStatus: "placeholder"`.

## Meglévő, további eredetigazolást igénylő elemek

| Asset | Fájl | Jelenlegi állapot | Kiadási szabály |
|---|---|---|---|
| Korábbi projektikon | `assets/icons/icon.svg` | eredeti forrás/generálási dokumentáció ellenőrzendő | az aktív felületről kiváltva; igazolás nélkül nem használható |
| Korábbi Apple touch ikon | `assets/icons/apple-touch-icon.png` | eredeti forrás/generálási dokumentáció ellenőrzendő | az aktív felületről kiváltva; igazolás nélkül nem használható |
| Kocsmaháttér | `assets/pub/background.webp`, `.jpg`, `.png`, `.svg` | forrás, jogosult és felhasználási jog ellenőrzendő | jóváhagyásig a build nem ágyazza be; a CSS-háttér marad |
| Esetleges portrék | `assets/portraits/` | egyedi licencadat nélkül nem használhatók | a futó játék semleges sziluettre vált |
| Esetleges barát-avatarok | `assets/friends/` | egyedi licencadat nélkül nem használhatók | a futó játék monogramos/CSS-helyettesítőt használ |
| Esetleges kártyahátlap | `assets/cards/` | egyedi licencadat nélkül nem használható | a futó játék CSS-kártyahátlapot használ |

## Nem használt hivatalos arculati elemek

A kiadási alapállapot nem használ:

- hivatalos klubcímert;
- liga- vagy szövetségi logót;
- mezszponzort;
- sportszergyártói logót;
- valós klubmez egyedi mintázatának másolatát;
- fotórealisztikus, felismerhető AI-portrét valós játékosról.

A klubnév és a nyilvános tényadat nem jogosít fel a klubcímer, játékosfotó vagy más védett arculati elem használatára.

## Betűtípusok

A felület rendszerbetűket használ (`system-ui`, `Segoe UI`, Arial Narrow jellegű rendszerfallback). Külső webfontot vagy a projektbe csomagolt, bizonytalan licencű fontfájlt a jelenlegi kiadás nem tölt be.

Ha később fontfájl kerül a projektbe, a licencfájlt is meg kell őrizni, és az assetet fel kell venni a JSON-nyilvántartásba.

## Ikonok és hangok

- A kezelőfelület Unicode/emoji jeleket, saját SVG-ket és CSS-ből rajzolt elemeket használ.
- A rövid hangjelzések Web Audio API-val, futásidőben készülnek; nincs külső hangfájl.
- Külső ikoncsomag, textúra vagy hang csak dokumentált licenccel adható hozzá.

## Jóváhagyási folyamat

Egy asset csak akkor kaphat `approvedForRelease: true` státuszt, ha dokumentált:

1. a forrás és a jogosult;
2. a licenc vagy írásos engedély;
3. a digitális játékban való felhasználás joga;
4. a kereskedelmi felhasználás lehetősége;
5. a módosítás, kivágás vagy átméretezés joga;
6. az attribúciós kötelezettség;
7. az engedély időbeli és területi hatálya.

Az engedély vagy licencdokumentum helyét a `proofOfPermission` mezőben kell megadni. Általános weboldal-link, képkereső-találat vagy „interneten elérhető” megjegyzés nem megfelelő igazolás.

## Automatikus ellenőrzés

Futtatás:

```bash
npm run audit:assets
```

Az ellenőrzés:

- figyelmeztet a nyilvántartásban nem szereplő assetekre;
- figyelmeztet a hiányos licencmezőkre;
- hibát jelez, ha jóváhagyás nélküli hivatalos logó kerülne kiadásra;
- hibát jelez külső játékosfotó- vagy klublogó-URL esetén;
- a build során csak jóváhagyott hátteret enged beágyazni.

## Független projekt jelzése

A felületen megjelenő szöveg:

> A Fociskártyák 2026 független projekt. Nem áll hivatalos kapcsolatban a játékban megjelenített klubokkal, ligákkal vagy sportszövetségekkel.

Ez a tájékoztatás nem helyettesíti a szükséges felhasználási engedélyeket.
