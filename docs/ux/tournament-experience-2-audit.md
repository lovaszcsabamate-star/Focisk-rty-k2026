# Tournament Experience 2.0 – UX és vizuális audit

Dátum: 2026-08-09

## Kiindulási alap

A fejlesztés a `feat/duel-visual-kickoff-countdown-1` headjére stackelt `feat/tournament-experience-2` ágon indul. Ennek oka, hogy a Tournament Matchday a már elkészült kickoff kaput (`3 → 2 → 1 → Hajrá! → síp`) használja, miközben a #160 még külön felülvizsgálatra vár.

A Torna domain-, mentési-, lineup-, Matchday- és Session Recovery logikája nem része az újratervezésnek.

## Bejárt jelenlegi flow

1. Főmenü → Torna mód.
2. Tournament Experience v3 kupaválasztó: hely + versenysorozat.
3. Tournament Experience v2 wizard: csapatválasztás.
4. Saját kupánál külön beállítási lépés.
5. Összefoglaló → sorsolás.
6. Torna központ.
7. Keretválasztás → Matchday/VS → kickoff → mérkőzés.
8. Eredmény → visszatérés a torna központba.
9. Tabella / tornaág / eredmények / statisztikák.
10. Torna lezárása.

## Fő megállapítások

### 1. Több, egymásra rakódó UI-réteg

A jelenlegi működésben egyszerre van jelen:

- a legacy `js/tournament-mode.js` renderelése;
- `tournament-experience-v2-runtime.js`;
- `tournament-experience-v2-wizard.js`;
- a `tournament-experience-v2.js` v3 kupaválasztója;
- `tournament-ui-improvement.js`;
- további korábbi Torna polish/atmosphere modulok.

A v2/v3 élményréteg funkcionálisan jó irány, de a sok utólagos DOM-patch miatt a vizuális hierarchia nehezen követhető és könnyű ugyanazt az elemet több rétegben formázni.

**Döntés:** nem készül újabb párhuzamos wizard vagy tournament state machine. A meglévő v2/v3 élményréteget konszolidáljuk és annak utolsó vizuális polish rétegét tesszük egyértelművé.

### 2. Tornaindítás

A v3 kupaválasztó már jó progressive-disclosure irány:

- Magyarország / Nemzetközi / Saját felosztás;
- nagy központi serleg;
- külön kupaválasztás;
- külön csapatválasztási lépés.

Megmaradt probléma:

- a csapatképernyő a nagy hero mellett egy teljes mini-klubsort is mutat;
- a véletlen csapat gomb és a mini lista együtt ismétli ugyanazt a navigációs feladatot;
- kisebb kijelzőn a nagy klub + meta + minilista + CTA egyszerre túl sok vizuális célpont.

**Javaslat:** normál Magyar/Nemzetközi tornán a nagy csapat-carousel legyen az elsődleges és gyakorlatilag egyetlen választó. A gyors mini-lista csak nagyobb viewporton vagy másodlagos, visszafogott formában jelenjen meg. Saját kupánál maradhat több kontroll, mert ott valóban több konfiguráció szükséges.

### 3. Futó torna – információs hierarchia

A v2 runtime már leegyszerűsíti a center nézetet, de a képernyő továbbra is a régi center DOM-jára épül. Egyszerre jelenhet meg státusz, következő mérkőzés, tabok, régi overview-rész és másodlagos műveletek.

**Javasolt hierarchia:**

1. torna neve + aktuális forduló, kis státuszsávban;
2. **következő mérkőzés hero** két nagy csapatjelzéssel;
3. egyetlen domináns `MÉRKŐZÉS` CTA;
4. másodlagos navigáció: `Áttekintés | Tabella/Tornaág | Eredmények | Statisztikák`;
5. egyéb műveletek `További lehetőségek` alatt.

### 4. Tabella és tornaág

A v2 runtime már:

- eltávolítja a nem releváns szerkezeti tabot;
- mobilon fordulóválasztót ad a brackethez;
- a saját csapat útvonalát felismeri.

