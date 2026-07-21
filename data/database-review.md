# Fociskártyák 2026 – adatbázis-felülvizsgálat

Generálva: 2026-07-21T08:37:15.319Z

## Összefoglaló

- Játékoskártyák: **440**
- Klubregisztrációk: **464**
- Pontos születési dátum: **383/440**
- Változásnapló-bejegyzések: **3084**
- Megőrzött forrásütközések: **0**
- Kritikus hibák: **0**
- Figyelmeztetések: **41**

## Mezőlefedettség

| Mező | Ismert | Hiányzó |
|---|---:|---:|
| birthDate | 383 | 57 |
| nation | 270 | 170 |
| position | 381 | 59 |
| appearances | 333 | 107 |
| starts | 333 | 107 |
| minutes | 29 | 411 |
| goals | 440 | 0 |
| assists | 29 | 411 |
| squads | 321 | 119 |
| yellowCards | 333 | 107 |
| redCards | 333 | 107 |
| secondYellowRedCards | 37 | 403 |
| totalDismissals | 333 | 107 |
| heightCm | 57 | 383 |
| shirtNumber | 288 | 152 |

## Klubonkénti lefedettség

| Klub | Játékos | Születési dátum | Poszt | Nemzetiség | Mérkőzés | Perc | Gólpassz |
|---|---:|---:|---:|---:|---:|---:|---:|
| DVSC | 38 | 38 | 36 | 36 | 38 | 0 | 0 |
| DVTK | 45 | 45 | 45 | 45 | 39 | 0 | 0 |
| ETO FC | 35 | 35 | 29 | 1 | 35 | 0 | 0 |
| Ferencvárosi TC | 42 | 42 | 42 | 41 | 40 | 0 | 0 |
| Kisvárda Master Good | 38 | 38 | 38 | 17 | 37 | 29 | 29 |
| Kolorcity Kazincbarcika SC | 40 | 40 | 40 | 40 | 35 | 0 | 0 |
| MTK Budapest | 36 | 36 | 36 | 36 | 34 | 0 | 0 |
| Nyíregyháza Spartacus FC | 39 | 39 | 33 | 39 | 37 | 0 | 0 |
| Paksi FC | 33 | 33 | 29 | 4 | 33 | 0 | 0 |
| Puskás Akadémia FC | 34 | 28 | 27 | 3 | 4 | 0 | 0 |
| Újpest FC | 41 | 23 | 22 | 3 | 4 | 0 | 0 |
| ZTE FC | 43 | 10 | 27 | 25 | 4 | 0 | 0 |

## Forráskezelési megjegyzések

- **DVSC:** a szezonforrás domainje (dvtk.eu) eltér a klub hivatalos domainjétől (dvsc.hu).
- **MTK Budapest:** a szezonforrás domainje (dvtk.eu) eltér a klub hivatalos domainjétől (mtkbudapest.hu).

Az eltérő domainű történeti szezonforrások adatai nem kerülnek automatikusan felülírva aktuális keretoldalakkal. Az aktuális és a 2025/26-os történeti forrást külön kell nyilvántartani.

## Kritikus hibák

- Nem található kritikus szerkezeti hiba.

## További kézi ellenőrzés

- A hiányzó mezők játékosazonosítói a `data/missing-player-data-reviewed.json` fájlban találhatók.
- A forrásból megőrzött eltérések és a hozzáadott mezők a `data/database-changelog.json` fájlban követhetők.
- Hiányzó adat nem tekinthető nullának vagy nulla statisztikának; a játék ezeket a kategóriából kizárja.
