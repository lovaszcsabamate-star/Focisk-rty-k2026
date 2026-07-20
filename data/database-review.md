# Fociskártyák 2026 – adatbázis-felülvizsgálat

Generálva: 2026-07-20T21:48:23.076Z

## Összefoglaló

- Játékoskártyák: **440**
- Klubregisztrációk: **464**
- Pontos születési dátum: **303/440**
- Változásnapló-bejegyzések: **1978**
- Megőrzött forrásütközések: **0**
- Kritikus hibák: **0**
- Figyelmeztetések: **75**

## Mezőlefedettség

| Mező | Ismert | Hiányzó |
|---|---:|---:|
| birthDate | 303 | 137 |
| nation | 187 | 253 |
| position | 344 | 96 |
| appearances | 209 | 231 |
| starts | 209 | 231 |
| minutes | 29 | 411 |
| goals | 440 | 0 |
| assists | 29 | 411 |
| squads | 181 | 259 |
| yellowCards | 209 | 231 |
| redCards | 209 | 231 |
| secondYellowRedCards | 37 | 403 |
| totalDismissals | 209 | 231 |
| heightCm | 57 | 383 |
| shirtNumber | 288 | 152 |

## Klubonkénti lefedettség

| Klub | Játékos | Születési dátum | Poszt | Nemzetiség | Mérkőzés | Perc | Gólpassz |
|---|---:|---:|---:|---:|---:|---:|---:|
| DVSC | 38 | 38 | 36 | 36 | 38 | 0 | 0 |
| DVTK | 45 | 44 | 44 | 44 | 5 | 0 | 0 |
| ETO FC | 35 | 35 | 28 | 0 | 35 | 0 | 0 |
| Ferencvárosi TC | 42 | 42 | 42 | 41 | 40 | 0 | 0 |
| Kisvárda Master Good | 38 | 38 | 38 | 17 | 37 | 29 | 29 |
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
