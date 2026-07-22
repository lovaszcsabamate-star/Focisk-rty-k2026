# Fociskártyák 2026

Magyar nyelvű, kocsmai hangulatú összehasonlító kártyajáték a 2025/26-os NB I **440 egyedi játékosból és 464 játékos–klub regisztrációból** álló, MLSZ-alapú adatbázisával. Böngészőben, offline PWA-ként és külső fájloktól független, egyfájlos letöltésként is fut.

## Letöltés

### [⬇️ Legújabb önálló játék letöltése](https://github.com/lovaszcsabamate-star/Focisk-rty-k2026/raw/refs/heads/main/Fociskartyak2026.html)

A letöltött `Fociskartyak2026.html` közvetlenül, dupla kattintással megnyitható a böngészőben. A játék kódja és teljes aktív adatbázisa be van ágyazva; a fájl nem igényel külön stíluslapot, JavaScript-fájlt, manifestet vagy ikont.

### [📦 Teljes projekt letöltése ZIP-ben](https://github.com/lovaszcsabamate-star/Focisk-rty-k2026/archive/refs/heads/main.zip)

A ZIP tartalmazza a forráskódot, az adatfájlokat, az önálló játékfájlt és a Windows-indítót.

## Indítás

### Windows

Kattints duplán a `JATEK_INDITASA.bat` fájlra. Ez megnyitja a beágyazott adatbázist tartalmazó `Fociskartyak2026.html` játékfájlt.

### Fejlesztői indítás

```bash
npm start
```

Ezután nyisd meg: `http://localhost:8901`

### Önálló játékfájl készítése

```bash
npm run build
```

A build elkészíti vagy frissíti:

- `Fociskartyak2026.html`;
- `data/players-reviewed.json`;
- `data/enrichment-audit.json`;
- `data/database-review.json` és `data/database-review.md`;
- a változásnaplót és a hiányzó mezők kimutatását.

## Játékmódok

- **Klasszikus mód:** 52 lapos mérkőzés, öt lapos kéz, felváltott kategóriaválasztás.
- **Büntetőpárbaj:** 11–11 lap, öt rendes párbaj, döntetlennél hirtelen halál.

A pontos születési dátum csak az összehasonlításhoz használható; a kártyán kizárólag az egész éves életkor jelenik meg. A számított játékospontszám nem látható és nem játékkategória.

## Pakliválasztás

Mindkét játékmód indítható:

- a teljes adatbázisból véletlen kártyákkal;
- választott NB I-es klub játékosaival;
- olyan nemzetiség játékosaival, amelyből legalább 11 használható kártya van.

A választás helyben mentődik. Paklicsere előtt a játék figyelmeztet, ha folyamatban lévő mentett mérkőzés törlődne.

## MLSZ-elsődleges adatmodell

Az eredeti `data/players.json` változatlan forráspillanatkép marad:

- 440 egyedi játékos;
- 464 játékos–klub regisztráció;
- 24 többklubos játékos;
- minden eredeti azonosító és MLSZ-statisztika megmarad.

A kluboldali és más dokumentált információk külön, visszakövethető rétegekből töltődnek be. Kiegészítő adat csak hiányzó mezőt tölthet ki; eltérésnél az MLSZ marad elsődleges. Többklubos játékos klubspecifikus mezszáma és szezonstatisztikája külön metaadatban marad, így nem torzítja a személy-szezon összesítést.

## Ellenőrzött adatállapot

A 2026. július 22-én generált felülvizsgálat szerint:

- **440/440** játékosnak van pontos születési dátuma, posztja és nemzetisége;
- **440/440** játékosnál rendelkezésre áll a mérkőzés-, kezdés-, gól- és fegyelmi alapadat;
- **125** játékosnál van forrásolt magasság;
- **288** játékosnál van mezszám;
- **29** játékosnál van játékperc és gólpassz;
- **0** kritikus szerkezeti hiba;
- **0** duplikált játékosjelölt;
- **2** dokumentált forráskezelési figyelmeztetés;
- **2** megőrzött, visszakövethető forrásütközés;
- **4093** változásnapló-bejegyzés.

