# Fociskártyák 2026

Magyar nyelvű, kocsmai hangulatú összehasonlító kártyajáték a 2025/26-os NB I **440 egyedi játékosból és 464 játékos–klub regisztrációból** álló, MLSZ-alapú adatbázisával. Böngészőben, offline PWA-ként és egyfájlos Windows-verzióként is fut.

## Projektazonosítók

- Megjelenített név: **Fociskártyák 2026**
- NPM-csomagnév: `fociskartyak-2026`
- Android alkalmazásazonosító: `hu.fociskartyak.game2026`
- Önálló játékfájl: `Fociskartyak2026.html`
- Kanonikus repónév: `fociskartyak2026`

A jelenlegi GitHub-technikai útvonal a korábbi hibás karakterátalakítás miatt még `Focisk-rty-k2026`. Az alkalmazáskód és a kiadási csomagok már kizárólag a kanonikus Fociskártyák-neveket használják; a technikai útvonal külön kompatibilitási alias.

## Letöltés

### [⬇️ Legújabb önálló játék letöltése](https://github.com/lovaszcsabamate-star/Focisk-rty-k2026/raw/refs/heads/main/Fociskartyak2026.html)

A letöltött `Fociskartyak2026.html` fájl közvetlenül, dupla kattintással megnyitható a böngészőben. Ez a hivatkozás mindig a `main` ág legfrissebb, beágyazott adatbázist tartalmazó verzióját tölti le.

### [📦 Teljes legújabb projekt letöltése ZIP-ben](https://github.com/lovaszcsabamate-star/Focisk-rty-k2026/archive/refs/heads/main.zip)

A teljes csomag tartalmazza a forráskódot, az adatfájlokat, az önálló játékfájlt és a Windows-indítót.

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

A kluboldali információk külön, visszakövethető rétegekből töltődnek be. Klubadat kizárólag üres mezőt tölthet ki; eltérésnél az MLSZ marad elsődleges. Többklubos játékos klubspecifikus mezszáma és szezonstatisztikája külön metaadatba kerül, így nem torzítja a személy-szezon összesítést.

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

Az ETO hivatalos 2025/26-os első csapatos keretéből mind a 28 feldolgozott rekord illeszkedett. A Puskás Akadémia aktuális profiljai közül kizárólag a 2025/26-os MLSZ-kártyához egyértelműen kapcsolható adatok kerültek át. A Kisvárda hivatalos szezonértékeléseiből 30 játékos szereplési, játékperc-, becserélési, gól-, gólpassz- és fegyelmi adata került feldolgozásra.

## Kluboldali adatfájlok

- `data/club-official-enrichment.json` – DVTK és Ferencvárosi TC;
- `data/club-official-enrichment-2.json` – DVSC és MTK Budapest;
- `data/club-official-enrichment-3-paks-nyir.json` – Paks és Nyíregyháza;
- `data/club-official-enrichment-4-ujpest.json` – Újpest hivatalos profilok;
- `data/club-official-enrichment-5-other.json` – Kisvárda, KBSC, Puskás Akadémia és ZTE kiegészítő hivatalos adatai;
- `data/club-official-enrichment-6-eto-puskas.json` – ETO 2025/26-os keret és Puskás hivatalos játékosprofilok;
- `data/club-official-stat-patches-kisvarda.json` – Kisvárda 30 hivatalos 2025/26-os szezonstatisztikai rekordja;
- `data/club-official-corrections.json` – első név-, dátum- és jogosultsági korrekciós réteg;
- `data/club-official-corrections-2.json` – további névkapcsolások és évadszűrések;
- `data/club-official-corrections-3.json` – Puskás névkapcsolások és 2025/26-os jogosultsági kizárások;
- `data/enrichment-audit.json` – automatikus adatminőségi audit;
- `data/official-data-report.md` – részletes végső beszámoló.

## Végleges audit

A jelenlegi ellenőrzött állapot:

