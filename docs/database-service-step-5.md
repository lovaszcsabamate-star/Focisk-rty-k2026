# Fociskártyák 2026 – központi adatbázis-kezelő szolgáltatás

## Cél

Az alkalmazás adatbetöltése, adatellenőrzése és adatbázis-szűrése egyetlen központi rétegen keresztül történjen. A vizuális komponenseknek és a játékmódoknak nem kell ismerniük a JSON-fájlok útvonalát, a kiegészítési rétegek sorrendjét vagy a normalizált adatbázis belső felépítését.

A szolgáltatás helye:

`js/database/database-service.js`

## Felelősségi határok

### Adatbázis-regiszter

A `database-registry.js` feladata:

- a regiszter betöltése;
- a manifestek felismerése;
- a manifest alapvető szerkezeti validációja;
- az alapértelmezett adatbázis meghatározása.

### Adatbázis-szolgáltatás

A `database-service.js` feladata:

- a kiválasztott adatbázis betöltése;
- a normalizált adatfájl elsődleges használata;
- biztonságos visszaállás a régi réteges adatforrásokra;
- a játékosmodell alkalmazása;
- a játszható rekordok elkülönítése;
- klub- és nemzetiségi szűrés;
- jogosult klubok és nemzetiségek meghatározása;
- adatbázis-validáció;
- adatbázis-statisztikák készítése;
- a betöltött adatok gyorsítótárazása.

### Bootstrap

A `bootstrap.js` feladata csak:

1. a központi szolgáltatás meghívása;
2. a mentett pakliválasztás alkalmazása;
3. a játék számára szükséges globális kompatibilitási változók beállítása;
4. a fő alkalmazás elindítása;
5. érthető magyar hibaüzenet megjelenítése.

A bootstrap többé nem importál közvetlenül adatjavító, statisztikai vagy enrichment-modulokat.

## Publikus műveletek

### `getAvailableDatabases()`

Visszaadja az összes engedélyezett, érvényes manifesttel rendelkező adatbázist.

### `getDatabaseById(databaseId)`

Visszaadja a megadott adatbázis manifestjét. Ismeretlen azonosítónál `null` az eredmény.

### `loadDatabase(databaseId?, options?)`

Betölti és gyorsítótárazza az adatbázist. Az azonosító elhagyásakor az alapértelmezett adatbázist használja.

A visszaadott pillanatkép fő mezői:

- `database` – a validált manifest;
- `source` – `normalized` vagy `legacy-fallback`;
- `payload` – a teljes normalizált játékos-adatállomány;
- `playablePayload` – a játszható rekordokat tartalmazó adatállomány;
- `players` – minden rekord;
- `playablePlayers` – csak a jelenlegi kártyakövetelményeknek megfelelő rekordok;
- `clubs` – a klubjegyzék;
- `validation` – hibák, figyelmeztetések és információk;
- `statistics` – összesített adatbázis-statisztikák.

Az `options.forceReload = true` törli az adott adatbázis gyorsítótárát és új betöltést végez.

### `getAllPlayers(databaseId, options?)`

Alapértelmezetten minden játékosrekordot visszaad.

`{ playable: true }` beállítással csak a játszható rekordokat adja vissza.

### `getAllClubs(databaseId)`

A manifesthez kapcsolt klubjegyzék egységesített klubobjektumait adja vissza.

### `getPlayersByClub(databaseId, clubId, options?)`

Klubazonosító vagy klubnév alapján szűr. Alapértelmezetten a játszható játékosokat vizsgálja.

### `getPlayersByNationality(databaseId, nationalityCode, options?)`

Nemzetiségi kód alapján szűr. A többes nemzetiséget, például `HUN / UKR`, mindkét külön kódnál figyelembe veszi.

### `getEligibleNationalities(databaseId, minimumPlayerCount)`

Csak azokat a nemzetiségeket adja vissza, amelyekhez legalább a megadott számú játszható játékos tartozik.

