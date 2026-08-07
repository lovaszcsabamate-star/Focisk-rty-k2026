# Rövid Klasszikus meccs – mentési invariáns

A 20 és 36 lapos Klasszikus mérkőzés korábban fizikailag levágta a `game.deck` tömb végét. Ettől a `game.players` teljes kártyahalmaza és az aktív kártyazónák lefedése eltért, ezért a szigorú v2 mentési validátor helyesen elutasította a kezdőállapotot.

A javítás nem lazítja a mentési sémát és nem változtatja meg a felhasználó által játszott kártyasorrendet. A teljes pakli a motorban marad, a 20/36/52 lapos választás pedig 10/18/26 párbaj után zárja le a mérkőzést. Így az első 10 vagy 18 párbaj ugyanazokat a kártyákat használja, mint a korábbi levágásos megoldás, miközben minden mentési ponton megmarad a kártyamegmaradási invariáns és a teljes AI referencia-pool.

Regressziós ellenőrzés:

- 20 lapos / 10 párbajos mód;
- 36 lapos / 18 párbajos mód;
- 52 lapos / 26 párbajos mód;
- kezdő és körközi v2 mentések validálása;
- mentés → új runtime → visszaállítás;
- 2000 meccses kártyamegmaradási szimuláció.

A változtatás nem érinti a játék vizuális stílusát, játékosadatbázisát vagy a Büntetőpárbaj szabályait.
