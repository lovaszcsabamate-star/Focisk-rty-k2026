# 7. lépés – A vizuális réteg komponensekre bontása

## Cél

A böngészős vizuális réteg kisebb, stabil és külön tesztelhető egységekre bontása úgy, hogy a meglévő `UI` osztály publikus felülete, a megjelenés és a játékmenet változatlan maradjon.

## Új komponensek

### `js/ui/dom-primitives.js`

Közös DOM-segédek és asset-feloldás:

- `$()`;
- `el()`;
- `ART`;
- `tryArt()`;
- `initials()`;
- `finiteDetail()`;
- `PUB_SCRIM`.

### `js/ui/card-component.js`

A kártyák egységes létrehozása:

- kézben lévő kártya;
- lefordított gépi kártya;
- párbajkártya;
- részletes, nagyított kártya;
- aktív attribútum kiemelése;
- nem használható lap állapota.

Publikus műveletek:

- `getCardRows(card, activeAttributeKey)`;
- `createCardComponent(card, options)`.

### `js/ui/scoreboard-component.js`

A Klasszikus és Büntetőpárbaj eredményjelzőjének közös belépési pontja:

- pontszámok;
- kör- és párbajmetaadatok;
- megnyert vagy felhasznált lapok;
- döntetlenpakli;
- büntetőpárbaj-jelölők.

Publikus művelet:

- `renderScoreboardComponent(dom, game, mode)`.

### `js/ui/attribute-picker-component.js`

A közösen elérhető, hiteles kategóriák gombjainak megjelenítése.

Publikus művelet:

- `renderAttributePickerComponent(container, game, onAttribute)`.

## Kompatibilitás

A `js/ui.js` továbbra is exportálja:

- `UI`;
- `$`;
- `el`;
- `ART`.

A `Session` és a többi meglévő modul ezért változtatás nélkül használhatja a vizuális réteget. A `UI` osztály tudatos kompatibilitási façade marad: a külső moduloknak nem kell ismerniük, hogy az egyes vizuális részleteket melyik belső komponens állítja elő.

## Felelősségi határok

A `UI` osztály feladata marad:

- a vizuális komponensek összehangolása;
- a kártyainspektor állapota;
- a párbaj és eredmény megjelenítése;
- kommentár és hang;
- overlay-kezelés.

A leválasztott komponensek nem kezelnek:

- játékmeneti állapotot;
- adatbázis-betöltést;
- mentést;
- AI-döntést;
- menüfolyamatot.

## Önálló és mobil build

A komponensek a függőségi sorrendnek megfelelően kerülnek az önálló HTML-be:

1. DOM-primitívek;
2. kártyakomponens;
3. eredményjelző-komponens;
4. kategóriaválasztó-komponens;
5. `UI` façade.

Ugyanezek a fájlok bekerülnek a PWA offline cache-be és így az Android webcsomagba is.

## Tesztelés

A `test/ui-components.test.mjs` ellenőrzi:

- a publikus komponensexportokat;
- a `UI` delegálását;
- a régi duplikált belső renderelő metódusok eltávolítását;
- az önálló build helyes modulrendjét;
- a PWA-cache teljességét.

A meglévő Chrome-, mobil-, játékmeneti és Android-tesztek biztosítják, hogy a komponensekre bontás ne változtassa meg a tényleges felületet.
