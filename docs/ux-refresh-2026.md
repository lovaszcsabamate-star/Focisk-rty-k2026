# Fociskártyák 2026 – kisebb UX-frissítés

## Elkészült funkciók

- A felhasználó által látható játékmódnév egységesen **Büntetőpárbaj**.
- A Klasszikus végeredmény a valódi körnaplóból számított mérkőzés-statisztikát jelenít meg.
- A kategóriaválasztó a központi kategóriaregiszter csoportjai szerint tagolt.
- A kísérleti kategóriák **Korlátozott adatok** jelzést kapnak.
- A főmenü összefoglalja az aktuális paklit, ellenfelet és játékmódot.
- Az egygombos **Gyors meccs** Klasszikus módot indít véletlen ellenféllel, a mentett kézi ellenfélválasztás felülírása nélkül.
- A mérkőzés közben legfeljebb három lezárt párbaj jelenik meg.
- Az offline cache, standalone build és Android-előkészítés megkapja az új helyi erőforrásokat.

## Architektúra

A statisztika és a párbajtörténet DOM-mentes domainmodulban készül. A kontrollerek csak az állapotot kérik le és továbbítják a UI-nak. A kategóriák végleges eseménykezelése továbbra is kizárólag a kétlépcsős kategóriaválasztó modulban történik.

## Kompatibilitás

- A mentési séma változatlanul `v2`.
- A meglévő játékosadatok és tárolási kulcsok nem változtak.
- A Klasszikus mód és a Büntetőpárbaj közös motor- és mentési szolgáltatásai megmaradtak.
- Nem került be új hálózati függőség, kép, logó vagy betűtípus.

## Ellenőrzés

A GitHub Actions-folyamat futtatja a lintet, buildet, alap- és teljes tesztsort, mobil elrendezési és böngészős runtime teszteket, valamint nyolc determinisztikus mobil/asztali előnézetet készít.