- **351** nyers hivatalos keret- és profilrekord;
- **24** dokumentált, MLSZ vagy évad alapján kizárt rekord;
- **327/327** használható keret- és profilrekord sikeresen illesztve;
- **30/30** Kisvárda-szezonstatisztikai rekord sikeresen illesztve;
- **0** kézi ellenőrzésre maradt rekord;
- **0** megmaradt forrásütközés;
- **0** új vagy duplikált játékoskártya;
- **440** játékos és **464** regisztráció változatlanul megmaradt.

### Mezőlefedettség

| Mező | Eredeti | Végleges | Új valós adat |
|---|---:|---:|---:|
| Pontos születési dátum | 120 | 265 | +145 |
| Mérkőzések | 143 | 169 | +26 |
| Kezdések | 143 | 169 | +26 |
| Gólok | 440 | 440 | 0 |
| Kerettagság | 106 | 107 | +1 |
| Játékperc | 0 | 29 | +29 |
| Becserélések | 0 | 29 | +29 |
| Gólpassz | 0 | 29 | +29 |
| Sárga lap | 143 | 169 | +26 |
| Közvetlen piros lap | 143 | 169 | +26 |
| Második sárga utáni kiállítás | 0 | 29 | +29 |
| Összes kiállítás | 143 | 169 | +26 |
| Poszt | 0 | 307 | +307 |
| Nemzetiség | 0 | 170 | +170 |
| Magasság | 0 | 46 | +46 |
| Mezszám | 0 | 261 | +261 |
| További hivatalos klubmetaadat | 0 | 41 játékos | +41 játékos |

A 46 magasságadat még nem elég kiegyensúlyozott a magasságkategória automatikus aktiválásához. A játékperc és a gólpassz is csak 29 játékosnál érhető el, ezért ezekből sem aktiválódik automatikusan teljes adatbázisos játékkategória.

## Kisvárda 2025/26-os szezonstatisztikák

A hivatalos szezonértékelésekből bekerült:

- pályára lépések és kezdések;
- lejátszott percek;
- csereként történt pályára lépések;
- gólok és gólpasszok;
- sárga lapok;
- közvetlen piros lapok;
- második sárga lap utáni kiállítások;
- összes kiállítás.

A 30 rekordból 29 egyklubos játékos fő statisztikáit egészíthette ki. Egy többklubos játékosnál a Kisvárda-adatok kizárólag a `meta.clubOfficialStatsByClub` objektumba kerültek. Két célzott névkapcsolás kellett:

- `Popovics Ilija` ↔ `POPOVICS ILLYA`;
- `Soltész István` ↔ `SOLTÉSZ ISTVÁN ZOLTÁN`.

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

- játékperc vagy gólpassz annál, akinél nincs hivatalos forrás;
- piaci érték;
- hiányzó magasság;
- nem közölt szerződéses adat;
- bizonytalan mezszám, poszt vagy nemzetiség.

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
| `js/bootstrap.js` | Az MLSZ-alapadatok, klubadat-rétegek, korrekciók és hivatalos statisztikai rétegek betöltése |
| `js/data/club-enrichment.js` | Veszteségmentes keret- és profilillesztés, névazonosítás, többklubos mezszám és audit |
| `js/data/club-stat-patches.js` | MLSZ-elsődleges szezonstatisztikai illesztés és többklubos statisztikavédelem |
| `scripts/build-standalone.mjs` | Egyfájlos build és teljes audit létrehozása |
| `sw.js` | Az összes adatfájl offline gyorsítótárazása |
| `test/enrichment.test.mjs` | A 327/327 keret- és profilrekord, 440 azonosító és 464 regisztráció ellenőrzése |
| `test/official-stat-patches.test.mjs` | A 30/30 Kisvárda-statisztika, MLSZ-elsődlegesség és többklubos biztonság tesztje |
| `test/static.test.mjs` | Böngészős, önálló és offline integráció ellenőrzése |

## Jogi megjegyzés

A projekt prototípus- és kutatási célú. Nyilvánosan megjelenített MLSZ- és kluboldali tényadatokat használ, de nem tartalmaz játékosfotókat, klubcímereket, MLSZ-logót vagy Transfermarkt-piaci értéket. Nyilvános vagy kereskedelmi terjesztés előtt külön ellenőrizni kell a felhasználási feltételeket, az adatbázis-jogi kérdéseket, valamint a név- és képmáshasználatot.