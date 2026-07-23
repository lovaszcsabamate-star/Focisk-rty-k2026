# Fociskártyák 2026 – 13. lépés: játékmód-factory

## Cél

A Klasszikus és Büntetőpárbaj motorok példányosításának, módazonosításának és AI-pakli feloldásának leválasztása a `GameRuntime` osztályról.

A lépés az architektúra-auditban kijelölt `game-mode-factory` felelősséget vezeti be. Nem módosítja a játékszabályokat, az AI döntési logikáját vagy a felületet.

## Korábbi állapot

A `js/game/game-runtime.js` közvetlenül:

- importálta a Klasszikus `Game` motort;
- importálta a `PenaltyGame` motort;
- tárolta a támogatott játékmódok felsorolását;
- eldöntötte, hogy egy mód érvényes-e;
- példányosította a megfelelő motort;
- külön ágon állította össze az AI számára használható paklit.

Ez azt jelentette, hogy egy új játékmód felvétele a runtime belső elágazásainak módosítását igényelte.

## Új modul

`js/game/game-mode-factory.js`

A modul DOM-mentes és a következő publikus elemeket adja:

- `GAME_MODE`;
- `GAME_MODE_DEFINITIONS`;
- `GameModeFactoryError`;
- `createGameModeFactory(options)`;
- `gameModeFactory`.

## Játékmód-definíciók

Minden regisztrált mód explicit definícióval rendelkezik:

- stabil `id`;
- motorlétrehozó `create()` függvény;
- az AI számára használható lapokat feloldó `aiDeck()` függvény.

### Klasszikus mód

- motor: `Game`;
- AI-pakli: a játék teljes `players` listája.

### Büntetőpárbaj

- motor: `PenaltyGame`;
- AI-pakli: a játékos és a gép 11–11 lapos csapatának egyesített listája.

## Factory API

A `createGameModeFactory()` eredménye:

- `modes` – regisztrált módazonosítók;
- `fallbackMode` – alapértelmezett mód;
- `definitions` – érvényesített definíciók;
- `isSupported(mode)` – támogatottság ellenőrzése;
- `normalize(mode)` – hibás mód biztonságos normalizálása;
- `definition(mode)` – szigorú definíció-feloldás;
- `create(mode, options)` – játékmotor létrehozása;
- `aiDeck(mode, game)` – AI-pakli feloldása.

## Kompatibilitás

A korábbi `GameRuntime` konstruktor `gameFactory` opciója megmarad.

A factory ezt kompatibilitási callbackként fogadja, ugyanazzal az argumentummal:

```js
{ mode, players, rng }
```

Így a meglévő tesztek és egyedi motorinjektálások nem törnek el.

A `GAME_MODE` továbbra is importálható a korábbi útvonalról:

```js
import { GAME_MODE } from './game/game-runtime.js';
```

A runtime ezt a factory modulból re-exportálja.

## GameRuntime-integráció

A `GameRuntime`:

- többé nem importálja közvetlenül a `Game` és `PenaltyGame` osztályokat;
- saját factory példányt kap;
- a módnormalizálást a factoryra bízza;
- a motor létrehozását a factoryra bízza;
- visszatöltéskor is a factoryval hozza létre az üres célmotort;
- az AI-paklit a factory definíciójából kapja.

A körvezérlés, a fázisok, az AI-lépések és a mentési payload továbbra is a `GameRuntime` felelőssége.

## Hibakezelés

Strukturált hibakódok:

- `UNKNOWN_MODE`;
- `INVALID_FALLBACK`;
- `INVALID_GAME`;
- `INVALID_AI_DECK`.

A hibás, felhasználói módazonosító továbbra is Klasszikus módra normalizálódik. A szigorú `definition()` hívás viszont ismeretlen módnál hibát ad, hogy a fejlesztői konfigurációs hibák láthatók maradjanak.

## Standalone, PWA és Android

- a factory a standalone modulrendben az engine-ek után, a `GameRuntime` előtt szerepel;
- bekerül a PWA offline cache-be;
- az Android offline webcsomag a meglévő buildfolyamaton keresztül megkapja;
- a standalone flattenelésben a `GAME_MODE` csak egyszer deklarálódik.

## Tesztelés

Az új `test/game-mode-factory.test.mjs` ellenőrzi:

- a két alapértelmezett mód regisztrációját;
- módnormalizálást;
- ismeretlen mód strukturált hibáját;
- valódi Klasszikus motor létrehozását;
- valódi Büntetőpárbaj-motor létrehozását;
- a két eltérő AI-pakli feloldását;
- a korábbi `gameFactory` injektálás kompatibilitását;
- hibás konfigurációk elutasítását;
- DOM-függetlenséget;
- a közvetlen runtime motorimportok eltávolítását;
- a korábbi `GAME_MODE` importútvonal megtartását;
- a standalone modulrendet;
- a PWA-cache bejegyzését.

## Nem része ennek a lépésnek

- új játékmód hozzáadása;
- a Klasszikus vagy Büntetőpárbaj szabályainak módosítása;
- új AI-viselkedés;
- menük vagy módválasztó UI átalakítása;
- mentési séma módosítása;
- a `Session` teljes felbontása;
- rendererek átszervezése.
