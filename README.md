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

A konfiguráció elő van készítve a magasság, piaci érték, játékperc, gólpassz, kanadai pont és 90 percre vetített mutatók fogadására is. Ezek csak akkor aktiválódnak, ha a későbbi adatbázisban elegendő valós adat áll rendelkezésre. A hatékonysági mutatók minimális játékideje központilag 90 perc.

A korábbi számított játékospontszám nem játékkategória, és nem jelenik meg a kártyákon.

## Hiányzó adatok

- Az ismeretlen értékek `null` formában maradnak, és nem alakulnak automatikusan nullává.
- Hiányzó érték helyén a kártya nem jelenít meg üres sort, `Nincs adat`, `NaN` vagy `Infinity` feliratot.
- A kategóriaválasztó csak azokat a kategóriákat mutatja, amelyekhez az adott leosztásban mindkét oldalon van legalább egy használható kártya.
- Az adott kategóriához hiányos kártya nem játszható ki.
- A lebegőpontos mutatókat a rendszer a kategória beállított pontosságával hasonlítja, így a technikai kerekítési eltérés nem dönt el egy párbajt.

## Adatok

- `data/players.json`: 440 egyedi játékos és 464 játékos–klub regisztráció személy–szezon szintű, duplikációmentes leképezése.
- `data/validation.json`: klubtagságok, ismert és hiányzó mezők, valamint a hiányzó értékű kártyák azonosítói.
- Születési dátum: 120 játékosnál ismert.
- Mérkőzés, kezdés, sárga lap és kiállítás: 143 játékosnál ismert.
- Gól: mind a 440 játékosnál ismert.
- Kerettagság: 106 játékosnál ismert.
- Játékperc, gólpassz, magasság és piaci érték a jelenlegi adatfájlban nem áll rendelkezésre, ezért ezekből nem készül kitalált vagy becsült statisztika.

A teljes forrás újbóli, veszteségmentes importja:

```bash
npm run import:full -- --source-dir /a/kicsomagolt/adatbazis/helye
```

## Fő fájlok

| Fájl | Szerep |
|---|---|
| `js/engine.js` | Klasszikus mód tiszta játékszabályai és irányhelyes összehasonlítás |
| `js/penalties.js` | Penalties mód külön állapotgépe |
| `js/data/players.js` | Adatszerződés, normalizálás, központi kategóriakonfiguráció és automatikus engedélyezés |
| `js/ai.js` | Hiányzó adatokat kerülő gépi ellenfél |
| `js/ui.js` | Kártyák, kategóriaválasztó, eredményjelző és reszponzív felület |
| `js/ux.js` | Kártyakezelési és hozzáférhetőségi fejlesztések |
| `js/matchday.js` | Futballmeccs-stílusú eredményjelző |
| `manifest.webmanifest` | Mobilalkalmazás neve, megjelenése és ikonjai |
| `sw.js` | Offline gyorsítótár és hálózati tartalék |
| `js/main.js` | Játékmódválasztás és böngészős játékmenet |
| `test/categories.test.mjs` | Kategóriák, irányok, számított értékek és normalizálás tesztjei |
| `test/rules.test.mjs` | Penalties- és adatszabálytesztek |
| `test/alternating-chooser.test.mjs` | Felváltva történő kategóriaválasztás regressziós tesztje |
| `test/data.test.mjs` | A 440 személy / 464 klubregisztráció integritásellenőrzése |
| `test/simulate.mjs` | Klasszikus mód tömeges szimulációja |

## Ellenőrzés

```bash
npm run lint
npm test
npm run test:all
npm run build
```