A két figyelmeztetés a DVSC és az MTK történeti 2025/26-os keretforrásának eltérő domainjére vonatkozik; nem futásidejű vagy adatszerkezeti hiba.

### Mezőlefedettség

| Mező | Eredeti | Ellenőrzött | Hozzáadott |
|---|---:|---:|---:|
| Pontos születési dátum | 121 | 440 | +319 |
| Mérkőzések | 143 | 440 | +297 |
| Kezdések | 143 | 440 | +297 |
| Gólok | 440 | 440 | 0 |
| Kerettagság | 106 | 440 | +334 |
| Játékperc | 0 | 29 | +29 |
| Gólpassz | 0 | 29 | +29 |
| Sárga lap | 143 | 440 | +297 |
| Közvetlen piros lap | 143 | 440 | +297 |
| Második sárga utáni kiállítás | 0 | 37 | +37 |
| Összes kiállítás | 143 | 440 | +297 |
| Poszt | 0 | 440 | +440 |
| Nemzetiség | 0 | 440 | +440 |
| Magasság | 0 | 125 | +125 |
| Mezszám | 0 | 288 | +288 |
| További hivatalos klubmetaadat | 0 | 85 játékos | +85 játékos |

A magasság, játékperc és gólpassz csak megfelelő lefedettségű pakliban használható; hiányzó adatból nem készül becslés.

## Hiányzó adatok kezelése

A `Nincs adat`, `n/a`, kötőjel, `null`, üres szöveg és hasonló helyőrzők valódi hiányértékké alakulnak, és nem jelennek meg a kártyán.

Nem kerül becslésre:

- játékperc vagy gólpassz annál, akinél nincs ellenőrzött forrás;
- piaci érték;
- hiányzó magasság;
- nem közölt szerződéses adat;
- bizonytalan mezszám, poszt vagy nemzetiség.

## Automatikus ellenőrzés

```bash
npm run lint
npm run build
npm test
npm run test:all
npm run test:mobile-layout
npm run test:runtime
npm run test:standalone
```

A GitHub Actions ellenőrzi a szintaxist, az assetlicenceket, az adatbázist, a teljes tesztcsomagot, a mobil- és asztali elrendezést, valamint a Klasszikus és Büntetőpárbaj mód valódi Chrome-futását. A generált önálló játékfájl és audit csak sikeres ellenőrzés után frissül.

A jelenlegi futásidejű riport szerint mindkét játékmód konzolhiba, betöltési hiba és külső hálózati kérés nélkül indul. A mobilteszt 320, 360, 390, 412 és 480 képpontos szélességen nem talált vízszintes túlcsordulást vagy képernyőn kívüli fő vezérlőt.

## Fő implementációs fájlok

| Fájl | Szerep |
|---|---|
| `js/bootstrap.js` | Az alapadatok, kiegészítések, korrekciók és statisztikai rétegek betöltése |
| `js/deck-selection.js` | Véletlen, klub- és nemzetiségalapú pakliválasztás |
| `js/data/club-enrichment.js` | Veszteségmentes adatillesztés és névazonosítás |
| `js/data/club-stat-patches.js` | MLSZ-elsődleges szezonstatisztikai kiegészítés |
| `scripts/build-standalone.mjs` | Egyfájlos build és teljes adatfelülvizsgálat |
| `scripts/postprocess-standalone.mjs` | Pakliválasztás beágyazása és a külső fájlhivatkozások eltávolítása |
| `test/standalone-download.test.mjs` | A valóban önálló, letölthető HTML regressziós ellenőrzése |
| `sw.js` | A PWA offline gyorsítótárazása |

## Jogi megjegyzés

A projekt prototípus- és kutatási célú. Nyilvánosan megjelenített MLSZ- és kluboldali tényadatokat használ, de nem tartalmaz játékosfotókat, hivatalos klubcímereket, MLSZ-logót vagy Transfermarkt-piaci értéket. Nyilvános vagy kereskedelmi terjesztés előtt külön ellenőrizni kell a felhasználási feltételeket, az adatbázis-jogi kérdéseket, valamint a név- és képmáshasználatot.
