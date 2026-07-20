# Fociskártyák 2026

Magyar nyelvű, lerobbant kocsmai hangulatú összehasonlító kártyajáték a 2025/26-os NB I 440 egyedi játékosból álló adatbázisával. Az alkalmazás böngészőben futó ES-modulokkal működik, és mobiltelefonra telepíthető PWA-ként is használható.

## Mobilos telepítés

A GitHub Pages-verzió megnyitása után a játék saját **⬇ Telepítés** gombot jelenít meg mobilon.

- **Android / Chrome:** koppints a Telepítés gombra, majd fogadd el az alkalmazástelepítést. Ha a böngésző nem jelenít meg automatikus ablakot, válaszd a menü **Alkalmazás telepítése** vagy **Hozzáadás a kezdőképernyőhöz** pontját.
- **iPhone / Safari:** koppints a Megosztás gombra, majd válaszd a **Főképernyőhöz adás** lehetőséget.
- A telepített játék saját ikonnal, teljes képernyőn indul, és az első sikeres betöltés után internetkapcsolat nélkül is használható.

A közzétett mobiljáték alapértelmezett címe:

`https://lovaszcsabamate-star.github.io/Focisk-rty-k2026/`

## Indítás

### Egy kattintással Windows alatt

Kattints duplán a `JATEK_INDITASA.bat` fájlra. Az indító az alapértelmezett böngészőben megnyitja az önálló `Fociskartyak2026.html` játékfájlt; Python, Node.js és telepítés nem szükséges hozzá.

Fontos, hogy a két fájl ugyanabban a kicsomagolt mappában maradjon.

### Fejlesztői indítás

```bash
npm start
```

Ezután nyisd meg a `http://localhost:8901` címet. Az `index.html` fájlt nem érdemes közvetlenül megnyitni, mert a böngészők az ES-modulokat és a JSON-adatfájlt `file://` módban korlátozzák.

Az egyfájlos, megosztható változat elkészítése:

```bash
npm run build
```

A kimenet: `Fociskartyak2026.html`.

## Játékmódok

- **Klasszikus mód:** meccsenként 52 véletlenszerű lap, öt lapos kéz. A játékos és a gép körönként felváltva választ kategóriát; a kör győztese viszi a lapokat.
- **Penalties mód:** 11–11 különböző lap, a kategóriaválasztás párbajonként felváltva történik. Öt rendes párbaj, behozhatatlan előnynél korai befejezés, döntetlennél hirtelen halál.

## Kategóriák

A kategóriák központi konfigurációját a `js/data/players.js` tartalmazza. A játék a betöltött adatbázis tényleges kitöltöttsége alapján automatikusan engedélyezi vagy tiltja őket.

A jelenlegi adatbázisból használható kategóriák:

- fiatalabb játékos;
- idősebb játékos;
- több mérkőzés;
- több kezdés;
- magasabb kezdési arány;
- több gól;
- több kerettagság;
- több vagy kevesebb sárga lap;
- több vagy kevesebb kiállítás;
- fegyelmezettebb játékos.

A fiatalabb és idősebb kategória a pontos születési dátumot hasonlítja, a kártyán azonban csak az egész éves életkor jelenik meg.

A konfiguráció elő van készítve a magasság, piaci érték, játékperc, gólpassz, kanadai pont és 90 percre vetített mutatók fogadására is. Ezek csak akkor aktiválódnak, ha az adatbázisban elegendő valós adat áll rendelkezésre. A hatékonysági mutatók minimális játékideje központilag 90 perc.

A korábbi számított játékospontszám nem játékkategória, és nem jelenik meg a kártyákon.

## Adatforrások és bővítés

- `data/players.json`: az eredeti, MLSZ Adatbankra épülő személy–szezon adatbázis 440 egyedi játékossal és 464 játékos–klub regisztrációval.
- `data/club-official-enrichment.json`: változatlan, visszakövethető kluboldali forrásréteg 86 DVTK- és Ferencváros-keretrekorddal.
- `data/club-official-corrections.json`: auditált korrekciós réteg. Három konkrét névformát kapcsol össze, kizárja a csak FTC II.-ben szereplő Tóth Zalán NB I-es illesztését, és a meglévő Abu Fani-rekordot egészíti ki az MLSZ játékosoldal hiányzó adataival.
- `js/data/club-enrichment.js`: klub- és névazonosítással illeszti a forrásokat, megtartja az eredeti rekordazonosítókat, és csak hiányzó mezőt tölt ki.
- Az MLSZ-adat minden esetben elsődleges marad. Meglévő értéket a kluboldali réteg nem ír felül; az esetleges eltérés forrással együtt a metaadatok közé kerül.
- Többklubos játékosnál klubfüggetlen adat tölthető, klubspecifikus mezszám nem.
- Minden kiegészítéshez forrásnév, forrás-URL és ellenőrzési dátum tartozik.

