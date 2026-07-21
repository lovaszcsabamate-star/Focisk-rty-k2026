# Fociskártyák 2026 – adatbázis-felülvizsgálat

Generálva: 2026-07-21T13:11:51.093Z

## Összefoglaló

- Játékoskártyák: **440**
- Klubregisztrációk: **464**
- Pontos születési dátum: **440/440**
- Változásnapló-bejegyzések: **3993**
- Megőrzött forrásütközések: **0**
- Kritikus hibák: **0**
- Figyelmeztetések: **2**

## Mezőlefedettség

| Mező | Ismert | Hiányzó |
|---|---:|---:|
| birthDate | 440 | 0 |
| nation | 417 | 23 |
| position | 433 | 7 |
| appearances | 423 | 17 |
| starts | 423 | 17 |
| minutes | 29 | 411 |
| goals | 440 | 0 |
| assists | 29 | 411 |
| squads | 423 | 17 |
| yellowCards | 423 | 17 |
| redCards | 423 | 17 |
| secondYellowRedCards | 37 | 403 |
| totalDismissals | 423 | 17 |
| heightCm | 57 | 383 |
| shirtNumber | 288 | 152 |

## Klubonkénti lefedettség

| Klub | Játékos | Születési dátum | Poszt | Nemzetiség | Mérkőzés | Perc | Gólpassz |
|---|---:|---:|---:|---:|---:|---:|---:|
| DVSC | 38 | 38 | 36 | 36 | 38 | 0 | 0 |
| DVTK | 45 | 45 | 45 | 45 | 39 | 0 | 0 |
| ETO FC | 35 | 35 | 35 | 35 | 35 | 0 | 0 |
| Ferencvárosi TC | 42 | 42 | 42 | 41 | 40 | 0 | 0 |
| Kisvárda Master Good | 38 | 38 | 38 | 17 | 37 | 29 | 29 |
| Kolorcity Kazincbarcika SC | 40 | 40 | 40 | 40 | 35 | 0 | 0 |
| MTK Budapest | 36 | 36 | 36 | 36 | 34 | 0 | 0 |
| Nyíregyháza Spartacus FC | 39 | 39 | 34 | 39 | 37 | 0 | 0 |
| Paksi FC | 33 | 33 | 33 | 33 | 33 | 0 | 0 |
| Puskás Akadémia FC | 34 | 34 | 34 | 34 | 30 | 0 | 0 |
| Újpest FC | 41 | 41 | 41 | 41 | 35 | 0 | 0 |
| ZTE FC | 43 | 43 | 43 | 43 | 37 | 0 | 0 |

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
