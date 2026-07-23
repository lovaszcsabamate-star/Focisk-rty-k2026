# Fociskártyák 2026 – 1. lépés: architektúra-audit

**Dátum:** 2026-07-23  
**Auditált ág:** `main`  
**Cél:** a jelenlegi működés feltérképezése az átszervezés megkezdése előtt.

## 1. Vezetői összefoglaló

A projekt jelenlegi állapotában működőképes, sok célzott teszttel és több stabil, megtartható alrendszerrel rendelkezik. Nem indokolt más keretrendszerben újraépíteni.

A fő probléma nem a játékszabályok minősége, hanem az, hogy az egymás után hozzáadott javítások több, futás közben egymásra épülő rétegen keresztül módosítják ugyanazokat az osztályokat és DOM-elemeket. Ez növeli a regressziók, a sorrendfüggő hibák és a nehezen követhető állapotváltozások kockázatát.

Az első átszervezési cél ezért nem egy nagy új mappastruktúra létrehozása, hanem a jelenlegi adatbetöltés és konfiguráció leválasztása a `bootstrap.js` fájlról. A következő lépésben egy központi adatbázis-manifest és adatbázis-regiszter bevezetése javasolt úgy, hogy a játék tényleges működése még ne változzon.

## 2. Ténylegesen átvizsgált területek

Az audit során ellenőrzött fő fájlok és rendszerek:

- `package.json` – technológiai stack, build-, lint- és tesztparancsok;
- `index.html` – belépési pont, DOM-váz, betöltési sorrend;
- `js/bootstrap.js` – adatbetöltés, korrekciók, enrichment-rétegek;
- `js/main.js` – teljes böngészős munkamenet-vezérlés;
- `js/engine.js` – Klasszikus mód szabályai;
- `js/penalties.js` – Büntetőpárbaj szabályai;
- `js/ui.js` – alap DOM-renderelés és kártyamegjelenítés;
- `js/mobile-experience.js` – mobil élmény, mentés, UI-prototípus módosítások;
- `js/reliability-fixes.js` – megbízhatósági javítóréteg;
- `js/usability-fixes.js` – kezelhetőségi és inspector-javítóréteg;
- `js/deck-selection.js` – véletlen, klub- és nemzetiségi pakliválasztás;
- `js/data/players.js` – normalizálás, validáció és kategória-regiszter;
- `data/players.json` – jelenlegi adatmodell és metaadatok;
- `test/deck-selection.test.mjs` – pakliválasztási tesztek;
- `test/rules.test.mjs` – játékszabály- és adatkezelési tesztek;
- `README.md` – dokumentált működés és adatállapot.

## 3. Jelenlegi technológiai felépítés

A projekt:

- keretrendszer nélküli, natív JavaScript ES-modulokat használ;
- statikus HTML/CSS/JavaScript alkalmazás;
- nincs klasszikus route-rendszer, az oldalak és menük overlayekkel és állapotváltásokkal jelennek meg;
- PWA-ként, helyi webszerverről, Capacitor Android-csomagként és egyfájlos HTML-buildként is használható;
- a tesztek a Node beépített `assert` moduljára és saját smoke-test scriptekre épülnek;
- külső futásidejű függősége gyakorlatilag nincs a Capacitoron kívül.

Ez a stack megtartható. Az átszervezést natív ES-modulokkal kell elvégezni.

## 4. Megtartható elemek

### 4.1. Klasszikus játékmotor

A `js/engine.js` jól elkülönített, nagyrészt tiszta játékszabályokat tartalmaz:

- determinisztikusan tesztelhető véletlengenerátor;
- külön fázisok;
- elkülönített összehasonlítás;
- pakli-, kéz-, döntetlenpakli- és pontkezelés;
- nincs közvetlen DOM-függőség.

Ezt nem kell újraírni. Később csak egy egységes játékmód-interfész mögé kell helyezni.

### 4.2. Büntetőpárbaj-motor