A végleges audit eredménye:

- 85/85 használható hivatalos keretrekord illeszkedett;
- 0 illesztetlen rekord és 0 adatütközés maradt;
- a játékosok száma változatlanul 440, az eredeti azonosítók és sorrend megmaradtak;
- 194 pontos születési dátum, 84 poszt, 84 nemzetiség, 24 magasság és 75 mezszám érhető el;
- Abu Fani meglévő MLSZ-rekordja 17 pályára lépéssel, 9 kezdéssel, 23 kerettagsággal, 5 sárga és 0 piros lappal egészült ki.

A böngészős indításkor a `js/bootstrap.js` egyesíti az eredeti adatbázist, a kluboldali forrásréteget és az auditált korrekciókat. Az önálló HTML összeállításakor ugyanezt a `scripts/build-standalone.mjs` végzi el, így a két változat ugyanazt az adatlogikát használja.

## Hiányzó adatok

- Az ismeretlen értékek `null` vagy üres szöveg formájában maradnak, és nem alakulnak nullává vagy kitalált adattá.
- A `Nincs adat`, `n/a`, kötőjel és hasonló szöveges helyőrzők valódi hiányértékké alakulnak.
- Hiányzó érték helyén a kártya nem jelenít meg üres sort, `Nincs adat`, `NaN` vagy `Infinity` feliratot.
- A kategóriaválasztó csak azokat a kategóriákat mutatja, amelyekhez az adott leosztásban mindkét oldalon van legalább egy használható kártya.
- Az adott kategóriához hiányos kártya nem játszható ki.
- A lebegőpontos mutatókat a rendszer a kategória beállított pontosságával hasonlítja, így a technikai kerekítési eltérés nem dönt el egy párbajt.
- Játékperc, gólpassz és piaci érték továbbra sem kerül becsléssel vagy kitalált értékkel az adatbázisba.

## Teljes forrás újbóli importja

```bash
npm run import:full -- --source-dir /a/kicsomagolt/adatbazis/helye
```

## Fő fájlok

| Fájl | Szerep |
|---|---|
| `js/bootstrap.js` | Az MLSZ-alapadatbázis, a klubforrások és a korrekciók egyesítése |
| `data/club-official-enrichment.json` | Változatlan hivatalos kluboldali forrásrekordok |
| `data/club-official-corrections.json` | Auditált névkorrekciók, kizárások és MLSZ-kiegészítések |
| `js/data/club-enrichment.js` | Veszteségmentes illesztési, hiányérték- és forráskezelési logika |
| `js/data/players.js` | Adatszerződés, normalizálás, kategóriakonfiguráció és automatikus engedélyezés |
| `js/engine.js` | Klasszikus mód tiszta játékszabályai és irányhelyes összehasonlítás |
| `js/penalties.js` | Penalties mód külön állapotgépe |
| `js/ai.js` | Hiányzó adatokat kerülő gépi ellenfél |
| `js/ui.js` | Kártyák, kategóriaválasztó, eredményjelző és reszponzív felület |
| `js/ux.js` | Kártyakezelési és hozzáférhetőségi fejlesztések |
| `js/matchday.js` | Futballmeccs-stílusú eredményjelző |
| `manifest.webmanifest` | Mobilalkalmazás neve, megjelenése és ikonjai |
| `sw.js` | Offline gyorsítótár és hálózati tartalék |
| `js/main.js` | Játékmódválasztás és böngészős játékmenet |
| `test/enrichment.test.mjs` | Kluboldali illesztés, azonosító-megőrzés, kizárás és MLSZ-kiegészítés tesztje |
| `test/data.test.mjs` | A 440 személy / 464 klubregisztráció integritásellenőrzése |

## Ellenőrzés

```bash
npm run lint
npm test
npm run test:all
npm run build
```

## Jogi megjegyzés

A projekt prototípus- és kutatási célú. Nyilvánosan megjelenített MLSZ- és kluboldali tényadatokat használ, de nem tartalmaz játékosfotókat, klubcímereket, MLSZ-logót vagy Transfermarkt-piaci értéket. Nyilvános vagy kereskedelmi terjesztés előtt külön ellenőrizni kell a felhasználási feltételeket, az adatbázis-jogi kérdéseket, valamint a név- és képmáshasználatot.
