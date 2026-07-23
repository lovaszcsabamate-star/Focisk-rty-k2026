# 6. lépés – A játékmenet leválasztása a vizuális rétegről

## Cél

A Klasszikus és a Büntetőpárbaj mód szabályait, AI-lépéseit és menthető mérkőzésállapotát a böngészős DOM-kezeléstől független rétegen keresztül kell vezérelni.

A lépés nem írja újra a már működő szabálymotorokat. A `Game` és `PenaltyGame` továbbra is a szabályok tiszta állapotgépei maradnak. Az új `GameRuntime` a két motor köré épülő, szintén DOM-mentes alkalmazási réteg.

## Új réteg

Fájl:

```text
js/game/game-runtime.js
```

Felelősségei:

- játékmód indítása;
- nehézség és AI-példány kezelése;
- emberi kategóriaválasztás nyilvántartása;
- kategóriaválasztó kártyájának rögzítése;
- AI kategória- és kártyaválasztása;
- emberi válaszkártya kijátszása;
- következő kör vagy párbaj indítása;
- menthető runtime-állapot előállítása;
- mentett motorállapot visszaállítása;
- végeredmény lekérése;
- runtime alaphelyzetbe állítása.

## Rétegek

### Szabálymotor

```text
js/engine.js
js/penalties.js
```

A szabálymotor kizárólag a kártyák, kezek, körök, párbajok, pontok és fázisok állapotát kezeli.

### Játékmenet-runtime

```text
js/game/game-runtime.js
```

A runtime eldönti, melyik motor induljon el, létrehozza az AI-t, és egyértelmű műveleteket biztosít a mérkőzés vezérlésére.

### Böngészős munkamenet

```text
js/main.js
```

A `Session` feladata ezután:

- felhasználói események fogadása;
- animációs késleltetések;
- UI-renderelés;
- panelek és menük;
- böngésző-életciklus;
- localStorage-adapter meghívása.

A `Session` nem példányosít közvetlenül `Game`, `PenaltyGame` vagy `OpponentAI` objektumot, és nem hívja közvetlenül a motor állapotmódosító metódusait.

## Publikus runtime-műveletek

```js
runtime.start(mode, difficulty)
runtime.restore(savedMatch, hydrate)
runtime.reset()
runtime.state()
runtime.availableAttributeKeys()
runtime.selectHumanAttribute(attributeKey)
runtime.commitHumanChooserCard(cardId)
runtime.chooseAiAttribute()
runtime.playHumanCard(cardId)
runtime.playAiCard()
runtime.clearPendingChoice()
runtime.advance()
runtime.result()
runtime.toSavePayload(uxStats)
```

## Állapotátmenetek

### Ember választ kategóriát

1. A UI meghívja a `selectHumanAttribute()` műveletet.
2. A runtime eltárolja a függő kategóriát.
3. A játékos kiválasztja a kártyáját.
4. A `commitHumanChooserCard()` módosítja a szabálymotort.
5. A `playAiCard()` elkéri az AI válaszát és lezárja a kört.
6. A UI csak a visszakapott eredményt rendereli.

### AI választ kategóriát

1. A UI jelzi, hogy a gép gondolkodik.
2. A `chooseAiAttribute()` kiválasztja a kategóriát és a gép lapját.
3. A játékos kiválasztja a válaszkártyát.
4. A `playHumanCard()` lezárja a kört.
5. A UI megjeleníti a visszakapott eredményt.

### Következő kör

A UI egyetlen `advance()` hívást végez. A runtime a módtól függően a `nextRound()` vagy `nextDuel()` szabálymotor-műveletet használja.

## Mentési kompatibilitás

A mentési séma nem változott. A runtime ugyanazokat az adatokat adja át a meglévő storage-adapternek:

- `game`;
- `mode`;
- `difficulty`;
- `pendingAttribute`;
- `awaitingChooserCard`;
- `uxStats`.

A visszaállítás továbbra is a meglévő `hydrateGame()` adaptert használja, de azt a `GameRuntime.restore()` kapja meg függvényként. A runtime ezért nem függ localStorage-tól vagy böngésző API-tól.

## Hibakezelés

A `GameRuntimeError` kódolt domainhibákat ad, például:

- `NO_ACTIVE_GAME`;
- `INVALID_PHASE`;
- `NOT_HUMAN_TURN`;
- `NOT_AI_TURN`;
- `ATTRIBUTE_UNAVAILABLE`;
- `INVALID_SAVE`.

A böngészős `Session` továbbra is felhasználóbarát toast üzenetet jelenít meg, de a hiba felismerése nem a vizuális komponensben történik.

## DOM-függetlenségi szerződés

A runtime nem használhatja az alábbiakat:

- `document`;
- `window`;
- `querySelector`;
- `innerHTML`;
- `HTMLElement`;
- `UI` vagy `el` import;
- renderelő metódusok.

Ezt a `test/game-runtime.test.mjs` és a statikus szerződésteszt is ellenőrzi.

## Tesztelés

Célzott parancs:

```bash
npm run test:game-runtime
```

A teszt ellenőrzi:

- a Klasszikus mód indítását;
- az emberi kategóriaválasztási folyamatot;
- az AI válaszkártyáját;
- az AI kategóriaválasztási folyamatot;
- a következő kör indítását;
- a Büntetőpárbaj mód 11–11 lapos csapatát;
- a menthető payloadot;
- a motor visszaállítását;
- az alaphelyzetbe állítást;
- a DOM- és UI-függőségek hiányát.

## Nem változott

- a 440 játékos rekordja;
- a Klasszikus mód szabályai;
- a Büntetőpárbaj szabályai;
- a pontozás és összehasonlítás;
- az AI nehézségi beállításai;
- a kártyák és panelek vizuális megjelenése;
- a mentési kulcs és a mentés szerkezete;
- a pakliválasztás;
- az adatbázis-kezelő szolgáltatás.

## Következő architekturális lépés

A runtime leválasztása után a következő önálló lépés a vizuális réteg feldarabolása lehet kisebb, stabil UI-komponensekre. Ez nem része a 6. lépésnek.
