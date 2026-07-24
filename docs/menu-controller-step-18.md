# Fociskártyák 2026 – 18. lépés: központi menüvezérlő

## Cél

A `js/main.js` `Session` osztályából külön alkalmazási szolgáltatásba kerülnek a játék előtti és játék közbeni menük. Ez a lépés a korábbi architektúra-audit `menu-controller` célját valósítja meg.

A játékmenet, a körvezérlés, az AI-lépések, a pontozás és a végeredmény kezelése továbbra is a `Session` és a már leválasztott játékruntime felelőssége.

## Új modul

Létrejött a `js/app/menu-controller.js`.

A modul kezeli:

- a főmenüt;
- a mentett mérkőzés folytatását;
- az új játék előtti mentéscsere-megerősítést;
- az ellenfél nehézségének kiválasztását;
- az onboardingot;
- a játékszabályokat;
- a beállítási képernyőt;
- a mentett játék törlését a beállításokból;
- a szünetmenüt;
- a Büntetőpárbaj bevezető képernyőjét;
- az overlay megjelenítését és elrejtését;
- az overlay visszalépési műveletét;
- a megnyitott panel első kezelőelemének fókuszálását.

## Publikus API

- `MenuControllerError`;
- `createMenuController(options)`.

A factory befagyasztott vezérlőt ad vissza a következő metódusokkal:

- `showPanel(panel, returnAction)`;
- `hidePanel()`;
- `handleBackAction()`;
- `showTitleScreen(options)`;
- `savedTimeLabel(iso)`;
- `deckLabel()`;
- `selectedDifficulty(panel)`;
- `startFromMenu(mode, panel)`;
- `confirmReplaceSavedGame(mode, difficulty)`;
- `showOnboarding(forced)`;
- `showRules(returnAction)`;
- `showSettings(returnAction)`;
- `showPauseMenu()`;
- `showPenaltyIntro()`.

## Explicit Session-adapterek

A menüvezérlő nem kapja meg a teljes `Session` objektumot. Három szűk, explicit adapteren keresztül működik.

### Állapotadapter

A `getState()` az aktuális, csak olvasásra használt állapotot adja át:

- pakli;
- adatforrás;
- adatbázis-metaadatok;
- beállítások;
- aktív játék;
- játékmód;
- nehézség.

### Műveleti adapter

Az `actions` objektum kizárólag a szükséges Session-műveleteket tartalmazza:

- `saveCurrentGame()`;
- `prepareTitleScreen()`;
- `resumeSavedMatch()`;
- `start(mode, difficulty)`;
- `toggleSetting(key, value)`;
- `beginMatch()`.

### Perzisztencia-adapter

A mentési és onboarding-műveletek külön függvényekként kerülnek átadásra:

- `readSaved()`;
- `clearSaved()`;
- `onboardingCompleted()`;
- `setOnboardingCompletedValue(value)`.

A menüvezérlő ezért nem importálja közvetlenül a DOM-ot indításkor használó `mobile-experience.js` modult. Böngésző nélküli Node-tesztben is önállóan importálható, miközben a produkciós Session továbbra is ugyanazokat a meglévő mentési függvényeket adja át.

Az adapterhatár megakadályozza, hogy a menüvezérlő közvetlenül módosítsa a `Session` teljes belső állapotát vagy rejtett globális tárolási függőségeket vegyen fel.

## Session-kompatibilitás

A `Session` korábbi metódusnevei megmaradnak delegáló homlokzatként:

- `_showPanel()`;
- `_hidePanel()`;
- `showTitleScreen()`;
- `_savedTimeLabel()`;
- `_deckLabel()`;
- `selectedDifficulty()`;
- `startFromMenu()`;
- `confirmReplaceSavedGame()`;
- `showOnboarding()`;
- `showRules()`;
- `showSettings()`;
- `showPauseMenu()`;
- `showPenaltyIntro()`.

A külső callbackek és a meglévő belső hívások ezért nem változnak.

## Vissza gomb és overlay-életciklus

Az `overlayReturn` állapot kikerül a `Session` osztályból. A menüvezérlő:

1. panel megnyitásakor eltárolja a visszatérési műveletet;
2. fókuszt ad az első gombnak, inputnak vagy summary elemnek;
3. vissza műveletkor legfeljebb egyszer hajtja végre a callbacket;
4. panel elrejtésekor törli a visszatérési állapotot.

A `Session.handleBackAction()` először továbbra is bezárja a játékos-inspectort, majd a menüvezérlőt kérdezi meg. Ha nincs aktív overlay-visszatérés, az aktív mérkőzés szünetmenüje vagy az alkalmazáskilépés következik.

## Megmaradt működés

Nem változik:

- a főmenü megjelenése és szövege;
- a mentett játék folytatása;
- a Klasszikus és Büntetőpárbaj indítása;
- a nehézségi szintek;
- az onboarding négy oldala;
- a beállítások és azok tárolása;
- a mentett játék törlése;
- a szünetmenü;
- a szabályok tartalma;
- a Büntetőpárbaj-intro;
- a mobil vissza gomb működése;
- a pakliválasztó komponens observeres beillesztése;
- a játékosadatok és grafikai assetek.

## Standalone, PWA és Android

A flattenelt standalone buildben a menüvezérlő a következő függőségek után szerepel:

- játékmotor-konstansok;
- nehézségi regiszter;
- UI és DOM-primitívek;
- mobil élmény és mentési kompatibilitási réteg.

A modul a `js/main.js` előtt kerül a bundle-be. Saját top-level nevei `menuController` előtagot használnak, így nem ütköznek a flattenelt modulokkal.

A PWA cache-verzió `v64`, az új fájl bekerül az offline shellbe. Az Android offline webcsomag a meglévő buildfolyamaton keresztül örökli a modult.

## Tesztelés

Az új `test/menu-controller.test.mjs` ellenőrzi:

- a befagyasztott publikus API-t;
- az overlay megjelenítését és elrejtését;
- az első kezelőelem fókuszálását;
- az egyszer végrehajtott visszatérési callbacket;
- a mentési idő feliratát;
- a valós és tartalék pakli forrásfeliratát;
- a nehézségválasztást és fallbacket;
- a hibás UI-, állapot-, műveleti és perzisztencia-adapterek elutasítását;
- a DOM-függő mobilélmény-import hiányát;
- a szükséges magyar menüszövegek jelenlétét;
- a `Session` integrációját;
- a nagy menü-HTML blokkok eltűnését a `main.js` fájlból;
- a standalone modulrendet;
- a PWA-cache bejegyzést.

A `test/static.test.mjs` továbbra is ellenőrzi a magyar menüszövegeket, de már a tényleges tulajdonosukban, a menüvezérlő modulban.

A teljes mobil-, böngészős runtime-, Klasszikus-, Büntetőpárbaj- és Android-tesztcsomag továbbra is kötelező regressziós védelem.

## Kizárások

Ebben a lépésben nem történik meg:

- külön képernyő-renderer modulok létrehozása;
- az onboarding vagy a menük újratervezése;
- új route- vagy globális state-rendszer bevezetése;
- a játék végeredmény-képernyőjének leválasztása;
- a játék közbeni körvezérlés áthelyezése;
- a prototype-patch UI-rétegek összevonása;
- játékosadat vagy asset módosítása.
