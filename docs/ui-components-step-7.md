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

Közös, állapotmentes segédek:

- `ART` assetjelöltek;
- `$()` DOM-lekérdezés;
- `el()` elemkészítés;
- `tryArt()` kép-fallback;
- kocsmaháttér-scrim;
- monogram- és számos részletsegédek.

### `js/ui/card-view.js`

A kártya DOM-jáért felel:

- elő- és hátlap;
- portré és fallback-monogram;
- név, klub és nemzetiség;
- elérhető statisztikasorok;
- aktív kategória;
- kijátszható, halványított és nem használható állapotok.

A kéz és az inspector továbbra is a `UI.renderCard()` nyilvános hookon keresztül kéri a kártyát. Ez megőrzi a később betöltött név-, akadálymentességi és közvetlen kijátszási javításokat.

### `js/ui/scoreboard-view.js`

Az eredményjelző belső DOM-munkáját végzi:

- Klasszikus pontállás;
- Büntetőpárbaj pontállás;
- megnyert vagy felhasznált lapok;
- döntetlenpakli;
- kísérletjelölők.

A `UI._renderClassicScores()`, `UI._renderPenaltyScores()` és `UI._renderPiles()` hookok megmaradtak, ezért a meccsnapi és kéznagyító rétegek változatlanul működnek.

### `js/ui/match-view.js`

A mérkőzés központi nézete:

- kategóriaválasztó;
- prompt;
- kétoldali párbaj;
- nyertes és vesztes kiemelése;
- köreredmény;
- hirtelen halál jelzés.

A komponens callbackeken keresztül használja a `UI.renderCard()`, `UI.setPrompt()` és `UI.playSound()` hookokat.

### `js/ui/feedback-view.js`

A visszajelzési réteg:

- kommentárbuborékok;
- avatar-fallback;
- opcionális Web Audio hangjelzés.

A hang- és kommentárbeállítás ellenőrzése továbbra is a `UI` homlokzatban történik. Ez azért fontos, mert a mentett kör visszaállításakor a megbízhatósági réteg ideiglenesen némíthatja a visszajelzést.

## A `UI` homlokzat

A `js/ui.js` marad az egyetlen felület, amelyet a munkamenet és a később betöltött vizuális javítások használnak.

Megmaradt többek között:

- `renderCard()`;
- `renderHands()`;
- `openInspector()` és `closeInspector()`;
- `_renderInspector()` és `_inspectorStep()`;
- `renderScores()`;
- `_renderClassicScores()` és `_renderPenaltyScores()`;
- `_renderPiles()`;
- `showAttributePicker()`;
- `showDuel()`;
- `showVerdict()`;
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

A `test/ui-components.test.mjs` ellenőrzi:

- a komponensosztályok meglétét;
- a `UI` homlokzat delegálását;
- a patch-elhető hookok megtartását;
- az önálló build modulrendjét;
- a PWA cache-t;
- a komponensek jelenlétét a generált önálló HTML-ben;
- a feloldatlan UI-importok hiányát.

A meglévő böngészős, mobil-, hozzáférhetőségi, teljes alkalmazás- és Android-tesztek változatlanul ellenőrzik a tényleges viselkedést.
