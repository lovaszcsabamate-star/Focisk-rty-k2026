# Fociskártyák 2026 – Beta Stabilization 1.0

Dátum: 2026-08-07

## 1. Kiindulási állapot

A stabilizáció kizárólag a `main` ágból indult. A vizsgált kiinduló `main` head: `b291eafadb13290b3e8fc71d2932dc669e3bb1c9`.

A közvetlenül megelőző stabilizációs változások már rendezték a legnagyobb futásidejű kockázatokat:

- tranzakciós játékindítás és mentés-visszatöltés;
- 20/36/52 lapos Klasszikus meccsek kártyamegmaradási invariánsa;
- hiányos játékosadatok null-biztos kezelése;
- mobil safe-area és CSS-betöltési sorrend;
- időkorlátos Chrome/Chromium smoke tesztek;
- atomikus PWA offline cache.

A projektben külön workflow védi az Android APK-t, a Quick Matchet, a Torna módot, a normalizált adatbázist, a standalone buildet és a teljes projektvalidációt. Egy korábbi, a jelenlegi Torna/Quick Match rétegeket tartalmazó integrációs headen 11 GitHub Actions workflow egyszerre sikeresen lefutott.

## 2. Talált stabilizációs hiányok

### 2.1 A központi PR-validáció túl szűk volt

A `.github/workflows/validate-pull-request.yml` korábban csak:

- `npm ci --ignore-scripts`;
- lint;
- egy UI-komponens teszt;
- egy Torna teszt;
- build;
- `git diff --check`

ellenőrzéseket futtatott.

Ez nem volt elegendő egy Beta kiadási kapunak, mert a PWA cache, accessibility, teljes tesztcsomag, mobil runtime, Quick Match indítási tranzakció és Torna indítási tranzakció külön workflow-kra maradt.

**Javítás:** a központi PR-validáció összevont Beta release gate lett. A specializált workflow-k nem lettek törölve.

### 2.2 A README eltért a tényleges alkalmazásállapottól

A README csak a Klasszikus és Penalties módot sorolta fel, miközben a `main` már Gyors meccs és Torna implementációt is tartalmaz.

Az adatbázis-lefedettségi számok is elavultak voltak. Az aktuális normalizált audit szerint például:

- pontos születési dátum: 440/440;
- nemzetiség: 440/440;
- poszt: 440/440;
- magasság: 285/440;
- mezszám: 288/440.

**Javítás:** a README a jelenlegi 1.2.0 állapothoz, játékmódokhoz, Android workflow-hoz és aktuális adatbázis-audithoz lett igazítva.

## 3. Beta release gate

A központi PR workflow most a következő rétegeket egyetlen kötelező kapuban ellenőrzi:

- reprodukálható `npm ci`;
- központi lint;
- újabb Quick Match/Torna/mobil modulok explicit `node --check` vizsgálata;
- pakliválasztási tranzakció;
- Quick Match autostart regresszió;
- Torna indítási tranzakció;
- `npm test`;
- `npm run test:all`;
- accessibility regresszió;
- PWA shell audit;
- PWA cache regresszió;
- production build;
- standalone build;
- mobil webcsomag;
- mobil layout smoke;
- böngészős runtime smoke;
- az APK-ba kerülő pontos mobil webcsomag runtime smoke tesztje;
- Torna domain és kupaélmény regresszió;
- standalone és mobil build-marker ellenőrzés;
- `git diff --check`.

Az Android APK tényleges Gradle fordítása továbbra is a külön `Android APK` workflow feladata. Ez Java 21 + Android 16 SDK környezetben `assembleDebug` buildet készít.

## 4. Játékmódok állapota

### Klasszikus

A jelenlegi runtime támogatja a 20/36/52 lapos formátumot úgy, hogy a rövid mérkőzés nem vágja fizikailag a paklit. A mentési validátor így minden formátumnál megtartja a kártyamegmaradási invariánst.

### Büntetőpárbaj

A külön játékmotor és mentési logika megmaradt. A Beta gate a teljes `npm test` és `test:all` csomagon keresztül védi.

### Gyors meccs

A `main` külön domain- és storage-réteget tartalmaz. A Beta gate explicit ellenőrzi a közvetlen autostartot és a pakliválasztási tranzakciót, hogy sikertelen indítás ne roncsolja az előző állapotot.

### Torna

A `main` rendelkezik külön Torna domainnel, storage service-szel, Magyar Kupa/kupaélmény réteggel és indítási tranzakciós regresszióval. A Beta gate explicit futtatja ezeket.

A fejlettebb statisztikai és díjrendszer ebben a stabilizációban nem került be.

## 5. Mentési rendszer

A stabil kiadási irányelvek:

- hibás indításnál rollback;
- inkompatibilis mentés ne törlődjön automatikusan;
- másik adatbázishoz/szezonhoz tartozó mentés legyen felismerhető;
- hiányzó játékoskártyát tartalmazó mentés ne tölthető vissza csendben;
- rövid Klasszikus meccseknél is maradjon teljes a runtime kártyakészlete;
- Torna és Quick Match indítás külön tranzakciós teszt alatt álljon.

## 6. PWA/offline és mobil

A `main` tartalmaz:

- PWA shell auditot;
- atomikus CORE/OPTIONAL cache logikát;
- cache regressziós tesztet;
- mobil safe-area javításokat;
- 320–480 px tartományt lefedő mobil smoke infrastruktúrát;
- időkorlátos browser smoke runnert.

A `scripts/mobile-runtime-smoke.mjs` az Android APK-ba másolt pontos `mobile-www/index.html` csomagot futtatja valódi böngészős runtime smoke teszten. Ez fontos automatizált védelem, de **nem helyettesíti a fizikai Android-eszközön végzett manuális lifecycle próbát**.

