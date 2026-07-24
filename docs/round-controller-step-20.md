# Fociskártyák 2026 – 20. lépés: központi körvezérlő

## Cél

A `Session` osztályból külön alkalmazási vezérlőbe kerül a körök teljes böngészős vezérlése és a mentett körnézet helyreállítása. A Klasszikus és Büntetőpárbaj motorja, szabályai és megjelenése változatlan marad.

## Új modul

Létrejött a `js/app/round-controller.js`.

A modul kezeli:

- a kör kezdőállapotát;
- az emberi kategóriaválasztást;
- az AI kategóriaválasztását és időzítését;
- az emberi lapkijátszást;
- az AI válaszlapját;
- a felfedést és pontozás utáni UI-folyamatot;
- a köreredményhez tartozó bantert;
- a hirtelen halál jelzését;
- a következő kör/párbaj gombját;
- az újrakeverési és idle üzenetet;
- a mentett `CHOOSE_ATTRIBUTE`, `CHOOSE_CARD`, `REVEAL` és `GAME_OVER` nézet helyreállítását;
- a félbemaradt AI-lépés befejezését;
- a hibás kör biztonságos feloldását.

## Publikus API

- `RoundControllerError`;
- `createRoundController(options)`.

A factory befagyasztott vezérlőt ad vissza a korábbi Session-metódusokkal egyező körműveletekkel.

## Explicit adapterek

A vezérlő a következőket kapja:

- `ui` – a szükséges renderelési és visszajelzési műveletek;
- `runtime` – kizárólag a játékmotor publikus műveletei;
- `getState()` – játék, mód, busy állapot és függő választás;
- `actions` – busy állapot, mentés és végeredmény;
- `wait()` – a központi turn-timing szolgáltatás;
- kategória-, fázis-, banter- és DOM-adapterek.

A modul nem importál mentési vagy mobil DOM-kompatibilitási réteget.

## Session-integráció

A `Session` konstruktor létrehozza a körvezérlőt. A korábbi metódusnevek delegáló kompatibilitási homlokzatként megmaradnak:

- `beginRound()`;
- `humanChoseAttribute()`;
- `aiChoosesAttribute()`;
- `humanPlayedCard()`;
- `revealAndScore()`;
- `sayResultBanter()`;
- `showContinue()`;
- `restoreSavedView()`;
- `finishRestoredAiMove()`.

A `Session` továbbra is kezeli az alkalmazásindítást, a beállításokat, a mentési payloadot és a mentés betöltését, de a visszaállított nézet renderelését már a körvezérlő végzi.

## Megmaradt működés

Nem változik:

- az emberi és AI választási sorrend;
- az AI-késleltetés;
- a selectable állapotok;
- a felfedés és verdict sorrendje;
- a banter és idle chatter;
- a hirtelen halál;
- az újrakeverés jelzése;
- a következő kör/párbaj gomb;
- a mentett körök folytatása;
- a hibakezelési toast;
- a Klasszikus és Büntetőpárbaj szabályai.

## Standalone, PWA és Android

A körvezérlő a standalone modulrendben az eredményvezérlő után és a `js/main.js` előtt szerepel. A PWA cache-verzió `v66`, az új modul bekerül az offline shellbe és az Android offline csomagba.

## Tesztelés

Az új `test/round-controller.test.mjs` ellenőrzi:

- a befagyasztott API-t;
- a körindítást;
- az emberi és AI kategóriaválasztást;
- a lapkijátszás és felfedés alapfolyamatát;
- a következő kör gombját;
- a mentett nézet helyreállítását;
- a game-over delegálást;
- az adaptervalidációt;
- a Session-, standalone- és PWA-integrációt.

## Kizárások

Ebben a lépésben nem változik a játékmotor, az eredményszámítás, a menü- és eredményvezérlő, valamint a prototype-patch UI-rétegek betöltése.
