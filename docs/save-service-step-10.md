# Fociskártyák 2026 – 10. lépés: verziózott save-service

## Cél

A mérkőzésmentés és a visszaállítás leválasztása a mobil UI-rétegről, valamint a mentett játékmotor-állapot részletes ellenőrzése a hidratálás előtt.

A lépés nem változtatja meg a felhasználók meglévő mentési kulcsát vagy a `version: 2` mentési borítékot.

## Új modul

`js/services/save-service.js`

A modul felelőssége:

- mentési boríték létrehozása;
- mentés olvasása, írása és törlése;
- támogatott mentési verziók kezelése;
- Klasszikus és Büntetőpárbaj állapot validálása;
- kizárólag engedélyezett mezők hidratálása;
- sérült vagy ismeretlen állapot elutasítása;
- hibás JSON és nem elérhető tárhely biztonságos kezelése.

## Megmaradó kompatibilitás

Változatlan marad:

- storage-kulcs: `fociskartyak:saved-match:v2`;
- borítékverzió: `2`;
- `savedAt`;
- `mode`;
- `difficulty`;
- `pendingAttribute`;
- `awaitingChooserCard`;
- `uxStats`;
- `game`;
- a `mobile-experience.js` korábbi publikus mentési exportjai.

A `mobile-experience.js` kompatibilitási façade-ként továbbra is exportálja:

- `readSavedMatch()`;
- `writeSavedMatch()`;
- `clearSavedMatch()`;
- `hydrateGame()`.

Az implementáció azonban már teljes egészében a save-service-ben található.

## Mentési boríték validációja

A service ellenőrzi:

- a támogatott verziót;
- a játékmódot;
- a nehézség szöveges azonosítóját;
- a függőben lévő kategóriát;
- a választókártyára váró állapotot;
- a mentési időbélyeget;
- az UX-statisztika típusát;
- a játékmotor módjának és a boríték módjának egyezését.

Érvénytelen időbélyeg önmagában nem teszi használhatatlanná a mentést, de figyelmeztetést eredményez és a felület általános mentési feliratot mutat.

## Közös játékmotor-validáció

Mindkét módnál ellenőrzött:

- játékmód;
- fázis;
- választó oldal;
- aktív kategória;
- játéknapló;
- utolsó eredmény;
- forráspakli mérete;
- kör/párbaj és napló konzisztenciája;
- kijátszott kártyák fázisnak megfelelő állapota.

## Klasszikus mód

Ellenőrzött zónák:

- teljes játékospakli;
- húzópakli;
- emberi és gépi kéz;
- megnyert lapok;
- döntetlenpakli;
- kijátszott lapok.

A service biztosítja, hogy:

- minden kártyaazonosító ismert legyen;
- a zónák ne tartalmazzanak tiltott duplikációt;
- a zónák pontosan lefedjék a játékban lévő paklit;
- kategóriaválasztáskor ne legyen kijátszott lap;
- kártyaválasztáskor csak a választó lapja legyen kijátszva;
- felfedéskor mindkét lap és az aktív kategória rendelkezésre álljon;
- lezárt Klasszikus játékban ne maradjon aktív kijátszás.

## Büntetőpárbaj mód

Ellenőrzött elemek:

- pontosan 11–11 csapatkártya;
- kéz és felhasznált lapok;
- kijátszott lapok;
- gólok;
- kísérletek;
- párbajszám;
- ciklus;
- hirtelen halál;
- kategóriagyőzelmek;
- lezárási szakasz és ok.

A service biztosítja, hogy:

- a kéz és a felhasznált lapok a megfelelő csapathoz tartozzanak;
- a csapatzónák konzisztensen lefedjék a 11 lapot;
- a kísérletek és a felhasznált lapok száma megegyezzen;
- ne legyen több gól, mint lezárt párbaj;
- a felfedett és lezáró lapok szerepeljenek a felhasznált lapok között;
- minden kategóriagyőzelem ismert kategóriához és nem negatív egész értékhez tartozzon.

## Biztonságos hidratálás

A korábbi megoldás a mentett objektum valamennyi tulajdonságát átmásolta az új motorpéldányra.

Az új `hydrateGame()`:

1. megállapítja a játékmódot;
2. teljesen validálja a mentett motorállapotot;
3. csak a módhoz tartozó engedélyezett mezőket másolja át;
4. kihagyja az ismeretlen mezőket;
5. nem hidratálja a mentett `rng` értéket;
6. a véletlengenerátort biztonságosan `Math.random` értékre állítja.

Ez megakadályozza, hogy hibás, régi vagy manipulált plusz mezők kerüljenek a motorpéldányra.

## Hibakezelés

A részletes API-k validációs eredményt adnak:

- `ok`;
- `value`;
- `errors`;
- `warnings`.

A hidratálási hibák `SaveValidationError` kivételt dobnak `INVALID_SAVE` kóddal. A meglévő Session ezt továbbra is elkapja, törli a sérült mentést és érthető felületi üzenetet jelenít meg.

## Publikus API

- `SUPPORTED_SAVE_VERSIONS`;
- `SaveValidationError`;
- `validateSavedGameState(mode, game)`;
- `validateSavedMatch(snapshot)`;
- `createSavedMatchSnapshot(payload, now)`;
- `hydrateGame(instance, savedState)`;
- `createSaveService(options)`;
- `saveService`;
- `inspectSavedMatch()`;
- `readSavedMatch()`;
- `writeSavedMatch(payload)`;
- `clearSavedMatch()`.

## Tesztelés

`test/save-service.test.mjs` valós normalizált játékosadatokkal ellenőrzi:

- a v2 Klasszikus mentést;
- a v2 Büntetőpárbaj mentést;
- a mentési időbélyeget;
- a memóriatárolós olvasást és írást;
- a köztes kártyaválasztási állapotot;
- a félbehagyott emberi kategóriaválasztást;
- a duplikált és hiányzó kártyák elutasítását;
- az ismeretlen fázis elutasítását;
- a nem támogatott verzió elutasítását;
- az ismeretlen plusz mezők kihagyását;
- a negatív Büntetőpárbaj-eredmény elutasítását;
- a lezárt játék mentésének mellőzését;
- a hibás JSON biztonságos kezelését;
- a standalone modulrendet;
- a PWA-cache bejegyzését.

## Nem része ennek a lépésnek

- a mentési verzió növelése;
- új felhőalapú mentés;
- több mentési slot;
- felhasználói fiók;
- mérkőzés-visszajátszás;
- a játékszabályok vagy kártyaadatok módosítása.
