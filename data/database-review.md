# Fociskártyák 2026 – adatbázis-felülvizsgálat

Generálva: 2026-07-20T19:03:14.299Z

## Összefoglaló

- Játékoskártyák: **440**
- Klubregisztrációk: **464**
- Pontos születési dátum: **285/440**
- Változásnapló-bejegyzések: **1522**
- Megőrzött forrásütközések: **0**
- Kritikus hibák: **0**
- Figyelmeztetések: **93**

## Mezőlefedettség

| Mező | Ismert | Hiányzó |
|---|---:|---:|
| birthDate | 285 | 155 |
| nation | 181 | 259 |
| position | 324 | 116 |
| appearances | 172 | 268 |
| starts | 172 | 268 |
| minutes | 29 | 411 |
| goals | 440 | 0 |
| assists | 29 | 411 |
| squads | 127 | 313 |
| yellowCards | 172 | 268 |
| redCards | 172 | 268 |
| secondYellowRedCards | 32 | 408 |
| totalDismissals | 172 | 268 |
| heightCm | 52 | 388 |
| shirtNumber | 278 | 162 |

## Klubonkénti lefedettség

| Klub | Játékos | Születési dátum | Poszt | Nemzetiség | Mérkőzés | Perc | Gólpassz |
|---|---:|---:|---:|---:|---:|---:|---:|
| DVSC | 38 | 38 | 36 | 36 | 38 | 0 | 0 |
| DVTK | 45 | 44 | 44 | 44 | 5 | 0 | 0 |
| ETO FC | 35 | 35 | 28 | 0 | 35 | 0 | 0 |
| Ferencvárosi TC | 42 | 41 | 41 | 41 | 8 | 0 | 0 |
| Kisvárda Master Good | 38 | 20 | 18 | 11 | 32 | 29 | 29 |
| Kolorcity Kazincbarcika SC | 40 | 2 | 8 | 0 | 5 | 0 | 0 |
| MTK Budapest | 36 | 32 | 32 | 32 | 6 | 0 | 0 |
| Nyíregyháza Spartacus FC | 39 | 2 | 33 | 1 | 5 | 0 | 0 |
| Paksi FC | 33 | 33 | 29 | 3 | 33 | 0 | 0 |
| Puskás Akadémia FC | 34 | 27 | 27 | 2 | 4 | 0 | 0 |
| Újpest FC | 41 | 22 | 21 | 1 | 4 | 0 | 0 |
| ZTE FC | 43 | 7 | 24 | 22 | 4 | 0 | 0 |

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
