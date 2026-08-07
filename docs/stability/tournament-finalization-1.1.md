# Tournament Stabilization 1.1 – egységes mérkőzés-véglegesítés

## Kiindulási állapot

A stabilizáció előtt a human tornamérkőzés eredményének feldolgozását a `js/tournament-mode.js` UI-hook indította. A hook a `.result-panel` DOM-szövegéből olvasta vissza a JÁTÉKOS–GÉP eredményt, majd külön hívta a `recordTournamentMatch()` vagy `recordTournamentTiebreak()` függvényt, külön frissítette a `playerStats` objektumot, törölte az aktuális match contextet, végül AI-meccseket szimulált és mentette a tornát.

Az AI-meccsek ezzel párhuzamosan a `simulateTournamentMatch()` → `recordTournamentMatch()` útvonalon haladtak. Emiatt a human és AI eredménykezelés ugyanazokat a match objektumokat módosította, de nem volt egyetlen központi, státuszt visszaadó finalizációs belépési pont.

Fő kockázatok:

- a human eredmény üzleti forrása a renderelt DOM volt;
- `recordTournamentMatch()` kész mérkőzésnél csendben változatlan állapotot adott vissza, miközben az utána futó külön `playerStats` frissítés még lefuthatott;
- egy ismételten renderelt eredménypanel elméletileg újraindíthatta a feldolgozási láncot;
- az AI és human útvonal nem rendelkezett közös finalizációs státuszokkal;
- eltérő második eredmény nem volt külön konfliktusként felismerhető.

## Új folyamat

A `js/tournament/tournament-domain.js` tartalmazza az egyetlen központi `finalizeTournamentMatch()` belépési pontot.

```text
Match start
↓
Game engine result
↓
Structured tournament result
↓
UI result hook
↓
finalizeTournamentMatch()
↓
validate + idempotency
↓
record result / request tiebreak
↓
advance tournament
↓
storage save
↓
UI refresh
```

A `ResultController` a játékállapot strukturált `state.result` objektumából hozza létre a Torna számára az eredmény-payloadot. A payload tartalmazza a `tournamentId`, `matchId`, home/away eredményt, győztest, döntési módot és az aktuális lineup statisztikai metaadatait.

A meglévő `MutationObserver` és result-panel hook megmarad kompatibilitási és UI-trigger rétegként, de megfelelő Torna context esetén a domain a strukturált payloadot tekinti mérvadónak; a DOM-ból visszaolvasott fallback érték nem írhatja felül azt.

## Finalizációs státuszok

- `finalized` – az eredmény egyszer rögzítésre került;
- `already-finalized` – a match már végleges, nincs újabb állapotmódosítás;
- `tiebreak-required` – kieséses rendes eredmény döntetlen, külön büntetőpárbaj szükséges;
- `invalid-result` – hibás vagy ellentmondó eredmény;
- `match-not-found` – ismeretlen mérkőzésazonosító.

Az `already-finalized` eredmény konfliktusjelzőt is ad, ha egy második hívás más eredményt próbál ugyanahhoz a `matchId`-hez rendelni.

## Idempotencia

A `COMPLETE` match nem módosítható újra normál finalizációból. Dupla finalizáció esetén:

- a tabella változatlan;
- a kupaág nem épül tovább másodszor;
- a játékosstatisztika nem nő újra;
- az eltérő második eredmény csak konfliktusként jelenik meg a visszatérési értékben.

A `currentMatchId`, `currentMatchMode` és `currentLineupIds` a strukturált eredmény elfogyasztásakor törlődik a következő állapotból. Ez megakadályozza, hogy a régi UI-hook ugyanazt a lineupot ismét statisztikázza.

## Kieséses és büntetőpárbaj

Kieséses rendes mérkőzés döntetlenje nem kaphat `COMPLETE` státuszt. A finalizáló `TIEBREAK` állapotba teszi a match-et és `tiebreak-required` státuszt ad vissza.

A későbbi büntetőpárbaj csak akkor véglegesíthető, ha:

- a match ténylegesen `TIEBREAK` állapotban van;
- a büntetőeredmény nem döntetlen;
- a megadott győztes résztvevő;
- a győztes megfelel a büntetőeredménynek.

## AI

A `simulateTournamentMatch()` most közvetlenül a `finalizeTournamentMatch()` függvényt használja. Az AI és a human match így ugyanazon állapotvalidációs és idempotencia-szabályokon halad át.

## Mentési tranzakció

A finalizáló tiszta állapottranszformáció: mindig klónozott tournament state-en dolgozik. A tartós tárolás csak ezután történik a meglévő `tournamentStorageService` segítségével.

Ha a storage write sikertelen, a korábban mentett tournament state változatlan marad. A regressziós teszt ezt külön ellenőrzi egy szándékosan hibázó storage adapterrel.

## Tesztelt esetek

- egyszeri finalizáció;
- azonos dupla finalizáció;
- eltérő eredménnyel történő dupla finalizáció;
- ismeretlen `matchId`;
- negatív/hibás eredmény;
- liga tabella idempotencia;
- kieséses döntetlen és büntetőpárbaj;
- Magyar Kupa kupaág egyszeri továbbépítése;
- strukturált eredmény elsőbbsége a UI fallbackkel szemben;
- AI-meccsek finalizationVersion/finalizedAt metaadata;
- storage write failure esetén rollback-hatás.

## Fennmaradó technikai adósság

- A régi `tournament-mode.js` result-panel feldolgozó UI-kód továbbra is tartalmaz DOM-parser fallbacket kompatibilitási okból. A strukturált payload mellett ez nem üzleti igazságforrás, de egy későbbi UI-réteg tisztításakor eltávolítható.
- A meglévő játékosstatisztikai nézet egyszerű. Új tornastatisztikák és díjak csak a központi finalizációs eseményre építve készüljenek.
- Régi Torna v3 / lineup / Visual Polish PR-ok ne kerüljenek közvetlenül merge-re; csak friss `main` alapján érdemes a hasznos részeket újraimplementálni.

## Következő ajánlott lépés

A finalizáció stabilizálása után a következő nagyobb kör lehet a Visual Polish tiszta újraimplementálása a friss `main` alapján.
