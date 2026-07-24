# Fociskártyák 2026 – 17. lépés: pakliválasztó UI-komponens

## Cél

A 15. lépésben leválasztott domainlogika és a 16. lépésben leválasztott tárolási felelősség után a `js/deck-selection.js` fájlban már csak a böngészői megjelenítés és életciklus maradt. A 17. lépés ezt emeli külön UI-komponensbe.

A refaktor nem változtatja meg a pakliválasztó kinézetét, szövegeit, választási lehetőségeit, mentési viselkedését vagy a két játékmód működését.

## Új modul

Létrejött a `js/ui/deck-selection-menu-component.js`.

A modul felelőssége:

- a pakliválasztó inline stílusának egyszeri injektálása;
- a véletlen, klub- és nemzetiségalapú választógombok felépítése;
- a klub- és nemzetiséglista megjelenítése;
- az aktív választás magyar összefoglalója;
- a paklicsere eseménykezelése;
- a mentett mérkőzés törlése előtti megerősítés;
- az oldal újratöltése jóváhagyott paklicsere után;
- a szabálypanel pakliválasztási részének hozzáadása;
- a később megjelenő menü- és szabálypanelek MutationObserver-alapú kiegészítése;
- az observer és a DOMContentLoaded-listener leállítása a cleanup függvényben.

## Publikus API

- `DECK_SELECTION_MENU_STYLE_ID`;
- `createDeckSelectionMenuController(options)`;
- `installDeckSelectionMenu(payload, activeSelection)`.

A factory visszatérési értéke egy befagyasztott vezérlő:

```js
const controller = createDeckSelectionMenuController(options);
const cleanup = controller.mount(payload, activeSelection);
cleanup();
```

## Injektálható böngészői függőségek

A vezérlő factory tesztelhetően injektálhatóvá teszi:

- a `document` referenciát;
- az observer factoryt;
- a pakliválasztási tárolási szolgáltatást;
- a megerősítő függvényt;
- az újratöltési függvényt.

A produkciós alapértelmezések a böngészői `document`, `MutationObserver`, `confirm` és `location.reload()` működését használják.

## Életciklus

Ha a dokumentum még töltődik, a komponens egyszeri `DOMContentLoaded` listenerrel indul. Kész dokumentumnál azonnal:

1. kiegészíti a már létező mobil kezdőképernyőt és szabálypanelt;
2. elindítja a DOM-változásokat figyelő observert;
3. minden új panelnél idempotensen ellenőrzi, hogy a pakliválasztó vagy szabálykártya már létezik-e.

A visszaadott cleanup függvény:

- eltávolítja a még várakozó DOMContentLoaded-listenert;
- leállítja az observert;
- többször is biztonságosan meghívható.

## Megmaradt felhasználói működés

Nem változott:

- a „Pakli kiválasztása” összecsukható panel;
- a három választási típus;
- a minimum 11 használható kártyás szabály;
- a magyar zászló- és nemzetiségmegnevezés;
- a klubok és nemzetiségek rendezése;
- a „Pakli alkalmazása” gomb;
- a mentett mérkőzés törlése előtti magyar megerősítő kérdés;
- az oldal újratöltése paklicsere után;
- a szabálypanel szövege;
- a mobil és asztali megjelenés;
- a Klasszikus és Büntetőpárbaj működése.

## Kompatibilitási homlokzat

A `js/deck-selection.js` a lépés után csak importál és re-exportál:

- minden pakliválasztási domainfüggvényt;
- minden korábbi tárolási exportot;
- az `installDeckSelectionMenu()` függvényt;
- az új UI-controller factoryt és stílusazonosítót.

A fájlban nem marad:

- `document` használat;
- `MutationObserver`;
- inline CSS;
- DOM-elem létrehozás;
- eseménykezelő;
- `confirm()`;
- `location.reload()`.

A `js/bootstrap.js` korábbi importja változtatás nélkül működik tovább.

## Standalone, PWA és Android

A modul sorrendje:

1. konfiguráció;
2. közös storage-service;
3. pakliválasztási domainmodul;
4. pakliválasztási tárolási szolgáltatás;
5. pakliválasztó UI-komponens;
6. kompatibilitási homlokzat.

A PWA cache-verzió `v63`, és az új UI-modul bekerül az offline shellbe. Az Android offline webcsomag a meglévő buildfolyamaton keresztül örökli a komponenst.

A standalone builder továbbra is a külön importokat és exportlistákat eltávolító flattenelést használja, ezért az új belső top-level nevek egyedi `deckSelectionMenu` előtagot kaptak.

## Tesztelés

Az új `test/deck-selection-menu-component.test.mjs` ellenőrzi:

- a publikus stílusazonosítót;
- a befagyasztott controller API-t;
- a késleltetett DOMContentLoaded-indítást;
- az azonnali indítást kész dokumentumnál;
- az observer célját és leállítását;
- az idempotens cleanupot;
- a DOM nélküli biztonságos fallbacket;
- a stílus egyszeri hozzáadását;
- a UI-szövegek jelenlétét;
- a tárolási szolgáltatás használatát;
- a kompatibilitási homlokzat DOM-mentességét;
- a standalone modulrendet;
- a PWA-cache bejegyzést.

A teljes Chrome mobilnézeti, Klasszikus, Büntetőpárbaj és Android ellenőrzés biztosítja a tényleges böngészői működés változatlanságát.

## Kizárások

Ebben a lépésben nem történik meg:

- az inline stílus külön CSS-fájlba helyezése;
- a MutationObserver teljes kiváltása központi képernyővezérlővel;
- új paklitípus vagy új szabály bevezetése;
- a bootstrap importútvonalának módosítása;
- játékosadat vagy grafikai asset módosítása.
