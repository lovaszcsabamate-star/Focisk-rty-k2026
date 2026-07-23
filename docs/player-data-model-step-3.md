# 3. lépés – Egységes játékos-adatmodell

## Cél

A projekt különböző adatforrásai ugyanazt a központi játékosmodellt adják át a pakliválasztásnak és a játékmotoroknak anélkül, hogy a meglévő adatfájlokat vagy játékszabályokat át kellene írni.

## Központi modul

Az adatmodell helye:

```text
js/models/player-model.js
```

A modell verziója:

```text
PLAYER_MODEL_VERSION = 1
```

## Kanonikus mezők

Minden, a játék számára előkészített játékosrekord támogatja az alábbi mezőket:

```text
id
name
displayName
firstName
lastName
dateOfBirth
age
nationality
nationalityCode
clubId
clubName
position
heightCm
marketValue
appearances
minutesPlayed
goals
assists
yellowCards
redCards
cleanSheets
penaltiesScored
penaltiesMissed
image
season
competition
source
sourceUrl
lastUpdated
dataCompleteness
```

A meglévő kompatibilitási mezők továbbra is megmaradnak:

```text
club
nation
birthDate
stats
meta
```

A Klasszikus és a Büntetőpárbaj játékmód ezért továbbra is a korábbi adatstruktúrával működhet, miközben az új fejlesztések már a kanonikus mezőket használhatják.

## Adatbiztonsági szabályok

- A modell nem talál ki hiányzó statisztikát.
- A valódi `0` érték nem alakul át hiányzó adattá.
- Hiányzó numerikus érték `null` marad.
- A `firstName` és `lastName` mező nem készül automatikus névfelbontással, mert az többnemzetiségű neveknél téves adatot hozhatna létre.
- Az életkor mindig a pontos születési dátumból számolódik.
- Az alapértelmezett referencia-dátum továbbra is a 2025/26-os szezon zárónapja: 2026. május 16.
- Az eredeti `stats` objektum változatlanul megmarad.
- Az eredeti játékosazonosító változatlanul megmarad.

## Adatteljesítettség

A `dataCompleteness` mező tartalma:

```text
knownFields
 totalFields
ratio
missingFields
```

Ez csak a ténylegesen ismert mezőket számolja. Nem pótolja vagy becsüli meg a hiányzó adatokat.

## Validáció

A modell három szintet különít el:

```text
errors
warnings
information
```

Kritikus modellhiba például:

- hiányzó azonosító;
- hiányzó név;
- hiányzó klubnév;
- hibás születési dátum;
- negatív vagy nem numerikus statisztikai érték;
- duplikált játékosazonosító.

Figyelmeztetés például:

- hiányzó pontos születési dátum;
- hiányzó nemzetiségi kód;
- hiányzó klubazonosító;
- hiányzó poszt.

## Bekötés az alkalmazásba

A `filterCompleteCardsPayload()` a szűrés előtt automatikusan alkalmazza a központi játékosmodellt.

Ez biztosítja, hogy ugyanaz a modell kerüljön:

- a böngészős játékba;
- a pakliválasztásba;
- az önálló HTML-buildbe;
- az Android offline csomagba.

## Nem módosított elemek

Ebben a lépésben nem változott:

- a 440 játékos forrásadata;
- egyetlen játékos statisztikai értéke;
- a Klasszikus mód;
- a Büntetőpárbaj mód;
- az összehasonlítási szabályok;
- a kártyák megjelenése;
- a klub- és nemzetiségi szűrés.

## Tesztelés

A célzott teszt:

```bash
npm run test:player-model
```

A teszt ellenőrzi:

- mindegyik kanonikus mező jelenlétét;
- a valódi nulla értékek megőrzését;
- a hiányzó értékek `null` állapotát;
- a pontos életkorszámítást;
- a stabil játékosazonosítókat;
- a duplikált azonosítók felismerését;
- mind a 440 rekord változatlan `stats` objektumát;
- a modell használatát a játszható adatbázis szűrésénél.