A jelenlegi alapértelmezett minimum: 11.

### `getEligibleTeams(databaseId, minimumPlayerCount)`

Csak azokat a klubokat adja vissza, amelyekhez legalább a megadott számú játszható játékos tartozik.

### `validateDatabase(databaseId)`

Az eredmény három szintet különít el:

- `errors` – kritikus hibák;
- `warnings` – nem kritikus hiányosságok;
- `information` – tájékoztató ellenőrzési eredmények.

A kritikus hiba normál betöltéskor `DatabaseValidationError` hibát eredményez, ezért a hibás adatbázis nem kerülhet játékba.

### `normalizeDatabase(databaseId)`

Visszaadja a központi játékosmodell szerint normalizált teljes adatállományt.

### `getDatabaseStatistics(databaseId)`

Visszaadja többek között:

- az összes játékos számát;
- a játszható játékosok számát;
- a kizárt rekordok számát;
- a klubok számát;
- a nemzetiségek számát;
- az adatforrást;
- az adatmodell verzióját;
- a támogatott játékmódokat.

### `clearDatabaseServiceCache(databaseId?)`

Egy adott adatbázis vagy a teljes szolgáltatás gyorsítótárát törli.

## Betöltési sorrend

1. Adatbázis-regiszter betöltése.
2. Manifest kiválasztása.
3. Normalizált játékosadat-fájl betöltése.
4. Adatbázis-azonosító és játékosmodell-verzió ellenőrzése.
5. Sikertelen normalizált betöltésnél visszaállás a régi réteges forrásokra.
6. Központi játékosmodell alkalmazása.
7. Játszható rekordok szűrése.
8. Klubjegyzék betöltése.
9. Kritikus és nem kritikus validáció.
10. Statisztikák előállítása.
11. Az eredmény gyorsítótárazása.

## Cache és teljesítmény

Az azonos adatbázis ismételt lekérése ugyanazt a betöltési ígéretet és pillanatképet használja. Emiatt:

- a nagy JSON-fájl nem töltődik be minden komponensnél újra;
- a normalizálás és validáció nem fut le minden rendereléskor;
- a klub- és nemzetiségi listák ugyanabból a stabil adatbázis-pillanatképből készülnek;
- egyidejű kérések nem indítanak párhuzamos, ismétlődő adatbetöltést.

## Biztonságos visszaállás

Ha a normalizált fájl:

- hiányzik;
- sérült JSON-t tartalmaz;
- más adatbázis-azonosítót tartalmaz;
- nem támogatott játékosmodell-verziójú;
- kritikus validációs hibát jelez;

akkor a szolgáltatás fejlesztői figyelmeztetést ír, majd megpróbálja a manifestben megadott régi alapadat-, enrichment-, korrekciós és statisztikai rétegeket használni.

A vizuális felületen technikai részlet helyett csak magyar nyelvű, biztonságos hibaképernyő jelenik meg, ha a tartalék betöltés sem sikerül.

## Tesztek

Célzott teszt:

`npm run test:database-service`

A teszt ellenőrzi:

- az adatbázis egyszeri betöltését;
- a gyorsítótár működését;
- a normalizált adatforrást;
- a régi réteges visszaállást;
- az összes játékos lekérését;
- a klubok lekérését;
- a klub szerinti szűrést;
- a nemzetiség szerinti szűrést;
- a legalább 11 játékossal rendelkező nemzetiségek meghatározását;
- a konfigurálható minimumú klubok meghatározását;
- a validációt;
- az adatbázis-statisztikákat;
- az ismeretlen adatbázis kezelését.

## Következő szerkezeti lépés

A következő migrációs lépésben a játékmotor leválasztható a vizuális komponensekről. A játékmódok ezután a központi adatbázis-szolgáltatáson keresztül kérhetik a saját paklijukhoz szükséges játékosokat.
