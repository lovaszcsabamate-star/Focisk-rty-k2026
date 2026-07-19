# Fociskártyák 2026

Magyar nyelvű, lerobbant kocsmai hangulatú összehasonlító kártyajáték a 2025/26-os NB I teljes, 440 egyedi játékosból álló adatbázisával. Az alkalmazás az eredeti keretrendszer nélkül, böngészőben futó ES-modulokkal működik.

## Indítás

### Egy kattintással Windows alatt

Kattints duplán a `JATEK_INDITASA.bat` fájlra. Az indító az alapértelmezett
böngészőben megnyitja az önálló `Fociskartyak2026.html` játékfájlt; Python,
Node.js és telepítés nem szükséges hozzá.

Fontos, hogy a két fájl ugyanabban a kicsomagolt mappában maradjon.

### Fejlesztői indítás

```bash
npm start
```

Ezután: `http://localhost:8901`. Az `index.html` fájlt nem érdemes közvetlenül megnyitni, mert a böngészők az ES-modulokat és a JSON-adatfájlt `file://` módban korlátozzák. Közvetlen megnyitáshoz a beépített adatokat tartalmazó `Fociskartyak2026.html` fájl való.

Egyfájlos, megosztható változat:

```bash
npm run build
```

A kimenet: `Fociskartyak2026.html`.

## Játékmódok

- **Klasszikus mód:** meccsenként 52 véletlenszerű lap, öt lapos kéz, a kör győztese viszi a lapokat és választja a következő kategóriát.
- **Penalties mód:** 11–11 különböző lap, 5 rendes párbaj, behozhatatlan előnynél korai befejezés, döntetlennél hirtelen halál. Ha mind a 11 lap döntetlennel elfogy, ugyanaz a két tizenegy külön-külön újrakeverődik.

## Kategóriák és hiányzó adatok

Az összehasonlítási kategóriákat a `js/data/players.js` definiálja. A három új/átalakított kategória:

- **Fiatalabb játékos:** a pontos ISO születési dátumot hasonlítja; a későbbi dátum nyer.
- **Több sárga lap:** a nagyobb 2025/26-os érték nyer.
- **Több kiállítás:** az MLSZ-forrás egyetlen piroslap/kiállítás értékét használja. A külön második sárgás bontás ismeretlen marad, nem lesz automatikusan nulla.

Az ismeretlen adat `null`, a felületen **Nincs adat**. Az ilyen lap az érintett kategóriában nem játszható ki. A `0` csak hitelesen ellenőrzött nulla esetén szerepel; a gólösszeg mind a 440 játékosnál rendelkezésre áll, ezért minden leosztás játszható marad.

## Adatok

- `data/players.json`: 440 egyedi játékos, a teljes 464 játékos–klub regisztráció személy–szezon szintű, duplikációmentes leképezése.
- `data/validation.json`: klubtagságok, ismert/hiányzó mezők és a hiányzó értékű kártyák azonosítói.
- Születési dátum: a projekt MLSZ-játékosoldal exportja, illetve ahol elérhető, a forráshivatkozással tárolt CC0 játékosprofil-snapshot.
- Gólok: mind a 440 játékos végleges MLSZ személy–szezon gólösszege.
- A többi részletes statisztika 143 játékosnál ismert; a forrásban még fel nem dolgozott játékosoldalak mezői `null` értéken maradnak.

A teljes forrás újbóli, veszteségmentes importja:

```bash
npm run import:full -- --source-dir /a/kicsomagolt/adatbazis/helye
```

## Fő fájlok

| Fájl | Szerep |
|---|---|
| `js/engine.js` | Klasszikus mód tiszta játékszabályai |
| `js/penalties.js` | Penalties mód külön állapotgépe |
| `js/data/players.js` | Adatszerződés, kategóriák, validáció |
| `js/ai.js` | Hiányzó adatokat kerülő gépi ellenfél |
| `js/ui.js` | Kártyák, eredményjelző, kísérletek, kapcsolók és reszponzív felület |
| `js/main.js` | Játékmódválasztás és böngészős játékmenet |
| `test/rules.test.mjs` | Célzott Penalties- és adatszabálytesztek |
| `test/data.test.mjs` | A 440 személy / 464 klubregisztráció integritásellenőrzése |
| `test/simulate.mjs` | Klasszikus mód tömeges szimulációja |

## Ellenőrzés

```bash
npm test
npm run test:all
npm run build
```