A `js/penalties.js` szintén elkülönített állapotgépet használ, és a fontos szabályokra célzott tesztek vannak:

- 11–11 lap;
- öt rendes párbaj;
- behozhatatlan előny felismerése;
- hirtelen halál;
- 11 lapos szűrt adatbázis kezelése tükrözött, új azonosítójú gépi kártyákkal;
- újrakeverés, ha minden lap döntetlent játszik.

A játékmód neve és felületi szövegei egységesítendők, de a szabálymag megtartható.

### 4.3. Kategória-regiszter és adatkezelési segédfüggvények

A `js/data/players.js` már most tartalmazza a tervezett architektúra több fontos elemét:

- központi kategória-definíciók;
- összehasonlítási irány;
- formázók;
- adatelérhetőség-ellenőrzés;
- pontos születési dátum alapú fiatalabb/idősebb összehasonlítás;
- hiányértékek normalizálása;
- nulla és hiányzó érték helyes megkülönböztetése;
- adatlefedettség alapján aktivált kategóriák.

Ezt külön `categories` és `player-normalizer` modulokra érdemes majd bontani, de a működő logika megtartandó.

### 4.4. Adatforrás-elsődlegesség

A projekt dokumentáltan megőrzi az MLSZ-alapadatokat, és külön enrichment-, korrekciós és statisztikai rétegeket alkalmaz. A források, az ellenőrzési dátumok és az adatbizonytalanság metaadatként jelen vannak.

Az adatvesztés nélküli rétegezés elve megfelelő, ezt az új adatbázis-kezelő rendszerben is meg kell tartani.

### 4.5. Tesztállomány

A projektben sok célzott regressziós, adat-, vizuális, mobil-, szabály- és klubteszt található. Ezek fontos védőhálót jelentenek az átszervezéshez.

A meglévő teszteket nem szabad törölni. Az új modulok bevezetésekor fokozatosan ezek mellé kell új egységteszteket adni.

## 5. Áthelyezendő elemek

### 5.1. Adatbázis-konfiguráció a `bootstrap.js` fájlból

Jelenleg a `bootstrap.js` közvetlenül tartalmazza:

- az alap játékosadat-fájl útvonalát;
- 22 enrichment-fájl útvonalát;
- 5 korrekciós fájl útvonalát;
- 13 statisztikai patch útvonalát;
- a klubforrás-jegyzék útvonalát.

Ez a legnagyobb akadálya az új szezonok és adatbázisok egyszerű hozzáadásának.

Ezeket egy adatbázis-manifestbe és központi regiszterbe kell áthelyezni. A `bootstrap.js` csak a kiválasztott manifestet kérje le és indítsa el a betöltést.

### 5.2. Tárolási kulcsok és verziók

A mentett mérkőzés kulcsa több fájlban is külön konstansként szerepel:

- `js/deck-selection.js`;
- `js/mobile-experience.js`;
- `js/reliability-fixes.js`.

A kulcsokat és verziókat közös konfigurációs modulba kell áthelyezni.

### 5.3. Asset-feloldás

A `js/ui.js` részben központilag kezeli a portrékat, kártyahátlapokat és hátteret, de ez még közvetlen útvonal-generálás a UI-rétegen belül.

Az asset-feloldást később külön `asset-service` modulba kell helyezni, beleértve:

- portrék;
- klublogók;
- zászlók;
- háttérképek;
- fallback képek;
- támogatott kiterjesztések.

## 6. Összevonandó elemek

### 6.1. Mobil-, megbízhatósági és kezelhetőségi UI-javítások

A következő fájlok ugyanazon `UI.prototype` metódusokat egymás után felülírva bővítik:

- `js/mobile-experience.js`;
- `js/reliability-fixes.js`;
- `js/usability-fixes.js`;
- további, az `index.html` által külön betöltött UX- és vizuális rétegek.

Ez sorrendfüggő láncot képez. Egy későbbi fájl csak akkor működik helyesen, ha az előző már lefutott és az elmentett „previous” metódus a várt verzióra mutat.

