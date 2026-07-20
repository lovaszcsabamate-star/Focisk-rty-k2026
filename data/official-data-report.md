# Fociskártyák 2026 – 12 klubos hivatalos adatellenőrzés

Ellenőrzés dátuma: **2026-07-20**  
Szezon: **2025/26 – Fizz Liga (NB I)**  
Elsődleges adatforrás: **MLSZ Adatbank**

## Alapelvek

- A `data/players.json` változatlan forráspillanatkép maradt.
- A 440 eredeti játékos, 464 játékos–klub regisztráció, az azonosítók és a sorrend megmaradt.
- Kluboldali adat csak hiányzó mezőt tölthet ki.
- Aktuális, de 2025/26-os MLSZ-kártyához nem kapcsolható profil nem hozhat létre új játékost.
- Többklubos játékos klubspecifikus mezszáma és statisztikája külön metaadatba kerül.
- Az összes kizárás, névkorrekció és eltérés külön auditálható.

## Klubszintű eredmény

| Klub | MLSZ-kártyák | Keret-/profilrekordok | Illesztett | Kizárt | Szezonstatisztikai rekordok | Ellenőrzendő |
|---|---:|---:|---:|---:|---:|---:|
| DVSC | 38 | 43 | 36 | 7 | 0 | 0 |
| DVTK | 45 | 44 | 44 | 0 | 0 | 0 |
| ETO FC | 35 | 28 | 28 | 0 | 0 | 0 |
| Ferencvárosi TC | 42 | 42 | 41 | 1 | 0 | 0 |
| Kisvárda Master Good | 38 | 1 | 1 | 0 | **30/30** | 0 |
| Kolorcity Kazincbarcika SC | 40 | 19 | 16 | 3 | 0 | 0 |
| MTK Budapest | 36 | 32 | 32 | 0 | 0 | 0 |
| Nyíregyháza Spartacus FC | 39 | 32 | 32 | 0 | 0 | 0 |
| Paksi FC | 33 | 28 | 27 | 1 | 0 | 0 |
| Puskás Akadémia FC | 34 | 32 | 27 | 5 | 0 | 0 |
| Újpest FC | 41 | 26 | 21 | 5 | 0 | 0 |
| ZTE FC | 43 | 24 | 22 | 2 | 0 | 0 |
| **Összesen** | **464 regisztráció / 440 játékos** | **351** | **327** | **24** | **30/30** | **0** |

A keret- és profilrétegben **327/327**, a külön hivatalos szezonstatisztikai rétegben **30/30** rekord illeszkedett. Egyetlen nyitott névazonosítás vagy adatütközés sem maradt.

## Végleges mezőlefedettség

| Mező | Eredeti kitöltöttség | Végleges kitöltöttség | Új valós adatok |
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

A magasság, játékperc és gólpassz lefedettsége továbbra sem elég nagy és kiegyensúlyozott ahhoz, hogy automatikusan teljes adatbázisos játékkategóriává váljanak.

## Kisvárda Master Good – hivatalos szezonstatisztikai bővítés

A klub hivatalos 2025/26-os szezonértékelő cikkeiből 30, ténylegesen pályára lépett játékos adatai kerültek külön statisztikai rétegbe:

- pályára lépések;
- kezdések;
- játékpercek;
- csereként történt pályára lépések;
- gólok;
- gólpasszok;
- sárga lapok;
- közvetlen piros lapok;
- második sárga lap utáni kiállítások;
- összes kiállítás.

A 30 rekord mindegyike egyértelműen illeszkedett. A réteg eredménye:

- 25 új mérkőzés-, kezdés-, sárga-, piros- és összes kiállításmező;
- 29 új játékperc-, becserélés-, gólpassz- és második sárgás kiállításmező;
- 0 statisztikai konfliktus;
- 0 kézi ellenőrzésre maradt rekord.

Egy játékos többklubos személy-szezon kártyával rendelkezik. Nála a Kisvárda klubspecifikus adatai csak a `meta.clubOfficialStatsByClub` objektumba kerültek, és nem írták felül a személy-szezon összesítést.

Két célzott névkapcsolás történt:

- `Popovics Ilija` ↔ `POPOVICS ILLYA`;
- `Soltész István` ↔ `SOLTÉSZ ISTVÁN ZOLTÁN`.

## ETO FC-bővítés

Az ETO hivatalos első csapatos keretoldaláról 28 játékos posztja és mezszáma került a forrásrétegbe. Mind a 28 rekord egyedi 2025/26-os MLSZ-kártyához illeszkedett, kizárás, kézi ellenőrzés vagy forrásütközés nélkül.

## Puskás Akadémia-bővítés

A hivatalos játékosprofilokból poszt, pontos születési dátum és mezszám került feldolgozásra. A klub 32 hivatalos rekordjából 27 kapcsolódott egyértelműen a 2025/26-os Puskás MLSZ-kártyákhoz.

Két célzott névkapcsolás történt:

- `Georgi Harutjunjan` ↔ `ARUTIUNIAN GEORGII`;
- `Dárdai Palkó` ↔ `DÁRDAI PÁL`.

Öt aktuális profil nem kapott 2025/26-os Puskás-kártyaadatot:

- Bozó Mirkó – csak Puskás Akadémia FC II. NB III-as rekord igazolható;
- Farkas Bendegúz – a 2025/26-os Fizz Ligában a Nyíregyháza játékosa volt;
- Pál Barna – az Aqvital FC Csákvár NB II-es játékosa volt;
- Brugger Dániel – a Puskás 2026. július 7-én, az idény lezárása után jelentette be új igazolásként;
- Somfalvi Bence – Soroksár- és Csákvár-rekordja volt az NB II-ben.

## Fontos további névkorrekciók

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
- A Kisvárda statisztikai rétege meglévő MLSZ-statisztikát nem írt felül; az egyező értékeket változatlanul megtartotta.

## Kizárások

Összesen 24 keret- vagy profilrekord került dokumentált kizárásra. A fő okok:

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
- távozás dátuma és következő klub.

## Módosított vagy létrehozott fő fájlok

- `data/club-official-sources.json`;
- `data/club-official-enrichment-6-eto-puskas.json`;
- `data/club-official-stat-patches-kisvarda.json`;
- `data/club-official-corrections-3.json`;
- `data/enrichment-audit.json`;
- `js/data/club-enrichment.js`;
- `js/data/club-stat-patches.js`;
- `js/bootstrap.js`;
- `scripts/build-standalone.mjs`;
- `sw.js`;
- `test/enrichment.test.mjs`;
- `test/official-stat-patches.test.mjs`;
- `test/static.test.mjs`;
- `package.json`;
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
- a 327/327 illesztett keret- és profilrekordot;
- a 30/30 illesztett Kisvárda-szezonstatisztikai rekordot;
- a 24 dokumentált kizárást;
- a 0 kézi ellenőrzésre maradt rekordot;
- a 0 megmaradt forrásütközést;
- a többklubos mezszámok és klubstatisztikák biztonságos kezelését;
- az offline PWA és az egyfájlos HTML adatainak frissítését.

## Nem bekerült adatok

Megfelelő hivatalos, egyértelmű és 2025/26-os szezonhoz kapcsolható forrás hiányában nem került becslésre:

- játékperc vagy gólpassz a Kisvárda 29 főértékkel ellátott játékosán kívül;
- piaci érték;
- magasság a hiányzó játékosoknál;
- szerződés lejárata, ahol a klub nem közölte;
- mezszám, poszt vagy nemzetiség, ha nem volt egyedi, hivatalos párosítás.
