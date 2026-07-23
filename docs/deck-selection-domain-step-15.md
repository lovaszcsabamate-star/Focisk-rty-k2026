# Fociskártyák 2026 – 15. lépés: pakliválasztási domainlogika

## Cél

A klub- és nemzetiségalapú pakliválasztás tiszta üzleti szabályainak leválasztása a tárolási és DOM-felületi kódról.

A lépés nem változtatja meg:

- a választható klubokat vagy nemzetiségeket;
- a legalább 11 kártyás jogosultsági szabályt;
- a mentett pakliválasztás formátumát;
- a menü megjelenését;
- a Klasszikus vagy Büntetőpárbaj mód szabályait.

## Korábbi állapot

A `js/deck-selection.js` egyetlen fájlban tartalmazta:

- a nemzetiség-aliasokat;
- a magyar zászló- és megnevezés-regisztert;
- a klubnevek normalizálását;
- a játékoscsoportok összesítését;
- a minimum 11 lapos jogosultsági szabályt;
- a választás normalizálását és összehasonlítását;
- a játékoslista szűrését;
- a payload módosítását;
- a localStorage-kezelést;
- az inline CSS-t;
- a teljes menü-DOM felépítését;
- a MutationObserver-alapú felületbekötést.

Ez megnehezítette a domainlogika külön tesztelését és későbbi újrafelhasználását.

## Új modul

`js/domain/deck-selection-domain.js`

A modul DOM- és tárolásfüggetlen.

Publikus API:

- `MIN_FILTERED_DECK_SIZE`;
- `RANDOM_DECK_SELECTION`;
- `canonicalClubKey(value)`;
- `canonicalNationKey(value)`;
- `nationPresentation(value)`;
- `buildDeckSelectionOptions(players, minimum)`;
- `normaliseDeckSelection(selection)`;
- `selectionEquals(left, right)`;
- `resolveDeckSelection(players, selection)`;
- `validateDeckSelection(players, selection, minimum)`;
- `describeDeckSelection(selection, players)`;
- `applyDeckSelectionToPayload(payload, selection)`.

## Klubnormalizálás

A `canonicalClubKey()`:

- eltávolítja az ékezetkülönbségeket;
- kisbetűsít;
- egységesíti az elválasztó karaktereket;
- figyelmen kívül hagyja a fölösleges szóközöket.

Ez megőrzi a korábbi viselkedést, és külön, névvel ellátott domainműveletté teszi a klubazonosítást.

## Nemzetiség-normalizálás

A korábbi alias- és megjelenítési regiszter változatlan tartalommal került át.

Példák:

- `Magyarország`, `Magyar`, `HUN` → `hungary`;
- `Szerbia`, `Szerb`, `SRB` → `serbia`;
- `Román`, `ROU`, `ROM` → `romania`.

A `nationPresentation()` továbbra is zászlóemojit és magyar megnevezést ad vissza. Ismeretlen értéknél a földgömb fallback marad.

## Jogosultsági szabály

A szűrt klub- vagy nemzetiségi pakli csak akkor érvényes, ha legalább 11 használható játékost tartalmaz.

Ha egy korábban mentett választás már nem érvényes:

- a rendszer véletlen paklira esik vissza;
- az aktív játékoslista a teljes adatbázis másolata lesz;
- a validáció `valid: false` eredményt ad.

## Payload-integráció

Az `applyDeckSelectionToPayload()` továbbra is támogatja:

- a közvetlen játékostömböt;
- a teljes adatbázis-payloadot;
- a `deckSelection` metaadatot;
- a beágyazott `selection.deckSelection` kompatibilitási mezőt.

A metaadat változatlanul tartalmazza:

- a választás típusát és értékét;
- a magyar leírást;
- az elérhető kártyák számát;
- a minimum 11 lapos követelményt.

## Kompatibilitási homlokzat

A `js/deck-selection.js` továbbra is exportálja a korábbi domain API teljes felületét.

Ezért a meglévő importok változatlanul működnek:

```js
import {
  buildDeckSelectionOptions,
  resolveDeckSelection,
  validateDeckSelection,
} from './deck-selection.js';
```

A fájl azonban már a `js/domain/deck-selection-domain.js` modulból importálja és re-exportálja ezeket.

## A `deck-selection.js` megmaradó felelőssége

Ebben a lépésben a kompatibilitási modulban marad:

- a tárolási kulcsok bekötése;
- a választás beolvasása és mentése;
- a mentett mérkőzés törlésének megerősítése;
- az inline CSS;
- a pakliválasztó DOM-komponens;
- a menü és szabálypanel MutationObserver-alapú kiegészítése.

Ezek további, külön lépésekben választhatók le.

## Standalone, PWA és Android

- a domainmodul a standalone sorrendben a `deck-selection.js` előtt szerepel;
- a kompatibilitási re-export nem hagy érvénytelen ES-modul szintaxist a flattenelt HTML-ben;
- a modul bekerül a PWA offline cache-be;
- a PWA cache-verzió emelkedik;
- az Android offline webcsomag a meglévő buildfolyamaton keresztül megkapja.

## Tesztelés

Az új `test/deck-selection-domain.test.mjs` ellenőrzi:

- a minimum 11 lapos szabályt;
- a klub- és nemzetiség-normalizálást;
- a magyar megjelenítési adatokat;
- a csoportosítást és rendezést;
- a választás normalizálását;
- a szemantikusan azonos választások összehasonlítását;
- a klub- és nemzetiségszűrést;
- az érvénytelen választás visszaesését;
- a leírásokat;
- a tömb- és objektumpayload támogatását;
- a DOM- és tárolásfüggetlenséget;
- a régi importútvonal kompatibilitását;
- a standalone modulrendet;
- a service worker cache-bejegyzést.

A meglévő `test/deck-selection.test.mjs` változatlanul a régi importútvonalon fut, így külön regressziós védelmet biztosít.

## Nem része ennek a lépésnek

- a pakliválasztó UI vizuális átalakítása;
- a tárolási adapter külön modulba emelése;
- a MutationObserver eltávolítása;
- új pakliválasztási típus;
- az adatbázisban lévő klub- vagy nemzetiségadatok módosítása;
- új játékmód;
- új klublogó vagy zászló bekapcsolása.
