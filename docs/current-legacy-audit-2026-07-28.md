# Fociskártyák 2026 – aktuális legacy-kód audit

**Dátum:** 2026-07-28  
**Auditált alapág:** `main`  
**Javítási ág:** `refactor/current-legacy-audit-2026-07-28`

## Vezetői összefoglaló

A korábbi architektúra-audit óta a nagyobb technikai adósságok jelentős része már rendeződött. A projekt jelenlegi szerkezete megtartható: külön adatbázis-szolgáltatás, játékmód-factory, DOM-mentes runtime, alkalmazási kontrollerek, tárolási szolgáltatások és explicit UI-enhancement pipeline működik.

Az audit során egy magasabb kockázatú legacy hibakezelési maradványt találtunk. A mobil élmény modul globális `unhandledrejection` eseményből, a képernyőn megjelenő prompt szövegéből próbálta felismerni a gépi kör hibáját, majd teljes oldal-újratöltést indított. Ez nem a hiba tényleges forrásához kapcsolódott, ezért más aszinkron hibát is tévesen gépi körhibának minősíthetett.

A javítás ezt a globális fallbacket megszünteti. A gépi kategória- és kártyaválasztás hibáit most maga a körvezérlő kezeli, az aktuális játékfázis alapján. Helyreállítható esetben újrapróbálási gomb jelenik meg; a teljes oldal és az alkalmazásállapot nem töltődik újra.

## Átvizsgált fő területek

- alkalmazásindítás és adatbázis-betöltés;
- `Session`, `GameRuntime` és játékmód-factory;
- menü-, eredmény- és körvezérlők;
- mentési, storage- és időzítési szolgáltatások;
- UI enhancement rétegek és betöltési sorrend;
- mobil élmény és kapcsolati státusz;
- gépi lépések és félbemaradt körök helyreállítása;
- kapcsolódó regressziós tesztek;
- build-, standalone-, PWA- és ellenőrzési parancsok.

## Már korábban rendezett legacy területek

- Az adatbázis-konfiguráció és betöltés külön registry/service rétegbe került.
- A Klasszikus és Büntetőpárbaj mód közös `GameRuntime` és játékmód-factory mögött működik.
- A nagy `Session` felelősségeinek jelentős része külön menü-, eredmény- és körvezérlőbe került.
- A mentés, localStorage, asset-kezelés és köridőzítés külön szolgáltatást kapott.
- A pakliválasztás domain-, storage- és UI-rétege szét lett választva.
- A korábbi közös UI-prototípus ismételt közvetlen módosítása elkülönített, egymásra épülő osztályrétegekben történik, visszagörgethető betöltési pipeline-nal.
- A globális `setTimeout` felülírás már korábban megszűnt; a gépi lépések explicit időzítési szolgáltatást használnak.

## Most elvégzett javítások

### 1. Globális gépi kör reload-fallback eltávolítása

Eltávolításra került:

- a globális `unhandledrejection` figyelő;
- a DOM prompt szövegére épülő hibafelismerés;
- a `window.location.reload()` alapú helyreállítás;
- a hozzá tartozó globális AI-recovery flag.

### 2. Körszintű, fázishelyes hibakezelés

A körvezérlő most közvetlenül kezeli:

- a gépi kategóriaválasztás hibáját;
- a gépi kártyaválasztás hibáját;
- a mentésből folytatott félbemaradt gépi lépés hibáját;
- az időközben lecserélt játékmenet figyelmen kívül hagyását;
- a busy és interakciós állapot biztonságos visszaállítását.

Helyreállítható fázisban egy **Gépi kör újrapróbálása** gomb jelenik meg. Más fázisban a vezérlő az aktuális játéknézetet építi vissza.

### 3. Egységes időzítési kulcsok

A körvezérlőben megmaradt közvetlen számértékek helyett a központi timing service kulcsai használatosak:

- `HUMAN_CARD_REVEAL`;
- `VERDICT_REVEAL`;
- `RESULT_HOLD`;
- `RESTORED_AI_MOVE`.

Így minden köridőzítés egy helyen konfigurálható és tesztelhető.

### 4. Kapcsolati badge ismételt telepítésének védelme

A kapcsolati állapotjelző telepítése idempotens lett. Ismételt modul- vagy alkalmazásinicializálás esetén nem jönnek létre újabb online/offline eseményfigyelők és párhuzamos badge-példányok.

### 5. Regressziós tesztek

A tesztek most ellenőrzik, hogy:

- nincs globális AI-recovery és oldal-újratöltés;
- valamennyi köridőzítés a timing service-en keresztül történik;
- gépi kategóriaválasztási hiba után megszűnik a foglalt állapot;
- megjelenik a hibaüzenet és az újrapróbálási művelet;
- a kapcsolati badge egyszer települ.

## Megmaradt, alacsonyabb prioritású technikai adósság

### UI enhancement rétegek

A felület továbbra is több, egymásra épülő enhancement modulból áll. A jelenlegi osztályréteges pipeline már lényegesen biztonságosabb a korábbi közös prototype-patchingnél, ezért ez nem sürgős hiba. Hosszabb távon az aktívan használt felülírásokat érdemes fokozatosan visszaolvasztani a célzott UI-komponensekbe.

### CSS javítórétegek

A sok egymás után betöltött CSS-fájl és néhány inline korrekció növeli a specifitási és sorrendfüggőségi kockázatot. Következő külön feladatként vizuális regressziós tesztek mellett lehet őket komponensenként konszolidálni.

### Session proxy metódusok

A `Session` több olyan rövid proxy metódust tartalmaz, amely csak továbbhív a kontrollerekre. Ezek kompatibilitási szempontból ártalmatlanok, de később eltávolíthatók, amikor minden hívó közvetlenül az alkalmazási kontrollereket használja.

### Régi, nyitva maradt fejlesztési PR-ek

Több korábbi, azóta részben vagy egészben meghaladott fejlesztési ág továbbra is nyitott. Ezeket külön ellenőrzés után célszerű lezárni vagy újraalapozni, hogy véletlenül se írják felül a frissebb architektúrát.

## Kockázati értékelés

A mostani változtatás nem módosít:

- játékosadatot;
- játékszabályt;
- pakliméretet;
- AI-döntési logikát;
- mentési sémát;
- megjelenített eredményszámítást.

A módosítás kizárólag a hibák lokalizálását, a körök helyreállítását, az időzítések központosítását és az ismételt eseménytelepítés elkerülését érinti.

## Következő ajánlott lépés

A teljes CI-csomag sikeres lefutása után a javítás biztonságosan beolvasztható. A következő technikai adósságcsökkentő körben a CSS-rétegek és a leggyakrabban felülírt UI-metódusok célzott konszolidációja javasolt, egyszerre csak egy komponenssel és meglévő regressziós tesztek megtartásával.