### Manuális Android release checklist

Kiadás előtt fizikai készüléken külön ellenőrizendő:

1. telepítés és első indítás;
2. offline újraindítás;
3. játék indítása és befejezése;
4. háttérbe küldés és visszatérés;
5. Android rendszer-vissza gomb;
6. mentés megőrzése alkalmazás-újraindítás után;
7. Torna folytatása bezárás után;
8. álló tájolás és safe-area;
9. érintési célok és overlay-ek;
10. APK frissítése korábbi tesztverzió fölé.

## 7. Adatbázis audit

Aktuális normalizált állapot:

| Mező | Ismert | Hiányzó |
|---|---:|---:|
| Játékoskártya | 440 | 0 |
| Pontos születési dátum | 440 | 0 |
| Nemzetiség | 440 | 0 |
| Poszt | 440 | 0 |
| Mérkőzés | 440 | 0 |
| Kezdés | 440 | 0 |
| Gól | 440 | 0 |
| Sárga lap | 440 | 0 |
| Piros lap | 440 | 0 |
| Összes kiállítás | 440 | 0 |
| Magasság | 285 | 155 |
| Mezszám | 288 | 152 |
| Játékperc | 29 | 411 |
| Gólpassz | 29 | 411 |

Kritikus szerkezeti hiba: **0**. Auditfigyelmeztetés: **2**. Megőrzött forrásütközés: **6**.

A következő adatbővítési prioritás a magasság. Hiányzó adat továbbra sem tekinthető 0 statisztikának.

## 8. Régi PR-ok kategorizálása

A régi PR-ok nem lettek automatikusan merge-elve vagy törölve.

### A – funkcionálisan már a main által kiváltott; lezárás javasolt

| PR | Indok |
|---|---|
| #48 – Letölthető játékcsomag | A `main` már külön letölthető csomag workflow-t tartalmaz. |
| #96 – Gyors meccs teljes implementálása | A `main` már újabb Quick Match domaint, storage-réteget, autostartot, card controlst és regressziós teszteket tartalmaz. A régi ág 47 committal eltér a mai `main`-től, ezért nem merge-elendő. |
| #117 – Projektverzió egységesítése | A `main` `package.json` és `project-identity.json` verziója 1.2.0; a célállapot már teljesült. |
| #120 – APK összeállítás futtatása | A `main` már több Android/APK workflow-t és teljes `android-apk.yml` buildfolyamatot tartalmaz. |

### B – részben hasznos, de elavult vagy kockázatos; csak célzott újraimplementálás javasolt

| PR | Megtartható ötlet | Ne vedd át egyben |
|---|---|---|
| #46 – Gameflow hardening | korábbi gameflow/mentés/PWA tanulságok | az egész régi ág; a `main` azóta jelentősen továbbváltozott |
| #47 – Stabil bétaállapot | tesztkapuk és stabilizációs szemlélet | 87 commitnyi régi állapot egyben |
| #68 – architektúra-audit | dokumentációs megállapítások | régi szerkezeti következtetések automatikus alkalmazása |
| #98 – UX refresh | kisebb UX minták | régi UI/runtime módosítások tömeges merge-je |
| #126 – Torna mód v3 | statisztikák, díjak, keretépítés ötlete | v3 mentési séma, DOM-alapú telemetria és globális UI-réteg |
| #128 – biztonságos Torna keret | 11 lapos keret és büntetőrúgó-sorrend koncepció | a jelenlegi `main`-től 32 saját commitnyi eltérés; csak friss mainből újraépítve |
| #130 – Visual Polish 1.0 | főmenü/kártya/torna vizuális ötletek | stacked PR, amely #128-ra épül; közvetlen merge nem biztonságos |

### C – jelenleg tisztán merge-elhető, friss mainre épülő régi PR

**Nincs.**

A következő funkciófejlesztést új, közvetlenül az aktuális `main`-ből indított ágon kell megvalósítani.

## 9. GitHub-struktúra javasolt tisztítása

A Beta Stabilization PR merge-je után javasolt:

- az A kategóriás régi draft PR-ok lezárása;
- a B kategóriás PR-ok lezárása olyan megjegyzéssel, hogy az ötletek külön backlogként maradnak;
- új funkcióhoz mindig friss `main`-ből új branch;
- stacked PR csak akkor, ha a függő PR rövid időn belül merge-elhető és zöld;
- APK/build feladatokra ne maradjon külön történeti feature branch, ha a workflow már a `main` része.

## 10. Fennmaradó problémák és technikai adósság

1. Fizikai Android készülékes lifecycle teszt továbbra is manuális release-feladat.
2. 155 magasságadat és 152 mezszám hiányzik.
3. Játékperc és gólpassz csak 29 játékosnál érhető el, ezért ezekből nem készülhet teljes adatbázisos kategória.
4. Több régi draft PR továbbra is nyitott a repositoryban; ebben a stabilizációban nem lettek automatikusan lezárva.
5. A Torna fejlett statisztikái/díjai csak egy későbbi, explicit egyszeri mérkőzés-finalizálási esemény után építendők be.

## 11. Következő fejlesztési sorrend

1. Torna mód további stabilizálása és explicit egyszeri `matchFinalized` esemény kialakítása.
2. Visual Polish újraimplementálása friss `main` alapján, kizárólag vizuális változtatásokkal.
3. Magasságadatok bővítése hiteles forrásokból.
4. Statisztikai véglegesítési eseményre épülő tornastatisztikák.
5. Tornavégi díjak.
6. Csak ezután további játékmódok.

## 12. Beta kiadási definíció

A Beta akkor tekinthető kiadhatónak, ha a stabilizációs PR központi Beta release gate-je és az Android APK workflow is zöld, és a fizikai Android checklist nem tár fel blokkoló hibát.
