# Fociskártyák 2026 – 12 klubos hivatalos adatellenőrzés

Ellenőrzés dátuma: **2026-07-20**  
Szezon: **2025/26 – Fizz Liga (NB I)**  
Elsődleges adatforrás: **MLSZ Adatbank**

## Alapelvek

- A `data/players.json` változatlan forráspillanatkép maradt.
- A 440 eredeti játékos, 464 játékos–klub regisztráció, az azonosítók és a sorrend megmaradt.
- Kluboldali adat csak hiányzó mezőt tölthet ki.
- Aktuális, de 2025/26-os MLSZ-kártyához nem kapcsolható profil nem hozhat létre új játékost.
- Többklubos játékosnál a klubonkénti mezszám külön metaadatba kerül; az általános mezszám nem lesz félrevezető.
- Az összes kizárás, névkorrekció és eltérés külön auditálható.

## Klubszintű eredmény

| Klub | MLSZ-kártyák | Kluboldali rekordok | Illesztett | Kizárt | Ellenőrzendő | Hivatalos forrás státusza |
|---|---:|---:|---:|---:|---:|---|
| DVSC | 38 | 43 | 36 | 7 | 0 | Strukturált idénykeret |
| DVTK | 45 | 44 | 44 | 0 | 0 | Strukturált idénykeret |
| ETO FC | 35 | 0 | 0 | 0 | 0 | Hivatalos oldal ellenőrizve, stabil szöveges keret nem volt kinyerhető |
| Ferencvárosi TC | 42 | 42 | 41 | 1 | 0 | Strukturált idénykeret |
| Kisvárda Master Good | 38 | 1 | 1 | 0 | 0 | Hivatalos hír- és játékosprofil-adat |
| Kolorcity Kazincbarcika SC | 40 | 19 | 16 | 3 | 0 | Hivatalos keret- és átigazolási adatok |
| MTK Budapest | 36 | 32 | 32 | 0 | 0 | Strukturált idénykeret |
| Nyíregyháza Spartacus FC | 39 | 32 | 32 | 0 | 0 | Hivatalos játékoskeret |
| Paksi FC | 33 | 28 | 27 | 1 | 0 | Hivatalos játékoskeret |
| Puskás Akadémia FC | 34 | 2 | 2 | 0 | 0 | Hivatalos első csapatos és akadémiai információk |
| Újpest FC | 41 | 26 | 21 | 5 | 0 | Hivatalos játékosprofilok, MLSZ-szezonszűréssel |
| ZTE FC | 43 | 24 | 22 | 2 | 0 | Hivatalos játékosprofilok és kiemelt szerepek |
| **Összesen** | **464 regisztráció / 440 játékos** | **293** | **274** | **19** | **0** | **Mind a 12 klub hivatalos oldala megvizsgálva** |

## Mezőlefedettség

| Mező | Eredeti kitöltöttség | Végleges kitöltöttség | Új valós adatok |
|---|---:|---:|---:|
| Pontos születési dátum | 120 | 242 | +122 |
| Mérkőzések | 143 | 144 | +1 |
| Kezdések | 143 | 144 | +1 |
| Gólok | 440 | 440 | 0 |
| Kerettagság | 106 | 107 | +1 |
| Sárga lap | 143 | 144 | +1 |
| Piros lap | 143 | 144 | +1 |
| Összes kiállítás | 143 | 144 | +1 |
| Poszt | 0 | 255 | +255 |
| Nemzetiség | 0 | 170 | +170 |
| Magasság | 0 | 46 | +46 |
| Mezszám | 0 | 209 | +209 |
| További hivatalos klubmetaadat | 0 | 41 játékos | +41 játékos |

A magasság lefedettsége továbbra is túl alacsony és klubonként egyenetlen ahhoz, hogy automatikusan játékkategóriává váljon.

## Fontos névkorrekciók

A célzott névkapcsolások között szerepel többek között:

- `Makreckis Cebrail` ↔ `MAKRECKIS CEBRAILS`;
- `Cadu` ↔ `LOPES CRUZ CARLOS EDUARDO`;
- `Abu Fani Mohammed` ↔ `ABU FANI MOHAMMAD`;
- `Gordić Đorđe` ↔ `GORDIC DORDE`;
- `Manzanara Francisco` ↔ `LOPEZ DE LA MANZANARA DELGADO FRANCISCO JESUS`;
- `Varazdat Harojan` ↔ `HAROYAN VARAZDAT`;
- `Mihajlo Meszhi` ↔ `MYHAILO MESKHI`.

## MLSZ–kluboldal eltérések

- Kulbachuk Viacheslav és Josua Mejías esetében az eltérő kluboldali születési dátum helyett az MLSZ-adat maradt.
- Bárány Donát és Álex Bermejo hibás vagy eltérő kluboldali dátuma nem került át.
- Aktuális Újpest-, Paks- és ZTE-profilok csak akkor illeszkedtek, ha már volt azonos klubhoz tartozó 2025/26-os MLSZ-kártya.
- Muhamed Tijani aktuális Újpest-profilja nem írta át a 2025/26-os, más klubhoz kapcsolódó szezonrekordot.

## Kizárások

Összesen 19 kluboldali rekord került dokumentált kizárásra. A fő okok:

- csak NB II-es, NB III-as, második csapatos vagy utánpótlás-szereplés;
- nem igazolható 2025/26-os Fizz Liga-regisztráció;
- évad utáni új igazolás vagy aktuális profil;
- a 2025/26-os MLSZ-kártya más klubhoz tartozik.

A részletes indoklás és forrás a következő fájlokban található:

- `data/club-official-corrections.json`;
- `data/club-official-corrections-2.json`;
- `data/enrichment-audit.json`.

## További hivatalos metaadatok

Ahol a klub egyértelműen közölte, külön metaadatként bekerült például:

- csapatkapitányi szerep;
- klubhoz csatlakozás ideje;
- erősebb láb;
- kölcsönadó klub és kölcsönstátusz;
- korábbi klub;
- szerződéshosszabbítás;
- saját nevelésű vagy akadémiai státusz;
- első csapatos felkészülési státusz;
- távozás dátuma és következő klub;
- klub által megadott szezonbeli mérkőzés- és góladat.

Ezek nem írják felül az MLSZ-statisztikákat, és nem keverednek a játék alapmutatóival.

## Módosított vagy létrehozott fő fájlok

- `data/club-official-sources.json`;
- `data/club-official-enrichment-3-paks-nyir.json`;
- `data/club-official-enrichment-4-ujpest.json`;
- `data/club-official-enrichment-5-other.json`;
- `data/club-official-corrections-2.json`;
- `data/enrichment-audit.json`;
- `js/data/club-enrichment.js`;
- `js/bootstrap.js`;
- `scripts/build-standalone.mjs`;
- `sw.js`;
- `test/enrichment.test.mjs`;
- `test/static.test.mjs`;
- `.github/workflows/verify-and-build.yml`;
- `Fociskartyak2026.html`.

## Ellenőrzések

A végleges állapotban az alábbi parancsok futnak:

```bash
npm run lint
npm run build
npm test
npm run test:all
git diff --check
```

A tesztek rögzítik többek között:

- a 440 játékos és 464 regisztráció megőrzését;
- az eredeti azonosítók és sorrend változatlanságát;
- a duplikált kártyák hiányát;
- a 274/274 illesztett hivatalos rekordot;
- a 19 dokumentált kizárást;
- a 0 kézi ellenőrzésre maradt rekordot;
- a 0 megmaradt forrásütközést;
- a többklubos mezszámok biztonságos kezelését;
- az offline PWA és az egyfájlos HTML adatainak frissítését.

## Nem bekerült adatok

Megfelelő hivatalos, egyértelmű és 2025/26-os szezonhoz kapcsolható forrás hiányában nem került becslésre:

- játékperc;
- gólpassz;
- piaci érték;
- magasság a hiányzó játékosoknál;
- szerződés lejárata, ahol a klub nem közölte;
- mezszám vagy poszt, ha nem volt egyedi, hivatalos párosítás;
- ETO FC-játékosadat olyan formában, amelyet a hivatalos oldal nem tett stabilan szövegesen hozzáférhetővé.
