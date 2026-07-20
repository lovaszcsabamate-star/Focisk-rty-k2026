# Fociskártyák 2026

Magyar nyelvű, kocsmai hangulatú összehasonlító kártyajáték a 2025/26-os NB I **440 egyedi játékosból és 464 játékos–klub regisztrációból** álló, MLSZ-alapú adatbázisával. Böngészőben, offline PWA-ként és egyfájlos Windows-verzióként is fut.

## Indítás

### Windows

Kattints duplán a `JATEK_INDITASA.bat` fájlra. Ez megnyitja a beágyazott adatbázist tartalmazó `Fociskartyak2026.html` játékfájlt.

### Fejlesztői indítás

```bash
npm start
```

Ezután: `http://localhost:8901`

### Önálló játékfájl készítése

```bash
npm run build
```

A build elkészíti:

- `Fociskartyak2026.html`;
- `data/enrichment-audit.json`.

## Játékmódok

- **Klasszikus mód:** 52 lapos mérkőzés, öt lapos kéz, felváltott kategóriaválasztás.
- **Penalties mód:** 11–11 lap, öt rendes párbaj, döntetlennél hirtelen halál.

A pontos születési dátum csak az összehasonlításhoz használható; a kártyán kizárólag az egész éves életkor jelenik meg. A számított játékospontszám nem látható és nem játékkategória.

## MLSZ-elsődleges adatmodell

Az eredeti `data/players.json` változatlan forráspillanatkép marad:

- 440 egyedi játékos;
- 464 játékos–klub regisztráció;
- 24 többklubos játékos;
- minden eredeti azonosító és MLSZ-statisztika megmarad.

A kluboldali információk külön, visszakövethető rétegekből töltődnek be. Klubadat kizárólag üres mezőt tölthet ki; eltérésnél az MLSZ marad elsődleges.

## Mind a 12 klub hivatalos forrásai

A rendszer az eredeti adatbázisban szereplő valamennyi klub hivatalos oldalát megvizsgálja:

- DVSC;
- DVTK;
- ETO FC;
- Ferencvárosi TC;
- Kisvárda Master Good;
- Kolorcity Kazincbarcika SC;
- MTK Budapest;
- Nyíregyháza Spartacus FC;
- Paksi FC;
- Puskás Akadémia FC;
- Újpest FC;
- ZTE FC.

A teljes forrásjegyzék: `data/club-official-sources.json`.

Az ETO hivatalos keretoldalát is ellenőriztük, de a vizsgálatkor nem adott stabilan feldolgozható szöveges játékoslistát. Emiatt az ETO játékosaihoz nem került becsült vagy bizonytalan klubadat.

## Kluboldali adatfájlok

- `data/club-official-enrichment.json` – DVTK és Ferencvárosi TC;
- `data/club-official-enrichment-2.json` – DVSC és MTK Budapest;
- `data/club-official-enrichment-3-paks-nyir.json` – Paks és Nyíregyháza;
- `data/club-official-enrichment-4-ujpest.json` – Újpest hivatalos profilok;
- `data/club-official-enrichment-5-other.json` – Kisvárda, KBSC, Puskás Akadémia, ZTE és az ETO-forrásellenőrzés;
- `data/club-official-corrections.json` – első név-, dátum- és jogosultsági korrekciós réteg;
- `data/club-official-corrections-2.json` – további névkapcsolások és évadszűrések;
- `data/enrichment-audit.json` – automatikus adatminőségi audit;
- `data/official-data-report.md` – részletes végső beszámoló.

## Végleges audit

A jelenlegi ellenőrzött állapot:

- **293** nyers hivatalos klubrekord;
- **19** dokumentált, MLSZ vagy évad alapján kizárt rekord;
- **274/274** használható hivatalos rekord sikeresen illesztve;
- **0** illesztetlen rekord;
- **0** megmaradt forrásütközés;
- **0** új vagy duplikált játékoskártya;
- **440** játékos és **464** regisztráció változatlanul megmaradt.

### Mezőlefedettség

| Mező | Eredeti | Végleges | Új valós adat |
|---|---:|---:|---:|
| Pontos születési dátum | 120 | 242 | +122 |
| Poszt | 0 | 255 | +255 |
| Nemzetiség | 0 | 170 | +170 |
| Magasság | 0 | 46 | +46 |
| Mezszám | 0 | 209 | +209 |
| További hivatalos klubmetaadat | 0 | 41 játékos | +41 játékos |

A 46 magasságadat még nem elég kiegyensúlyozott a magasságkategória automatikus aktiválásához.

## További hivatalos metaadatok

Ahol a klub egyértelműen közölte, külön metaadatként bekerülhet:

- csapatkapitányi szerep;
- erősebb láb;
- klubhoz érkezés ideje;
- korábbi vagy kölcsönadó klub;
- kölcsönstátusz;
- szerződéshosszabbítás;
- saját nevelésű vagy akadémiai státusz;
- első csapatos felkészülési státusz;
- távozás dátuma és következő klub.

Ezek nem írják felül az MLSZ-statisztikákat, és nem válnak automatikusan játékkategóriává.

## Hiányzó adatok

A `Nincs adat`, `n/a`, kötőjel, `null`, üres szöveg és hasonló helyőrzők valódi hiányértékké alakulnak, és nem jelennek meg a kártyán.

Nem kerül becslésre:

- játékperc;
- gólpassz;
- piaci érték;
- hiányzó magasság;
- nem közölt szerződéses adat;
- bizonytalan mezszám, poszt vagy nemzetiség.

## Többklubos játékosok

A szezonban klubot váltó játékos továbbra is egyetlen kártya marad. A klubonkénti mezszám a `meta.clubShirtNumbers` objektumba kerül; félrevezető általános mezszám nem jelenik meg.

## Ellenőrzés

```bash
npm run lint
npm run build
npm test
npm run test:all
```

A GitHub Actions ezen felül futtatja a `git diff --check` formázási ellenőrzést is. A generált játékfájl és audit csak sikeres ellenőrzés után frissül.

## Fő implementációs fájlok

| Fájl | Szerep |
|---|---|
| `js/bootstrap.js` | Az MLSZ-alapadatok, öt enrichment réteg, két korrekciós réteg és a forrásjegyzék betöltése |
| `js/data/club-enrichment.js` | Veszteségmentes illesztés, névazonosítás, többklubos mezszám és audit |
| `scripts/build-standalone.mjs` | Egyfájlos build és teljes audit létrehozása |
| `sw.js` | Az összes adatfájl offline gyorsítótárazása |
| `test/enrichment.test.mjs` | A 274/274 rekord, 440 azonosító, 464 regisztráció és 0 nyitott eltérés tesztje |
| `test/static.test.mjs` | Böngészős, önálló és offline integráció ellenőrzése |

## Jogi megjegyzés

A projekt prototípus- és kutatási célú. Nyilvánosan megjelenített MLSZ- és kluboldali tényadatokat használ, de nem tartalmaz játékosfotókat, klubcímereket, MLSZ-logót vagy Transfermarkt-piaci értéket. Nyilvános vagy kereskedelmi terjesztés előtt külön ellenőrizni kell a felhasználási feltételeket, az adatbázis-jogi kérdéseket, valamint a név- és képmáshasználatot.
