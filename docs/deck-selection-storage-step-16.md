# Fociskártyák 2026 – 16. lépés: pakliválasztási tárolási szolgáltatás

## Cél

A 15. lépésben leválasztott pakliválasztási domainlogika után a tartós tárolás is külön rétegbe kerül. A `js/deck-selection.js` többé nem olvas vagy ír közvetlenül tárolási kulcsokat és storage-primitíveket.

Ez a lépés nem módosítja a pakliválasztó menüt, a legalább 11 lapos szabályt, a mentési formátumot vagy a játékmódok működését.

## Új modul

Létrejött a `js/services/deck-selection-storage-service.js`.

A szolgáltatás DOM-mentes és injektálható. Alapértelmezésben a meglévő `storageService` adaptert, az `APP_STORAGE_KEYS` kulcsokat és a pakliválasztási domainfüggvényeket használja.

## Publikus API

Közvetlen exportok:

- `DECK_SELECTION_STORAGE_KEY`;
- `SAVED_MATCH_STORAGE_KEY`;
- `DECK_SELECTION_STORAGE_KEYS`;
- `DeckSelectionStorageError`;
- `createDeckSelectionStorageService(options)`;
- `deckSelectionStorageService`;
- `readDeckSelection(players)`;
- `saveDeckSelection(selection)`.

A `deckSelectionStorageService` objektum metódusai:

- `read(players)`;
- `save(selection)`;
- `hasSavedMatch()`;
- `clearSavedMatch()`;
- `replace(selection, options)`.

A mentett mérkőzéshez tartozó metódusok szándékosan csak a szolgáltatás objektumán érhetők el. Így a flattenelt standalone bundle-ben nem ütköznek a központi mérkőzésmentési szolgáltatás azonos nevű exportjaival.

## Validált beolvasás

A `read()` metódus:

1. beolvassa a tárolt JSON-t;
2. hiányzó vagy hibás JSON esetén véletlen választást használ;
3. az aktuális játékos-adatbázissal validálja a választást;
4. nem elérhető klub vagy nemzetiség esetén véletlen paklira esik vissza.

## Normalizált mentés

A `save()` mentés előtt a domainmodul `normaliseDeckSelection()` függvényét használja. A tárolt séma változatlan:

```json
{
  "kind": "random | club | nation",
  "value": ""
}
```

## Mentett mérkőzés kezelése

A szolgáltatás objektuma külön kezeli:

- van-e mentett mérkőzés;
- a mentett mérkőzés törlését;
- az új pakliválasztás alkalmazását.

A `replace()` alapértelmezett sorrendje:

1. mentett mérkőzés törlése;
2. normalizált pakliválasztás mentése.

A megerősítő párbeszéd továbbra is a UI-réteg felelőssége, ezért a szolgáltatás nem használ `window.confirm()` hívást.

## Injektálható adapter

A factory a következő adaptermetódusokat várja:

- `readJson(key, fallback)`;
- `readString(key, fallback)`;
- `writeJson(key, value)`;
- `remove(key)`.

Ez memóriabeli adapterrel is tesztelhető, és nem függ közvetlenül a böngészői `localStorage` objektumtól.

Hibakódok:

- `INVALID_STORAGE_ADAPTER`;
- `INVALID_STORAGE_KEYS`.

## Régi importútvonal kompatibilitása

A `js/deck-selection.js` továbbra is exportálja:

- `DECK_SELECTION_STORAGE_KEY`;
- `SAVED_MATCH_STORAGE_KEY`;
- `readDeckSelection()`;
- `saveDeckSelection()`.

Ezek már az új szolgáltatásból érkeznek. A fájl többé nem importálja közvetlenül az `APP_STORAGE_KEYS` objektumot vagy a `storage-service.js` primitívjeit.

## UI-határ

Paklicserekor a UI:

1. a szolgáltatástól lekérdezi, van-e mentett mérkőzés;
2. szükség esetén megjeleníti a magyar megerősítő kérdést;
3. jóváhagyás után meghívja a `replace()` metódust;
4. újratölti az oldalt.

Így a tárolási döntések központosítottak, a felhasználói interakció pedig a megfelelő UI-rétegben marad.

## Megmaradt működés

Nem változik:

- a pakliválasztó felület;
- a véletlen, klub- és nemzetiségalapú választás;
- a legalább 11 kártyás feltétel;
- a tárolási kulcsok és a mentett objektum sémája;
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

A service worker cache-verziója `v62`, az új szolgáltatás bekerült az offline shellbe, és az Android offline webcsomag is örökli.

## Tesztelés

A `test/deck-selection-storage-service.test.mjs` ellenőrzi:

- a központi kulcsokat;
- az érvényes választás beolvasását;
- a hibás JSON és az érvénytelen választás visszaesését;
- a normalizált mentést;
- a mentett mérkőzés felismerését és törlését;
- a törlés–mentés sorrendjét;
- az opcionális törlés nélküli mentést;
- az egyedi kulcsokat;
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
