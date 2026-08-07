# Torna UI Cleanup + Tournament Statistics 1.0

## Kiindulási alap

A fejlesztési ág a Visual Polish 1.0 zöld, de még nem merge-elt `feature/visual-polish-1-main` ágának `8b24b76d164f2c2f7613b4a2123648831c7983a4` commitjából indult. A `main` ágat a fejlesztés nem módosítja.

A Tournament Stabilization 1.1 idempotens `finalizeTournamentMatch` folyamata változatlan marad.

## Torna UI audit

### Aktív alapréteg

- `js/tournament-mode.js`
  - alap Torna panel és központ;
  - eredményrögzítés összekötése a Tournament Domainnel;
  - tabella, kupaág és keretválasztás alap DOM-ja;
  - Quick Match alapú mérkőzésindítás.
- `js/tournament/tournament-domain.js`
  - Tournament state és mérkőzésállapotok;
  - idempotens finalizáció;
  - továbbjutás, tabella és szimuláció.
- `js/services/tournament-storage-service.js`
  - aktív torna, pending launch tranzakció és archívum.

### Aktív több-lépcsős UI

- `js/tournament-flow-upgrade.js` és `js/tournament/tournament-flow-*`
  - több-lépcsős tornaindítás és navigációs kompatibilitás.
- `js/tournament-experience-v2.js` és `js/tournament/tournament-experience-v2-*`
  - Magyarország / Nemzetközi / Saját wizard;
  - csapatválasztás;
  - saját torna beállításai;
  - központ, mobil kupaág és döntőélmény.

### Megtartott vizuális kompatibilitási rétegek

- `js/tournament-cup-experience.js`
- `js/tournament/cup-atmosphere.js`
- `js/tournament-rapid-upgrade.js`
- a hozzájuk tartozó stílusok

Ezek jelenleg még szerepelnek a bootstrap-, standalone-, mobil- vagy regressziós útvonalakon. Emiatt ebben a körben nem törölhetők biztonságosan. Eltávolításuk külön konszolidációs ciklust és célzott dependency/regressziós tesztet igényel.

## Megtalált duplikáció

A régi Torna UI saját `playerStats` összesítést is fenntart, miközben a Tournament Stabilization 1.1 strukturált eredménye már a domain finalizációhoz is eljut. Ez több fejlesztési korszak egymásra épülésének maradványa.

A Tournament Statistics 1.0 nem erre a sérülékeny számlálóra épít. Külön, deduplikált eseménysnapshotot tárol, amely a tényleges játékmenet `game.log` párbajaiból készül. A statisztikai dashboard kizárólag ebből és a finalizált tornamérkőzésekből számol.

## Tournament Statistics 1.0 adatforrás

A strukturált tornaeredmény a következő valós eseményadatokat viszi tovább:

- mérkőzésazonosító;
- játékmód;
- saját kezdő keret;
- minden tényleges párbaj sorszáma;
- választott kategória;
- saját játékoskártya azonosítója és neve;
- ellenfélkártya azonosítója és neve;
- párbaj kimenetele: győzelem, döntetlen vagy vereség.

A tárolt analytics segment kulcsa determinisztikus. Ugyanaz a mérkőzés-szegmens ismételt feldolgozáskor nem növeli újra a statisztikát.

## Derived statisztikák

### Csapat

A finalizált Tournament match állapotból számolódik:

- mérkőzés;
- győzelem;
- döntetlen;
- vereség;
- eredménypontok mellette/ellene;
- különbség;
- győzelmi arány;
- liga/csoport esetén pontok.

A meglévő tabella pontszámítási logikája nem változik.

### Játékos

A valódi párbajnaplóból számolódik:

- lejátszott párbaj;
- győztes párbaj;
- döntetlen párbaj;
- elvesztett párbaj;
- győzelmi arány;
- egyedi mérkőzésrészvétel;
- büntetőpárbajos mérkőzésrészvétel.

A legjobb győzelmi arányhoz minimum 3 lejátszott párbaj szükséges.

### Kategória

Csak akkor jelenik meg, ha valódi duel esemény rendelkezésre áll:

- használatok száma;
- győzelmek;
- döntetlenek;
- vereségek;
- győzelmi arány.

Régebbi mentésnél, ahol nincs részletes duel snapshot, a játék továbbra is használható, de a nem rekonstruálható kategória- és párbajstatisztika nem kerül kitalálásra.

## UI cleanup

A Tournament Experience v2 korábban eltávolította az alap `Játékos statisztikák` tabot, majd külön DOM-struktúrát tartott fenn. A Cleanup 1.0 ezt a meglévő tabot újrahasznosítja `Statisztikák` néven és ugyanebbe tölti be a derived dashboardot.

Ezzel kevesebb a felesleges DOM-művelet, és a tabstruktúra továbbra is az adott tornaformához igazodik:

- Következő mérkőzés;
- Tabella vagy Tornaág;
- Eredmények;
- Statisztikák.

A teljes Tournament UI újraírása nem történt meg.

## Mobil és accessibility

A dashboard reszponzív 620 és 340 px guardokat használ. A meglévő Torna wizard, bracket és Visual Polish 320–480 px-es guardjai változatlanul megmaradnak.

A statisztikai elemek szöveges értékeket is tartalmaznak, így nem kizárólag szín alapján értelmezhetők. `forced-colors` fallback is rendelkezésre áll.

## Fennmaradó technikai adósság

A Torna több történeti vizuális réteget tölt be. Ezek összevonása tovább csökkenthetné a CSS/DOM override-ok számát, de ezt csak külön regressziós ciklusban érdemes elvégezni. A jelenlegi kör a bizonyíthatóan biztonságos újrahasznosításra és a statisztikai rétegre korlátozódik.
