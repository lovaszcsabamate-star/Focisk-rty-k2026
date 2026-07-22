# Fociskártyák 2026

Magyar nyelvű, HTML–CSS–JavaScript alapú, kocsmai hangulatú összehasonlító kártyajáték a 2025/26-os NB I **440 egyedi játékosból és 464 játékos–klub regisztrációból** álló, MLSZ-elsődleges adatbázisával. Böngészőben, offline PWA-ként, Android-csomag előkészítéssel és egyfájlos Windows-verzióként fut.

## Indítás

### Windows, telepítés nélkül

1. Csomagold ki a teljes projektmappát.
2. Kattints duplán a `JATEK_INDITASA.bat` fájlra.
3. Az indító ellenőrzi, majd megnyitja a `Fociskartyak2026.html` önálló játékfájlt.

Automatizált indítóellenőrzés:

```bat
JATEK_INDITASA.bat --check
```

### Fejlesztői indítás

```bash
npm install
npm start
```

Ezután nyisd meg: `http://localhost:8901`.

## Játékmódok

- **Klasszikus mód:** 52 lapos mérkőzés, öt lapos kéz, körönként felváltott kategóriaválasztás. A győztes viszi a két lapot és az esetleges döntetlenpaklit.
- **Büntetőpárbaj:** mindkét fél 11 lapot kap. Öt rendes párbaj után a matematikailag eldőlt mérkőzés lezárul; döntetlennél hirtelen halál következik. Azonos értéknél nincs gól.

Mindkét mód menthető és oldalfrissítés után folytatható. A játékállás és a játékosprofil külön `localStorage`-kulcson tárolódik.

## Játékosnév

A név legfeljebb 24 karakteres. Mentéskor a rendszer:

- összevonja a fölösleges szóközöket;
- üres névnél a **Játékos** alapnevet használja;
- kizárólag szövegként jeleníti meg;
- célzott újrarendereléssel frissíti az eredményjelzőt, a csatakártya feliratát, a próbálkozássort és a végeredményt;
- új játékban és folytatott mentésben is megőrzi.

A profil kulcsa: `fociskartyak:player-name:v1`. A mérkőzésmentés kulcsa: `fociskartyak:saved-match:v2`.

## Build és önálló játékfájl

```bash
npm run build
```

A build újragenerálja:

- `Fociskartyak2026.html`;
- `data/players-reviewed.json`;
- `data/enrichment-audit.json`;
- az adatbázis-felülvizsgálati jelentéseket.

A build determinisztikus: a GitHub Actions hibára fut, ha a forrás és a verziókezelt standalone fájl eltér.

## Tesztelés

Kötelező helyi ellenőrzés:

```bash
npm install
npm run lint
npm run build
npm test
npm run test:all
npm run test:mobile-layout
```

További parancsok:

```bash
npm run test:e2e
npm run check:standalone
```

A `test:mobile-layout` megtartja a gyors HTML-fixture teszteket, és elindítja a valódi alkalmazást használó Playwright-játékmeneteket is.

### Automatikusan vizsgált képernyők

`320×568`, `360×740`, `360×800`, `375×812`, `390×844`, `412×915`, `480×900`, `720×1280`, `768×1024`, `1024×768`, `1366×768`, valamint `740×360` és `844×390` fekvő mobilnézet.

A teszt hibára fut többek között eltérő csatakártya-méretnél, kártya- vagy VS-átfedésnél, oldalszintű vízszintes görgetésnél, látható kéznél a csatafázisban, eltűnt névnél, dupla kijátszásnál vagy angol játékmódfeliratnál.

Az előnézeti képek helye: `test-artifacts/previews/`.

## Offline és service worker

Az első online megnyitás után a service worker gyorsítótárazza az alkalmazásvázat és az adatforrásokat. Kód és adat esetén hálózat-első, statikus képnél gyorsítótár-első stratégia működik. Új verzió aktiválásakor a régi gyorsítótár törlődik. Az önálló HTML service worker nélkül is fut.

## Android-előkészítés

```bash
npm run mobile:prepare
npm run mobile:add:android
npm run mobile:sync:android
npm run mobile:open:android
```

Az első `mobile:add:android` futtatás csak egyszer szükséges. Az Android Studio és a megfelelő Android SDK külön telepítendő.

## Adatforrási elvek

- Az eredeti `data/players.json` forráspillanatkép változatlan marad.
- Valós mező nem írható felül kitalált vagy becsült értékkel.
- A kluboldali rétegek csak ellenőrzött, nyilvános forrásból származó hiányt pótolhatnak.
- Eltérésnél az MLSZ-adat az elsődleges, az ütközés auditálva marad.
- Hiányzó adat nem jelenik meg a kártyán, és nem válik automatikus játékkategóriává.
- A pontos születési dátum az összehasonlítást vezérli; a kártyán csak a kerekített életkor látható.
- A számított játékospontszám nem látható és nem játékkategória.

A teljes forrásjegyzék: `data/club-official-sources.json`.

## GitHub Actions

Minden normál push és pull request futtatja:

- `npm ci`;
- `npm run lint`;
- `npm run build`;
- a standalone naprakészségi ellenőrzését;
- `npm test`;
- `npm run test:all`;
- `npm run test:mobile-layout`;
- `git diff --check`;
- Windows alatt a `JATEK_INDITASA.bat --check` parancsot.

A workflow nem készít build-commitot. Hiba esetén piros, a böngészős teszttermékeket pedig artifactként megőrzi.

## Ismert korlátozások

- Az első PWA-használat előtt internetkapcsolat szükséges a gyorsítótár feltöltéséhez.
- Az önálló HTML nem frissül automatikusan; új verziónál újra le kell tölteni vagy buildelni.
- Az iOS telepítés kézi, a Safari „Főképernyőhöz adás” funkciójával történik.
- A magasság, játékperc és gólpassz lefedettsége nem elég teljes minden adatbázisszintű kategória aktiválásához.
- A projekt nem tartalmaz játékosfotókat, klubcímereket, MLSZ-logót vagy Transfermarkt-piaci értéket.

## Technikai jelentés

A stabilizáció részletes fájl- és tesztjegyzéke: [`TECHNICAL_REPORT.md`](TECHNICAL_REPORT.md).

## Jogi megjegyzés

A projekt prototípus- és kutatási célú. Nyilvánosan megjelenített MLSZ- és kluboldali tényadatokat használ. Nyilvános vagy kereskedelmi terjesztés előtt külön ellenőrizni kell a felhasználási feltételeket, az adatbázis-jogi kérdéseket, valamint a név- és képmáshasználatot.
