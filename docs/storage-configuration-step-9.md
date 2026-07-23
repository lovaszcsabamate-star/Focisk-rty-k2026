# 9. lépés – Központi konfiguráció és storage-szolgáltatás

## Cél

A böngészői tartós tároláshoz kapcsolódó kulcsok, verziók és hibakezelés központosítása úgy, hogy a meglévő mentések, beállítások és felhasználói adatok változatlanul olvashatók maradjanak.

## Központi konfiguráció

Fájl:

- `js/app/configuration.js`

A modul tartalmazza:

- `STORAGE_SCHEMA_VERSION`;
- `SAVED_MATCH_VERSION`;
- `STORAGE_KEYS`;
- `BOOLEAN_SETTING_KEYS`;
- `DEFAULT_EXPERIENCE_SETTINGS`;
- `APP_CONFIGURATION`;
- `settingStorageKey()`.

## Központi kulcsok

A következő adatok kulcsa egy helyen található:

- mentett mérkőzés;
- pakliválasztás;
- onboarding állapota;
- játékosnév;
- kiválasztott ellenfél;
- vizuális beállítások;
- vizuális méretezés biztonsági mentése;
- hang, kommentár, rezgés, animáció, nagy szöveg és egyszerűsített mód.

A tényleges kulcsszövegek változatlanok, ezért nincs szükség adat- vagy mentésmigrációra.

## Storage-szolgáltatás

Fájl:

- `js/services/storage-service.js`

A szolgáltatás támogatja:

- `readString()` és `writeString()`;
- `readJson()` és `writeJson()`;
- `readBoolean()` és `writeBoolean()`;
- `remove()`;
- injektálható tároló használatát tesztekhez;
- biztonságos fallbacket privát, blokkolt vagy beágyazott böngészőkben.

Egy storage-hiba nem szakíthatja meg a játék indítását vagy futását.

## Refaktorált fogyasztók

A következő modulok a központi konfigurációt és szolgáltatást használják:

- `js/deck-selection.js`;
- `js/mobile-experience.js`;
- `js/reliability-fixes.js`;
- `js/player-profile.js`;
- `js/opponents.js`;
- `js/visual-settings-persistence.js`;
- `js/visual-system.js`.

## Kompatibilitás

A korábbi publikus konstansok továbbra is elérhetők kompatibilitási aliasként, többek között:

- `DECK_SELECTION_STORAGE_KEY`;
- `SAVED_MATCH_STORAGE_KEY`;
- `PLAYER_NAME_STORAGE_KEY`;
- `STORAGE_KEYS` a mobilélmény modulból;
- `DEFAULT_SETTINGS`.

## Mentési szerződés

A mentett mérkőzés verziója továbbra is `2`.

Ebben a lépésben nem változik:

- a mentett objektum szerkezete;
- a hidratálási logika;
- a mentés kulcsa;
- a korábbi mentések olvashatósága.

A részletes mentésséma-validáció és migráció külön későbbi lépés feladata.

## Build és offline működés

Az önálló build sorrendje:

1. `js/app/configuration.js`;
2. `js/services/storage-service.js`;
3. a tárolást használó modulok.

Mindkét új fájl bekerül a PWA-cache-be és az Android offline webcsomagba.

## Tesztelés

A `test/storage-service.test.mjs` ellenőrzi:

- a kulcsok és verziók központi szerződését;
- a szöveg-, JSON-, logikai és törlési műveleteket;
- a hibás JSON fallbackjét;
- a hiányzó tároló kezelését;
- a kivételt dobó tároló kezelését;
- az injektálható memóriatárolót;
- hogy a refaktorált fogyasztókban ne maradjanak beégetett kulcsok;
- az önálló build sorrendjét;
- a PWA-cache bejegyzéseit.
