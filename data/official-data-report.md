# Fociskártyák 2026 – 12 klubos hivatalos adatellenőrzés

Ellenőrzés dátuma: **2026-07-20**  
Szezon: **2025/26 – Fizz Liga (NB I)**  
Elsődleges adatforrás: **MLSZ Adatbank**

## Alapelvek

- A `data/players.json` változatlan forráspillanatkép maradt.
- A 440 eredeti játékos, 464 játékos–klub regisztráció, az azonosítók és a sorrend megmaradt.
- Kluboldali adat csak hiányzó mezőt tölthet ki.
- Aktuális, de 2025/26-os MLSZ-kártyához nem kapcsolható profil nem hozhat létre új játékost.
- Többklubos játékosnál a klubonkénti mezszám külön metaadatba kerül.
- Az összes kizárás, névkorrekció és eltérés külön auditálható.

## Klubszintű eredmény

| Klub | MLSZ-kártyák | Kluboldali rekordok | Illesztett | Kizárt | Ellenőrzendő | Hivatalos forrás státusza |
|---|---:|---:|---:|---:|---:|---|
| DVSC | 38 | 43 | 36 | 7 | 0 | Strukturált idénykeret |
| DVTK | 45 | 44 | 44 | 0 | 0 | Strukturált idénykeret |
| ETO FC | 35 | 28 | 28 | 0 | 0 | Strukturált hivatalos első csapatos keret |
| Ferencvárosi TC | 42 | 42 | 41 | 1 | 0 | Strukturált idénykeret |
| Kisvárda Master Good | 38 | 1 | 1 | 0 | 0 | Hivatalos hír- és játékosprofil-adat |
| Kolorcity Kazincbarcika SC | 40 | 19 | 16 | 3 | 0 | Hivatalos keret- és átigazolási adatok |
| MTK Budapest | 36 | 32 | 32 | 0 | 0 | Strukturált idénykeret |
| Nyíregyháza Spartacus FC | 39 | 32 | 32 | 0 | 0 | Hivatalos játékoskeret |
| Paksi FC | 33 | 28 | 27 | 1 | 0 | Hivatalos játékoskeret |
| Puskás Akadémia FC | 34 | 32 | 27 | 5 | 0 | Hivatalos profilok, MLSZ-szezonszűréssel |
| Újpest FC | 41 | 26 | 21 | 5 | 0 | Hivatalos játékosprofilok, MLSZ-szezonszűréssel |
| ZTE FC | 43 | 24 | 22 | 2 | 0 | Hivatalos játékosprofilok és kiemelt szerepek |
| **Összesen** | **464 regisztráció / 440 játékos** | **351** | **327** | **24** | **0** | **Mind a 12 klub hivatalos oldala megvizsgálva** |

## Mezőlefedettség

| Mező | Eredeti kitöltöttség | Végleges kitöltöttség | Új valós adatok |
|---|---:|---:|---:|
| Pontos születési dátum | 120 | 265 | +145 |
| Mérkőzések | 143 | 144 | +1 |
| Kezdések | 143 | 144 | +1 |
| Gólok | 440 | 440 | 0 |
| Kerettagság | 106 | 107 | +1 |
| Sárga lap | 143 | 144 | +1 |
| Piros lap | 143 | 144 | +1 |
| Összes kiállítás | 143 | 144 | +1 |
| Poszt | 0 | 307 | +307 |
| Nemzetiség | 0 | 170 | +170 |
| Magasság | 0 | 46 | +46 |
| Mezszám | 0 | 261 | +261 |
| További hivatalos klubmetaadat | 0 | 41 játékos | +41 játékos |

A magasság lefedettsége továbbra is túl alacsony és klubonként egyenetlen ahhoz, hogy automatikusan játékkategóriává váljon.

## ETO FC-bővítés

Az ETO hivatalos első csapatos keretoldaláról 28 játékos posztja és mezszáma került a forrásrétegbe. Mind a 28 rekord egyedi 2025/26-os MLSZ-kártyához illeszkedett, kizárás, kézi ellenőrzés vagy forrásütközés nélkül.

## Puskás Akadémia-bővítés

A hivatalos játékosprofilokból poszt, pontos születési dátum és mezszám került feldolgozásra. A klub 32 hivatalos rekordjából 27 kapcsolódott egyértelműen a 2025/26-os Puskás MLSZ-kártyákhoz.

Két célzott névkapcsolás történt:

- `Georgi Harutjunjan` ↔ `ARUTIUNIAN GEORGII`;
- `Dárdai Palkó` ↔ `DÁRDAI PÁL`.

Öt aktuális profil nem kapott 2025/26-os Puskás-kártyaadatot:

- Bozó Mirkó – 2025/26-ban csak Puskás Akadémia FC II. NB III-as rekord igazolható;
- Farkas Bendegúz – a 2025/26-os Fizz Ligában a Nyíregyháza játékosa volt;
- Pál Barna – 2025/26-ban az Aqvital FC Csákvár NB II-es játékosa volt;
- Brugger Dániel – a Puskás 2026. július 7-én, az idény lezárása után jelentette be új igazolásként;
- Somfalvi Bence – 2025/26-ban Soroksár- és Csákvár-rekordja volt az NB II-ben.

## Fontos korábbi névkorrekciók

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
- Aktuális klubprofil csak akkor illeszkedhetett, ha az azonos klubhoz tartozó 2025/26-os MLSZ-kártya már létezett.
- Muhamed Tijani aktuális Újpest-profilja nem írta át a más klubhoz kapcsolódó 2025/26-os rekordot.

## Kizárások

Összesen 24 kluboldali rekord került dokumentált kizárásra. A fő okok:

- csak NB II-es, NB III-as, második csapatos vagy utánpótlás-szereplés;
- nem igazolható 2025/26-os Fizz Liga-regisztráció;
- évad utáni új igazolás vagy aktuális profil;
- a 2025/26-os MLSZ-kártya más klubhoz tartozik.

A részletes indoklás és forrás a következő fájlokban található:

- `data/club-official-corrections.json`;
- `data/club-official-corrections-2.json`;
- `data/club-official-corrections-3.json`;
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
- `data/club-official-enrichment-6-eto-puskas.json`;
- `data/club-official-corrections-2.json`;
- `data/club-official-corrections-3.json`;
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
- a 327/327 illesztett hivatalos rekordot;
- a 24 dokumentált kizárást;
- a 0 kézi ellenőrzésre maradt rekordot;
- a 0 megmaradt forrásütközést;
- az ETO 28/28-as és a Puskás 27/27-es illesztését;
- a többklubos mezszámok biztonságos kezelését;
- az offline PWA és az egyfájlos HTML adatainak frissítését.

## Nem bekerült adatok

Megfelelő hivatalos, egyértelmű és 2025/26-os szezonhoz kapcsolható forrás hiányában nem került becslésre:

- játékperc;
- gólpassz;
- piaci érték;
- magasság a hiányzó játékosoknál;
- szerződés lejárata, ahol a klub nem közölte;
- mezszám vagy poszt, ha nem volt egyedi, hivatalos párosítás.
