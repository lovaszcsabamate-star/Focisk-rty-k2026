# Fociskártyák 2026 – több szezonra bővíthető architektúra

## Jelenlegi aktív szezon

A jelenlegi adatbázis a magyar NB I **2025/26-os szezonját** tartalmazza.

| Fogalom | Érték | Szerep |
|---|---|---|
| `competitionId` | `hungary-nb1` | A versenysorozat tartós technikai azonosítója |
| `seasonId` | `2025-26` | A szezon tartós technikai azonosítója |
| `season` / `seasonMeta.label` | `2025/26` | A felhasználónak megjelenített felirat |
| `databaseId` | `hungary-nb1-2025-26` | A versenysorozat és szezon konkrét adatbázis-példánya |
| `seasonMeta.status` | `current` | A jelenlegi szezon állapota |

A szöveges `season` mező visszafelé kompatibilis marad. Az új kód számára a `seasonId` a kanonikus azonosító.

## Alapelv

Minden versenysorozat–szezon páros külön adatbázis-manifestet kap. A különböző idények játékosstatisztikái, klubtagságai és forrásrétegei nem írhatják felül egymást.

Példák:

```text
data/databases/hungary-nb1-2024-25/manifest.json
data/databases/hungary-nb1-2025-26/manifest.json
data/databases/hungary-nb1-2026-27/manifest.json
```

A játékos forrásazonosítója egy adatforráson belül változatlan maradhat. A futásidejű szezonos kártyaazonosító a szezon és a játékos azonosítójából készül:

```text
2025-26:<playerId>
2026-27:<playerId>
```

Így ugyanaz a személy különböző szezonokban külön kártyaként és külön statisztikai állapotként kezelhető.

## Szezonregiszter

A `data/databases/registry.json` tartalmazza az elérhető adatbázisokat és az alapértelmezett szezont.

Egy új szezon regisztrációja:

```json
{
  "id": "hungary-nb1-2026-27",
  "competitionId": "hungary-nb1",
  "seasonId": "2026-27",
  "manifest": "data/databases/hungary-nb1-2026-27/manifest.json",
  "enabled": true
}
```

Egy versenysorozatban ugyanaz a `seasonId` csak egyszer szerepelhet.

## Manifest-szerződés

Minden új manifest legalább az alábbi szezonmezőket tartalmazza:

```json
{
  "schemaVersion": 2,
  "id": "hungary-nb1-2026-27",
  "competitionId": "hungary-nb1",
  "competition": "NB I",
  "season": "2026/27",
  "seasonId": "2026-27",
  "seasonMeta": {
    "id": "2026-27",
    "label": "2026/27",
    "startYear": 2026,
    "endYear": 2027,
    "status": "upcoming"
  }
}
```

Engedélyezett állapotok:

- `archived` – lezárt korábbi szezon;
- `current` – jelenlegi aktív szezon;
- `upcoming` – előkészítés alatt álló későbbi szezon.

## Betöltési API

A szezonkezelés fő belépési pontjai:

- `getAvailableSeasons()` – regisztrált szezonok listája;
- `getDefaultSeason()` – alapértelmezett szezon;
- `loadSeason(seasonId, { competitionId })` – konkrét szezon betöltése;
- `loadActiveSeason()` – az alapértelmezett adatbázis és szezon indítása.

A jelenlegi bootstrap már a `loadActiveSeason()` függvényt használja. Egy későbbi szezonválasztó felület ezért a játékmotor és a kártyalogika módosítása nélkül kapcsolható rá.

## Mentések elkülönítése

A mérkőzésmentés játékmenet-sémája továbbra is v2, de a mentési boríték ezen felül tárolja:

- `databaseId`;
- `competitionId`;
- `seasonId`.

A játék csak az aktív adatbázishoz és szezonhoz tartozó mentést engedi folytatni. Ez megakadályozza, hogy például egy 2025/26-os félbehagyott mérkőzés 2026/27-es kártyákkal töltődjön vissza.

A régi, szezonmező nélküli mentések kizárólag a jelenlegi `hungary-nb1-2025-26` adatbázisban maradnak kompatibilisek.

## Új szezon hozzáadásának menete

1. Új szezonkönyvtár létrehozása a `data/databases` alatt.
2. A szezonhoz tartozó manifest elkészítése egyedi `databaseId` és `seasonId` értékkel.
3. A szezon saját játékos-, klub-, korrekciós és statisztikai forrásainak megadása.
4. Az adatbázis regisztrálása a `registry.json` fájlban.
5. A normalizált adatbázis legenerálása a manifest alapján.
6. Adatvalidáció, játékosszám- és duplikációs ellenőrzés futtatása.
7. A szezon állapotának beállítása `archived`, `current` vagy `upcoming` értékre.
8. A későbbi szezonválasztó felületen csak `enabled: true` adatbázis megjelenítése.

## Adatvédelmi és integritási szabályok

- Egy szezon adata nem írhatja felül más szezon statisztikáját.
- A klubváltás szezonhoz kötött regisztráció, nem a játékos globális tulajdonsága.
- A kategórialefedettséget minden szezonban külön kell kiszámítani.
- Hiányzó adat más szezonból automatikusan nem pótolható.
- A forrás, ellenőrzési dátum és korrekciós réteg szezononként visszakövethető marad.
- A normalizált adatbázis generálása reprodukálható és determinisztikus marad.
