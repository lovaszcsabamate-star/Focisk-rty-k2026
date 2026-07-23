# 4. lépés – A meglévő játékosadatok normalizálása és migrációja

## Cél

A korábbi adatbázis több egymásra épülő fájlból állt:

- 1 alap játékosadat-fájl;
- 23 kluboldali kiegészítési réteg;
- 5 ellenőrzött korrekciós réteg;
- 13 hivatalos statisztikai csomag;
- 1 klubforrás-jegyzék.

A játék induláskor minden alkalommal ezeket a rétegeket töltötte be és egyesítette. A 4. lépés egyetlen, verziózott és reprodukálható normalizált adatfájlt állít elő belőlük.

## Új fájlok

### `players.normalized.json`

Elérési út:

`data/databases/hungary-nb1-2025-26/players.normalized.json`

Tartalma:

- 440 stabil, egyedi játékosrekord;
- 464 megőrzött klubregisztráció metaadata;
- a játékosmodell 30 kanonikus mezője;
- a korábbi játék által használt kompatibilitási mezők;
- az eredeti `stats` objektumok;
- forrás- és teljességi metaadatok;
- migrációs ellenőrzőösszegek.

### `normalization-report.json`

Elérési út:

`data/databases/hungary-nb1-2025-26/normalization-report.json`

A jelentés tartalmazza:

- a játékosok és klubregisztrációk számát;
- a felhasznált forrásfájlokat;
- a források SHA-256 ellenőrzőösszegét;
- a normalizált játékoslista ellenőrzőösszegét;
- a validáció eredményét;
- az adatteljesítettség összesítését;
- az adatmegőrzési ellenőrzések eredményét.

## Migrációs parancs

```bash
npm run migrate:database
```

A parancs:

1. beolvassa az adatbázis manifestjét;
2. betölti az alapadatokat és valamennyi regisztrált réteget;
3. alkalmazza az ellenőrzött korrekciókat;
4. alkalmazza a kluboldali kiegészítéseket;
5. alkalmazza a hivatalos statisztikai csomagokat;
6. létrehozza az egységes játékosmodellt;
7. validálja mind a 440 rekordot;
8. ellenőrzi az azonosítók, nevek és `stats` objektumok változatlanságát;
9. kiírja a normalizált adatbázist és a jelentést.

## Reprodukálhatósági ellenőrzés

```bash
npm run check:normalized-database
```

Ez újra előállítja a migráció várható eredményét a memóriában, majd összehasonlítja a commitolt fájlokkal. Eltérés esetén hibával leáll.

## Alkalmazásbetöltés

Az alkalmazás elsődlegesen a manifest `files.normalizedPlayers` fájlját tölti be.

Betöltési sorrend:

1. normalizált adatfájl;
2. adatbázis- és játékosmodell-verzió ellenőrzése;
3. kritikus validációs hibák ellenőrzése;
4. használható kártyák szűrése;
5. pakliválasztás és játékindítás.

## Biztonságos visszaállás

Ha a normalizált fájl:

- hiányzik;
- nem olvasható;
- másik adatbázishoz tartozik;
- nem támogatott játékosmodell-verziót használ;
- kritikus validációs hibát jelez;
- nem tartalmaz elegendő játékost;

akkor a rendszer figyelmeztetést ír a fejlesztői naplóba, majd újraépíti az adatbázist a korábbi réteges forrásokból.

A felhasználó ezért nem kap üres vagy használhatatlan képernyőt egyetlen sérült generált fájl miatt.

## Adatmegőrzési garanciák

A migráció automatikusan ellenőrzi, hogy:

- a játékosok száma 440 maradt;
- minden játékosazonosító megmaradt;
- nem keletkezett duplikált azonosító;
- egyetlen játékosnév sem módosult;
- egyetlen eredeti `stats` objektum sem módosult;
- nem került be kitalált érték;
- a hiányzó értékek `null` értéken maradtak;
- a valódi nulla statisztikák megmaradtak.

## Manifest-konfiguráció

A normalizált adatbázist az alábbi mezők regisztrálják:

```json
{
  "files": {
    "normalizedPlayers": "data/databases/hungary-nb1-2025-26/players.normalized.json",
    "normalizationReport": "data/databases/hungary-nb1-2025-26/normalization-report.json"
  },
  "normalization": {
    "schemaVersion": 1,
    "playerModelVersion": 1,
    "primaryFile": "normalizedPlayers",
    "migrationScript": "scripts/migrate-normalized-database.mjs",
    "reproducible": true,
    "fallback": "legacy-layered-database"
  }
}
```

## Fejlesztési szabály

A régi forrásrétegek egyelőre nem törölhetők. Ezek jelentik:

- a normalizált adatbázis reprodukálható forrását;
- a biztonságos futásidejű tartalékot;
- a forrásellenőrzés és későbbi adatfrissítés alapját.

Játékosadat módosítása után mindig futtatandó:

```bash
npm run migrate:database
npm run test:normalized-database
npm test
```

## Eredmény

A játék normál induláskor egyetlen előállított játékosadat-fájlt tölt be a több mint negyven rétegfájl helyett. A korábbi fájlok továbbra is megmaradnak ellenőrizhető, visszaállítható forrásként.