Javítandó:

- a tabella mobilon ne pusztán oszlopok elrejtésével legyen kisebb, hanem kapjon sportközvetítés-szerű sűrű sorokat;
- a bracket mobilon legyen egyértelműen vertikális/egyfordulós fókuszú, ne desktop bracket összenyomása.

### 5. Mérkőzés utáni flow

A runtime már készít fordulóátmeneti blokkot, de az eredmény hatása a tornára nem minden esetben kap elég vizuális súlyt.

**Javaslat:** a meccseredmény után legyen külön, rövid `Hatása a tornára` sor:

- következő szakasz / következő ellenfél;
- bajnokságban pozícióváltozás, ha biztonságosan levezethető a state-ből;
- kiesés vagy tornagyőzelem külön, nagyobb vizuális állapot.

### 6. Klubbranding-technikai adósság

Két külön Torna mapping is duplikálja a már központilag definiált NB I prezentációt:

- `TOURNAMENT_CLUB_PRESENTATION` a `tournament-mode.js` fájlban;
- `TOURNAMENT_UI_CLUB_PRESENTATION` a `tournament-ui-improvement.js` fájlban.

A központi forrás már létezik a `branding.js` alatt, `globalThis.__FOCISKARTYAK_BRANDING__.resolveClubPresentation` API-val.

**Döntés:** a vizuális improvement réteg saját mappingjét megszüntetjük és a central branding API-t használjuk. A legacy `tournament-mode.js` mapping teljes eltávolítása csak akkor történik meg, ha a regressziós teszt bizonyítja, hogy a legacy fallbackre nincs szükség.

### 7. Mobil

Kritikus viewportok:

- 320×568;
- 360×800;
- 390×844;
- 412×915;
- 480 px szélesség.

Fő mobilkockázatok:

- sticky header + sticky CTA együtt túl kevés függőleges teret hagy;
- mini-csapatlista növeli a görgetési zajt;
- hosszú klubnevek;
- bracket szélessége;
- túl sok meta-pill egy sorban.

### 8. Accessibility

Meglévő jó alapok:

- focus-visible stílus;
- ARIA tab/step szerepek;
- billentyűs csapat- és kupaléptetés;
- reduced-motion támogatás;
- legalább 44 px körüli elsődleges érintési célok.

Ezeket az új vizuális hierarchia során meg kell őrizni.

## Új célképernyő-hierarchia

### Tornaindítás

`Kupa/hely → Csapat → [Saját: Beállítások] → Indítás`

### Futó torna

`Státusz → Következő mérkőzés hero → MÉRKŐZÉS CTA → Másodlagos tabok → További lehetőségek`

### Mérkőzés után

`Mérkőzés vége → Győzelem/Vereség → Hatása a tornára → Tovább a tornához`

### Lezárás

`Trófea / torna neve → BAJNOK! vagy torna vége → útvonal/statisztika → új torna / főmenü`

## Megtartandó elemek

- meglévő Tournament domain és storage;
- v2/v3 wizard adatmodell;
- nagy, generált jogtiszta serlegek;
- központi branding-réteg;
- Tournament Lineup 1.1 Matchday;
- #160 kickoff;
- statisztikai adatgyűjtés;
- Session Recovery.

## Összevonandó / háttérbe teendő elemek

- duplikált klubpresentation mappingek;
- mini-csapatlista normál tornán;
- redundáns overview eredménylisták;
- azonos súlyú center-panelek;
- különálló, egymással versengő elsődleges CTA-k.

## Implementációs sorrend

1. branding-konszolidáció a vizuális improvement rétegben;
2. Tournament Experience 2.0 vizuális tokenek és mobil szabályok;
3. csapatválasztó információsűrűség-csökkentése;
4. tournament center next-match hero és tab-hierarchia;
5. bracket/tabella mobil finomhangolás;
6. eredmény/tornahatás vizuális blokk;
7. completion polish;
8. célzott tesztek + teljes regresszió + standalone/PWA/Android gate.
