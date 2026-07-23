# 7. lépés – A vizuális réteg komponensekre bontása

## Cél

A korábbi `js/ui.js` egyetlen osztályban kezelte a kártyák DOM-ját, az inspectort, az eredményjelzőt, a kategóriaválasztót, a párbajnézetet, a kommentárt, a hangokat és az overlayt.

A 7. lépés ezeket kisebb nézetkomponensekre bontja úgy, hogy:

- a `UI` osztály nyilvános felülete változatlan maradjon;
- a később betöltött mobil-, hozzáférhetőségi és megbízhatósági rétegek továbbra is felülírhassák a `UI.prototype` hookokat;
- a Klasszikus és Büntetőpárbaj szabályai ne változzanak;
- a DOM-struktúra, CSS-osztályok és szövegek változatlanok maradjanak;
- az önálló HTML, a PWA és az Android-csomag ugyanazokat a komponenseket használja.

## Komponensek

### `js/ui/dom.js`

Közös, állapotmentes segédek: `ART`, `$()`, `el()`, `tryArt()`, a kocsmaháttér-scrim, valamint a monogram- és részletformázó segédek.

### `js/ui/card-view.js`

A kártya DOM-jáért felel: elő- és hátlap, portré és fallback-monogram, név, klub, nemzetiség, statisztikasorok, aktív kategória és használhatósági állapotok.

A kéz és az inspector továbbra is a `UI.renderCard()` hookon keresztül kéri a kártyát. Ez megőrzi a később betöltött név-, akadálymentességi és közvetlen kijátszási javításokat.

### `js/ui/scoreboard-view.js`

A Klasszikus és Büntetőpárbaj eredményjelzőjét, a megnyert vagy felhasznált lapokat, a döntetlenpaklit és a kísérletjelölőket kezeli.

A `UI._renderClassicScores()`, `UI._renderPenaltyScores()` és `UI._renderPiles()` hookok megmaradtak, ezért a meccsnapi és kéznagyító rétegek változatlanul működnek.

### `js/ui/match-view.js`

A kategóriaválasztót, promptot, kétoldali párbajt, eredményt és hirtelen halál jelzést kezeli. Callbackeken keresztül használja a patch-elhető `UI.renderCard()`, `UI.setPrompt()` és `UI.playSound()` metódusokat.

### `js/ui/feedback-view.js`

A kommentárbuborékokat, avatar-fallbacket és opcionális Web Audio hangjelzést kezeli. A hang- és kommentárbeállítás ellenőrzése továbbra is a `UI` homlokzatban történik.

## A `UI` homlokzat

A `js/ui.js` marad az egyetlen felület, amelyet a munkamenet és a később betöltött vizuális javítások használnak. Megmaradt többek között:

- `renderCard()` és `renderHands()`;
- `openInspector()`, `closeInspector()`, `_renderInspector()` és `_inspectorStep()`;
- `renderScores()`, `_renderClassicScores()`, `_renderPenaltyScores()` és `_renderPiles()`;
- `showAttributePicker()`, `showDuel()` és `showVerdict()`;
- `showOverlay()`.

Ezek delegálnak a komponenseknek, de továbbra is felülírhatók.

## Kompatibilitási szabály

Új vizuális funkció esetén:

1. a DOM-részletet a megfelelő komponensbe kell tenni;
2. a játékmenetből hívott vagy más réteg által felülírt metódus a `UI` osztályban marad;
3. a komponens callbacken keresztül hívja a patch-elhető `UI` metódust;
4. a CSS-osztályok átnevezése külön, célzott vizuális migráció legyen;
5. az új komponens kerüljön be az önálló build modulrendjébe és a PWA cache-be.

## Tesztelés

A `test/ui-components.test.mjs` ellenőrzi a komponensosztályokat, a homlokzat delegálását, a patch-elhető hookokat, az önálló build modulrendjét, a PWA cache-t, a komponensek jelenlétét a generált HTML-ben és a feloldatlan UI-importok hiányát.

A meglévő böngészős, mobil-, hozzáférhetőségi, teljes alkalmazás- és Android-tesztek változatlanul ellenőrzik a tényleges viselkedést.