A javításokat fokozatosan vissza kell olvasztani a tényleges UI-komponensekbe vagy kis, explicit dekorátorfüggvényekbe. Egy metódusnak végül egy elsődleges implementációja legyen.

### 6.2. Pakliválasztás domain- és UI-logikája

A `js/deck-selection.js` egyetlen fájlban kezeli:

- nemzetiség-normalizálást;
- klub- és nemzetiségcsoportosítást;
- jogosultsági szabályt;
- localStorage-kezelést;
- inline CSS létrehozását;
- teljes menü-DOM felépítését;
- MutationObserver használatát;
- oldal-újratöltést.

Ezt legalább három részre kell bontani:

1. pakliszűrési domainlogika;
2. pakliválasztási tárolás/konfiguráció;
3. pakliválasztó felületi komponens.

## 7. Szétválasztandó elemek

### 7.1. `Session` vezérlő

A `js/main.js` `Session` osztálya jelenleg egy helyen kezeli:

- főmenüt;
- onboardingot;
- beállításokat;
- szünetmenüt;
- mentést és visszatöltést;
- játékindítást;
- játékmód-választást;
- AI-lépéseket;
- körvezérlést;
- DOM-frissítések időzítését;
- hibaüzeneteket;
- mobil vissza gombot;
- végeredményt.

A következő fázisokban ezt külön kell választani:

- `game-session-controller`;
- `menu-controller`;
- `save-service`;
- `game-mode-factory`;
- `screen/overlay` rendererek.

A szétválasztás során először csak függvényeket kell kiemelni. Nem szabad egyszerre teljesen új state-kezelést bevezetni.

### 7.2. Játékos-adatmodell

A kért mezők jelenleg több szinten helyezkednek el:

- top-level: `id`, `name`, `club`, `clubs`, `nation`, `position`, `birthDate`;
- `stats`: megjelenések, kezdések, gólok, lapok, magasság, érték stb.;
- `meta`: `clubId`, forrás-URL-ek, adatstátusz, ellenőrzési dátum és egyéb információk.

A modell használható, de nincs egyetlen deklarált séma. A következő migráció során adaptert kell létrehozni, nem pedig a teljes 440 játékos rekordját azonnal átírni.

Első körben a normalizált futásidejű modell kapjon egységes mezőket, miközben a nyers `players.json` változatlan marad.

## 8. Hibás vagy veszélyes elemek

### 8.1. Globális `setTimeout` felülírása

A `js/mobile-experience.js` globálisan lecseréli a `globalThis.setTimeout` függvényt, és a DOM-ban található prompt szövege alapján módosítja a késleltetést.

Ez különösen kockázatos, mert nemcsak az AI-időzítést, hanem az alkalmazás minden későbbi időzítőjét befolyásolhatja. Az AI-késleltetéseket központi konfigurációból, közvetlenül a sessionvezérlőben kell alkalmazni.

### 8.2. UI-prototípusok többszörös felülírása

A futás közbeni prototype-patching nehezen tesztelhető, sorrendfüggő és hibakereséskor nem egyértelmű, hogy egy metódus ténylegesen melyik fájlból származik.

A legveszélyeztetettebb metódusok:

- `renderCard`;
- `renderHands`;
- `renderScores`;
- `showVerdict`;
- `openInspector`;
- `closeInspector`;
- `showOverlay`;
- `_renderSettings`;
- `_renderInspector`;
- `_renderPiles`.

### 8.3. Teljes dokumentumot figyelő MutationObserver

A pakliválasztó egy teljes `document.body` alatti MutationObserverrel keresi az új menüpaneleket. Ez működik, de túl széles megfigyelés, és minden DOM-változásnál lefuthat.

A pakliválasztót a menü létrehozásakor kell explicit módon renderelni.

### 8.4. Globális változók mint rejtett függőségek

A rendszer több globális változót használ:

- `__FOCISKARTYAK_FULL_PLAYER_DATA__`;
- `__FOCISKARTYAK_DECK_SELECTION__`;
- `__EMBEDDED_PLAYER_DATA__`;
- ellenféllel és egyéb vizuális rétegekkel kapcsolatos globális objektumok.

Ezeket fokozatosan explicit konfigurációs objektummal kell kiváltani.

### 8.5. Mentett állapot ellenőrizetlen hidratálása

A `hydrateGame()` a mentett objektum szinte minden tulajdonságát közvetlenül rámásolja az új játékpéldányra. A mentési verzió ellenőrzött, de a belső mezők típusa és konzisztenciája nincs részletesen validálva.

Szükséges:

- játékmódonkénti mentésséma;
- ismert mezők engedélylistája;
- típusellenőrzés;
- migrációs függvények;
- sérült mezők részleges alaphelyzetbe állítása.

### 8.6. Fiktív fallback pakli automatikus használata

A `loadPlayers()` bármilyen betöltési vagy validációs hiba esetén automatikusan 52 fiktív kártyára válthat.

Ez fejlesztői környezetben hasznos, de éles játékban elfedheti az adatbázis hibáját, és ellentétes lehet azzal az elvárással, hogy ne jelenjenek meg kitalált adatok.

Javasolt későbbi működés:

- fejlesztői módban engedélyezett mock adatbázis;
- éles módban érthető hibaállapot és visszalépés;
- a mock használata csak kifejezetten kiválasztott tesztadatbázisként.

### 8.7. Beégetett klubnév-kapcsolatok

A klub szerinti szűrés jelenleg normalizált klubnév-szöveggel történik, nem stabil `clubId` alapján. A futásidejű adatokban ugyan sok rekord `meta.clubId` mezőt tartalmaz, de ezt a pakliválasztás nem használja.

Ez névváltozatok és új szezonok esetén hibalehetőség.

## 9. Biztonságosan törölhető, nem használt elemek

Az audit ezen szakaszában **nem törölhető biztonságosan egyetlen forrásfájl sem**.

Ennek oka, hogy az `index.html` sok javító- és vizuális réteget közvetlenül betölt, miközben ezek egymás prototype-módosításaira és globális változóira épülhetnek. A látszólag ismétlődő fájlok törlése előtt import- és futásidejű függőségi térkép szükséges.

Lehetséges későbbi összevonási jelöltek, de még nem törlendők:

- `ux-fixes.js`;
- `reliability-fixes.js`;
- `usability-fixes.js`;
- mobil kiválasztási és overlay javítórétegek;
- több egymásra épülő vizuális CSS-fájl.

## 10. Tesztelési audit

### Meglévő erősségek

- szabálytesztek a Büntetőpárbaj korai befejezésére és hirtelen halálára;
- 11 lapos szűrt adatbázis tesztje;
- pontos születési dátum összehasonlítása;
- null és nulla érték megkülönböztetése;
- klub- és nemzetiségalapú pakliszűrés;
- sok klub- és adatminőségi regressziós teszt;
- mobil, vizuális, accessibility és runtime smoke-testek.

### Hiányzó vagy fejlesztendő területek

- nincs külön adatbázis-regiszter teszt;
- nincs manifest-séma teszt;
- nincs mentésmigrációs teszt;
- nincs játékmód-factory teszt;
- nincs egyértelmű teszt arra, hogy a prototype-patch betöltési sorrendje stabil;
- a `package.json` tesztparancsai nagyon hosszú, kézzel karbantartott fájllistákat tartalmaznak;
- az audit környezetében a forrásfájlok ellenőrzése megtörtént, de a teljes `npm test` és build futtatása nem történt meg ezen a dokumentációs lépésen.

## 11. Auditkategóriák szerinti összegzés

### Megtartható

- natív ES-modulos technológiai stack;
- Klasszikus játékmotor;
- Büntetőpárbaj játékmotor;
- központi kategória-definíciók;
- normalizáló és összehasonlító függvények;
- MLSZ-elsődleges, rétegezett adatkezelési elv;
- meglévő tesztállomány;
- offline/PWA/standalone build lehetőség.

