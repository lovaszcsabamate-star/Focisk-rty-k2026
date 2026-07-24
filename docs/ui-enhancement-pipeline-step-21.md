# Fociskártyák 2026 – 21. lépés: explicit UI enhancement pipeline

## Cél

A korábban külön HTML module-scriptként betöltött, egymásra épülő UX-, mobil-, scoreboard-, reliability-, accessibility- és vizuális rétegek egyetlen explicit, tesztelhető és idempotens betöltési pipeline-ba kerülnek.

Ez a lépés az architektúra-audit sorrendfüggő `UI.prototype` láncára adott biztonságos zárómegoldás. A meglévő, működő enhancement implementációk nem kerülnek egy nagy kockázatú újraírásra; helyettük a betöltési sorrend egyetlen alkalmazási szerződés tulajdona lesz.

## Új modul

Létrejött a `js/ui/ui-enhancement-pipeline.js`.

A pipeline sorrendje:

1. alap UX-réteg;
2. UX-javítások;
3. meccsnapi eredményjelző;
4. ellenfélréteg;
5. mobil élmény és mentési kompatibilitás;
6. játékosprofil;
7. reliability-javítások;
8. inspector- és accessibility-javítások;
9. fókusz- és csataátmenetek;
10. vizuális beállítások tárolása;
11. vizuális rendszer;
12. jogi felület.

A sorrend megfelel a korábbi tényleges HTML-betöltési láncnak, de most már egy befagyasztott konstansban és egységtesztben szerepel.

## Publikus API

- `UI_ENHANCEMENT_MODULES`;
- `UI_ENHANCEMENT_PRELOADED_FLAG`;
- `UiEnhancementPipelineError`;
- `createUiEnhancementPipeline(options)`;
- `installUiEnhancementPipeline()`;
- `uiEnhancementPipeline`.

## Idempotens telepítés

A pipeline:

- sorban, `await` használatával tölti be a modulokat;
- párhuzamos hívásoknál ugyanazt a telepítési Promise-t adja vissza;
- sikeres telepítés után globális előtöltési jelzőt állít;
- ismételt híváskor nem futtatja újra az enhancement rétegeket;
- modulbetöltési hiba esetén megnevezi a hibás modult;
- hiba után újraindítható.

## Böngészős indítás

A `js/bootstrap.js` importálja és megvárja az `installUiEnhancementPipeline()` lefutását még az adatbázis betöltése és a `Session` létrehozása előtt.

Az `index.html` fájlból ezért kikerülnek a külön UX/enhancement module-script tagek. Külön marad:

- a branding;
- a PWA-regisztráció;
- a bootstrap belépési pont.

Így a játék vezérlői csak a teljesen telepített UI-réteggel indulhatnak el.

## Standalone build

A standalone builder továbbra is a már bevált sorrendben lapítja egymás után a régi enhancement modulokat. Ezután következik a pipeline modul, majd a `js/main.js`.

A build előtöltési jelzőt helyez az egyfájlos HTML-be, ezért a pipeline tudja, hogy a rétegek már a flattenelt bundle részeként lefutottak, és nem próbál dinamikus külső modulokat betölteni.

Ez megőrzi az egyfájlos, internet nélküli működést.

## PWA és Android

- a PWA cache-verzió `v67`;
- a pipeline modul bekerül az offline shellbe;
- a legacy enhancement modulok továbbra is cache-elve maradnak;
- az Android offline webcsomag a bootstrap-alapú pipeline-t örökli.

## Megmaradt működés

Nem változik:

- a kártyák megjelenése;
- a zászlók és játékosnevek;
- a scoreboard;
- a mobil toolbar és beállítások;
- az inspector, swipe és fókuszkezelés;
- a reliability-javítások;
- az ellenfélprofilok;
- a csataátmenetek;
- a vizuális és jogi felület;
- a Klasszikus és Büntetőpárbaj működése;
- a standalone, PWA és Android használat.

## Tesztelés

Az új `test/ui-enhancement-pipeline.test.mjs` ellenőrzi:

- a teljes és helyes modulrendet;
- a szekvenciális importot;
- a párhuzamos és ismételt hívások idempotenciáját;
- a preloaded módot;
- a hibaüzenetet és újrapróbálást;
- a bootstrap indítási sorrendjét;
- a külön enhancement script tagek eltűnését;
- a standalone sorrendet és előtöltési markert;
- a service worker bejegyzést.

## Lezárt architekturális cél

A 21. lépéssel az architektúra-audit fő, fokozatosan kijelölt bontásai elkészültek:

- adatbázis-regiszter és központi betöltés;
- játékosmodell;
- konfiguráció, tárolás és mentés;
- timing és session-életciklus;
- játékmód-factory és runtime;
- stabil UI-komponensek;
- pakliválasztási domain, tárolás és UI;
- menü-, eredmény- és körvezérlő;
- explicit UI enhancement betöltési pipeline.

A pipeline a legacy enhancement implementációkat kontrollált határ mögé zárja. Későbbi opcionális belső átírások már nem részei ennek a 21 lépéses refaktorprogramnak.
