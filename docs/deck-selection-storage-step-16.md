# Fociskártyák 2026 – 16. lépés: pakliválasztási tárolási szolgáltatás

## Cél

A 15. lépésben leválasztott pakliválasztási domainlogika után a következő felelősség a tartós tárolás elkülönítése. A cél, hogy a `js/deck-selection.js` ne olvasson és ne írjon közvetlenül tárolási kulcsokat vagy a közös storage-service primitívjeit.

Ez a lépés nem módosítja a pakliválasztó menüt, a legalább 11 lapos szabályt, a mentési formátumot vagy a játékmódok működését.

## Új modul

Létrejött a `js/services/deck-selection-storage-service.js`.

A szolgáltatás DOM-mentes és injektálható. Alapértelmezésben a meglévő `storageService` adaptert, az `APP_STORAGE_KEYS` kulcsokat és a 15. lépés domainfüggvényeit használja.

## Publikus konfiguráció és API

- `DECK_SELECTION_STORAGE_KEY`;
- `SAVED_MATCH_STORAGE_KEY`;
- `DECK_SELECTION_STORAGE_KEYS`;
- `DeckSelectionStorageError`;
- `createDeckSelectionStorageService(options)`;
- `deckSelectionStorageService`;
- `readDeckSelection(players)`;
- `saveDeckSelection(selection)`;
- `hasSavedMatch()`;
- `clearSavedMatch()`;
- `replaceDeckSelection(selection, options)`.

## Felelősségek

### Validált beolvasás

A `read()` metódus:

1. beolvassa a tárolt JSON-t;
2. hiányzó vagy hibás JSON esetén véletlen választást használ;
3. a jelenlegi játékos-adatbázissal validálja a választást;
4. nem elérhető klub vagy nemzetiség esetén biztonságosan véletlen paklira esik vissza.

### Normalizált mentés

A `save()` metódus mentés előtt a domainmodul `normaliseDeckSelection()` függvényét használja. Ez megőrzi a korábbi adatformátumot:

```json
{
  "kind": "random | club | nation",
  "value": ""
}
```

### Mentett mérkőzés kezelése

A szolgáltatás külön kezeli:

- van-e mentett mérkőzés;
- a mentett mérkőzés törlését;
- az új pakliválasztás alkalmazását.

A `replace()` alapértelmezett sorrendje változatlan:

1. mentett mérkőzés törlése;
2. normalizált pakliválasztás mentése.

A megerősítő párbeszéd továbbra is a UI-réteg felelőssége, ezért a szolgáltatás nem használ `window.confirm()` hívást.

## Injektálható adapter

A factory egy minimális adaptert vár:

- `readJson(key, fallback)`;
- `readString(key, fallback)`;
- `writeJson(key, value)`;
- `remove(key)`.

Ez memóriabeli adapterrel is tesztelhető, és nem függ közvetlenül a böngészői `localStorage` objektumtól.

Hibakódok:

- `INVALID_STORAGE_ADAPTER`;
- `INVALID_STORAGE_KEYS`.

## `deck-selection.js` kompatibilitás

A korábbi importútvonalak megmaradnak. A `js/deck-selection.js` továbbra is exportálja:

- `DECK_SELECTION_STORAGE_KEY`;
- `SAVED_MATCH_STORAGE_KEY`;
- `readDeckSelection()`;
- `saveDeckSelection()`.

Ezek már az új szolgáltatásból érkeznek.

A fájl többé nem importálja közvetlenül:

- az `APP_STORAGE_KEYS` objektumot;
- a `storage-service.js` modult;
- a `readStoredJson()` függvényt;
- a `readStoredString()` függvényt;
- a `writeStoredJson()` függvényt;
- a `removeStoredValue()` függvényt.

## UI-határ

A pakliválasztó UI továbbra is a `js/deck-selection.js` fájlban marad. A csere alkalmazásakor:

1. a UI lekérdezi a szolgáltatástól, van-e mentett mérkőzés;
2. szükség esetén megjeleníti a magyar megerősítő párbeszédet;
3. jóváhagyás után a szolgáltatás `replace()` metódusát hívja;
4. újratölti az oldalt.

Így a tárolási döntések központosítottak, de a felhasználói interakció nem kerül a szolgáltatási rétegbe.

## Megmaradt működés

Nem változik:

- a pakliválasztó felület;
- a véletlen, klub- és nemzetiségalapú választás;
- a legalább 11 használható kártyás feltétel;
- a tárolási kulcsok;
- a mentett objektum sémája;
- a mentett mérkőzés törlése paklicserekor;
- a törlés előtti megerősítő kérdés;
- a Klasszikus és Büntetőpárbaj mód;
- a magyar nyelvű felület.

## Standalone, PWA és Android

A modul sorrendje:

1. konfiguráció;
2. közös storage-service;
3. pakliválasztási domainmodul;
4. pakliválasztási tárolási szolgáltatás;
5. pakliválasztási UI/kompatibilitási homlokzat.

A service worker cache-verziója `v62`, és az új szolgáltatás bekerül az offline shellbe. Az Android offline webcsomag a meglévő buildfolyamaton keresztül örökli a modult.

## Tesztelés

Az új `test/deck-selection-storage-service.test.mjs` ellenőrzi:

- a központi kulcsokat;
- az érvényes választás beolvasását;
- a hibás JSON visszaesését;
- az aktuális adatbázissal érvénytelen választás visszaesését;
- a normalizált mentést;
- a mentett mérkőzés felismerését és törlését;
- a törlés–mentés műveleti sorrendjét;
- az opcionális törlés nélküli mentést;
- az egyedi tárolási kulcsokat;
- a hibás adapterek elutasítását;
- a DOM-függetlenséget;
- a régi exportútvonalat;
- a standalone modulrendet;
- a PWA-cache bejegyzést.

## Kizárások

Ebben a lépésben nem történik meg:

- a pakliválasztó DOM-komponens külön fájlba helyezése;
- az inline CSS kiváltása;
- a MutationObserver eltávolítása;
- a megerősítő párbeszéd átalakítása;
- új paklitípus bevezetése;
- játékosadat vagy grafikai asset módosítása.