### Áthelyezendő

- adatfájlútvonalak a `bootstrap.js` fájlból manifestbe;
- tárolási kulcsok központi konfigurációba;
- asset-útvonalak külön szolgáltatásba;
- adatbázis-választás explicit konfigurációba.

### Összevonandó

- egymásra épülő mobil/UX/reliability UI-patchek;
- szétszórt mentési kulcsok;
- pakliválasztás UI-, storage- és domainrészei;
- egymást átfedő vizuális javítórétegek.

### Szétválasztandó

- `Session` osztály felelősségei;
- adatbetöltés és alkalmazásindítás;
- nyers adatmodell és futásidejű normalizált modell;
- UI-renderelés és játékszabályok közötti maradék vezérlési kapcsolat.

### Hibás vagy veszélyes

- globális `setTimeout` felülírás;
- többszörös `UI.prototype` felülírás;
- teljes body-t figyelő MutationObserver;
- rejtett globális függőségek;
- engedélylista nélküli mentéshidratálás;
- automatikus fiktív fallback éles adatbázishiba esetén;
- klubnév alapú kapcsolat stabil klubazonosító helyett.

### Biztonságosan törölhető

- jelenleg nincs igazoltan biztonságosan törölhető forrásfájl;
- törlés csak a későbbi modulmigráció és importtérkép után történhet.

## 12. Javasolt célarchitektúra a jelenlegi stackhez igazítva

A korábban megadott teljes mappastruktúrát nem célszerű egyszerre létrehozni. A natív JavaScript projekthez az alábbi fokozatos célstruktúra megfelelő:

```text
js/
├── app/
│   ├── bootstrap.js
│   ├── configuration.js
│   └── game-session-controller.js
├── database/
│   ├── database-registry.js
│   ├── database-loader.js
│   ├── database-validator.js
│   └── player-normalizer.js
├── game/
│   ├── engine.js
│   ├── penalties.js
│   ├── game-mode-registry.js
│   └── deck-builder.js
├── data/
│   ├── categories.js
│   └── nationality-registry.js
├── services/
│   ├── storage-service.js
│   ├── asset-service.js
│   └── migration-service.js
├── ui/
│   ├── ui.js
│   ├── card-renderer.js
│   ├── menu-renderer.js
│   └── deck-selector.js
└── main.js

data/
└── databases/
    └── hungary-nb1-2025-26/
        ├── manifest.json
        ├── players.json
        ├── clubs.json
        ├── enrichments/
        ├── corrections/
        └── stat-patches/
```

Csak az éppen migrált fájlokhoz szükséges mappák jöjjenek létre.

## 13. Következő végrehajtandó lépés

### 2. lépés – adatbázis-manifest és regiszter bevezetése kompatibilitási réteggel

A következő lépés pontos határa:

1. létrehozni a jelenlegi NB I-adatbázis manifestjét;
2. létrehozni egy `database-registry.js` modult;
3. a jelenlegi hardcoded fájllistákat a manifestből olvasni;
4. a `bootstrap.js` külső viselkedését változatlanul hagyni;
5. nem mozgatni még a 440 játékos rekordját;
6. nem módosítani még a játékmotorokat vagy a UI-t;
7. új tesztet készíteni a manifest és a regiszter ellenőrzésére;
8. futtatni a lintet, az adatbetöltési teszteket, a buildet és a meglévő teljes tesztcsomagot.

Ez adja a legkisebb kockázatú, valódi alapot a későbbi szezonok és adatbázisok egyszerű hozzárendeléséhez.

## 14. Az első lépésben végzett módosítások

- létrejött ez az auditdokumentum;
- külön refaktorág készült;
- alkalmazáskód, adatfájl és játékszabály nem módosult;
- fájl nem került törlésre vagy áthelyezésre;
- az első kódmódosítás a következő, különálló lépés lesz.
