# 2. lépés – Adatbázis-regiszter és manifest

## Cél

A játék adatforrásainak útvonalai ne a böngészős bootstrapban és az önálló buildben, egymástól függetlenül legyenek felsorolva. Az adatbázis leírásának egyetlen hiteles helye a manifest.

Ezen a lépésen a játékosadatok, klubadatok és statisztikák tartalma vagy helye nem változott.

## Új elemek

### `data/databases/registry.json`

A telepítésben elérhető adatbázisokat tartja nyilván, és kijelöli az alapértelmezett adatbázist.

### `data/databases/hungary-nb1-2025-26/manifest.json`

A jelenlegi NB I 2025/26 adatbázis metaadatait és valamennyi hozzá tartozó adatfájl útvonalát tartalmazza:

- alap játékosadat-fájl;
- hivatalos klubforrás-jegyzék;
- enrichment rétegek;
- korrekciós rétegek;
- hivatalos statisztikai patchrétegek;
- támogatott játékmódok és pakliválasztási módok.

### `js/database/database-registry.js`

Feladata:

- a registry és a manifest betöltése;
- a kötelező mezők ellenőrzése;
- duplikált adatbázis-azonosítók felismerése;
- az alapértelmezett adatbázis kiválasztása;
- a sikeresen betöltött registry gyorsítótárazása;
- érthető hiba jelzése hibás konfiguráció esetén.

## Kompatibilitás

A `js/bootstrap.js` továbbra is ugyanazokat az adatfeldolgozó rétegeket használja, de a fájlútvonalakat már a manifestből olvassa.

Az önálló HTML build szintén a registryben kijelölt manifestet használja. Az egyfájlos kiadás továbbra is beágyazott játékosadatbázissal készül, ezért futás közben nincs szüksége külön manifestfájlra.

A PWA-cache tartalmazza:

- a registryt;
- az aktív manifestet;
- a registrykezelő JavaScript-modult;
- a manifestben felsorolt jelenlegi adatfájlokat.

## Új adatbázis hozzáadása 5 lépésben

1. Hozz létre új mappát a `data/databases/` alatt.
2. Helyezd el vagy hivatkozd be az új adatbázis tényleges adatfájljait.
3. Készíts `manifest.json` fájlt egyedi `id` értékkel és teljes `files` objektummal.
4. Adj hozzá egyetlen bejegyzést a `data/databases/registry.json` `databases` listájához.
5. Add hozzá az új manifestet és adatfájlokat a PWA-cache generálásához vagy jelenlegi kézi listájához, majd futtasd az ellenőrzéseket.

A későbbi architektúralépésben a PWA-cache fájllistája is automatikusan generálható lesz a registryből.

## Ellenőrzések

Az új `test/database-registry.test.mjs` ellenőrzi:

- a registry sémáját;
- az alapértelmezett adatbázis meglétét;
- a registry és a manifest azonosítójának egyezését;
- a manifest fájllistáinak darabszámát;
- minden hivatkozott fájl fizikai meglétét;
- a duplikált azonosítók és hibás alapértelmezett adatbázis felismerését;
- a hiányos manifest elutasítását.

## Tudatosan későbbre hagyott feladatok

- több adatbázis kiválasztása a felhasználói felületen;
- a játékos- és klubadatok új mappastruktúrába mozgatása;
- egységes új játékos-adatmodellre történő migráció;
- központi `databaseService` szűrő- és lekérdezőfüggvényekkel;
- automatikus PWA-cache lista generálása;
- a régi globális kompatibilitási változók megszüntetése.
