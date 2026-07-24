# Fociskártyák 2026 – 19. lépés: végeredmény-vezérlő

## Cél

A `Session` osztályból külön alkalmazási vezérlőbe kerül a Klasszikus és Büntetőpárbaj végeredmény-képernyője. A játékszabályok, a runtime eredményszámítása és a képernyő megjelenése nem változik.

## Új modul

Létrejött a `js/app/result-controller.js`.

A modul felelőssége:

- a játék végi interakció letiltása;
- a mentett mérkőzés törlése;
- a győzelem, vereség vagy döntetlen banter kiválasztása;
- a Klasszikus mód eredményképernyője;
- a Büntetőpárbaj eredményképernyője;
- a rendes játékidő és hirtelen halál felirata;
- a legeredményesebb kategória formázása;
- a visszavágó és főmenü eseménye;
- az overlay visszatérési művelete.

## Publikus API

- `ResultControllerError`;
- `createResultController(options)`.

A factory befagyasztott vezérlőt ad vissza:

- `bestCategoryLabel(result)`;
- `showGameOver()`.

## Explicit adapterek

A vezérlő csak a szükséges felületeket kapja meg:

- `ui` – interakcióállapot és banter;
- `getState()` – mód, nehézség és runtime-eredmény;
- `actions` – busy állapot, új játék, főmenü és panelmegjelenítés;
- `clearSaved()` – a lezárt mérkőzés mentésének törlése.

A modul nem importálja a DOM-függő mobil kompatibilitási réteget.

## Session-integráció

A `Session` konstruktor létrehozza az eredményvezérlőt. A korábbi `showGameOver()` metódus megmarad, de csak a vezérlőnek delegál.

A `js/main.js` fájlból kikerül:

- a teljes eredmény-HTML;
- a Büntetőpárbaj kategóriastatisztikájának formázása;
- a visszavágó és főmenü eseménykezelése;
- a játék végi banter kiválasztása.

## Megmaradt működés

Nem változik:

- a győzelem/vereség/döntetlen szövege;
- a pontszám formátuma;
- a döntetlenpakli felirata;
- a Büntetőpárbaj párbajszáma, szakasza és legjobb kategóriája;
- a visszavágó módja és nehézsége;
- a főmenü-visszatérés;
- a lezárt mentés törlése;
- a magyar UI;
- a játékosadatok és assetek.

## Standalone, PWA és Android

A modul a standalone sorrendben a menüvezérlő után és a `js/main.js` előtt szerepel. A PWA cache-verzió `v65`, az új modul bekerül az offline shellbe. Az Android offline csomag a meglévő buildfolyamaton keresztül örökli.

## Tesztelés

Az új `test/result-controller.test.mjs` ellenőrzi:

- a befagyasztott API-t;
- a Klasszikus és Büntetőpárbaj eredménypanelt;
- a bantert és mentéstörlést;
- a legjobb kategória formázását;
- a visszavágó és főmenü eseményét;
- az adaptervalidációt;
- a DOM-függő mobil import hiányát;
- a Session-, standalone- és PWA-integrációt.

## Kizárások

Ebben a lépésben nem kerül át a körvezérlés, a mentés-visszaállítás, az AI-lépés, a pontozás vagy a prototype-patch UI-réteg.
