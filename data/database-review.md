# Fociskártyák 2026 – adatbázis-felülvizsgálat

Generálva: 2026-07-23T13:40:20.980Z

## Összefoglaló

- Játékoskártyák: **440**
- Klubregisztrációk: **464**
- Pontos születési dátum: **440/440**
- Változásnapló-bejegyzések: **4093**
- Megőrzött forrásütközések: **2**
- Kritikus hibák: **0**
- Figyelmeztetések: **2**

## Mezőlefedettség

| Mező | Ismert | Hiányzó |
|---|---:|---:|
| birthDate | 440 | 0 |
| nation | 440 | 0 |
| position | 440 | 0 |
| appearances | 440 | 0 |
| starts | 440 | 0 |
| minutes | 29 | 411 |
| goals | 440 | 0 |
| assists | 29 | 411 |
| squads | 440 | 0 |
| yellowCards | 440 | 0 |
| redCards | 440 | 0 |
| secondYellowRedCards | 37 | 403 |
| totalDismissals | 440 | 0 |
| heightCm | 125 | 315 |
| shirtNumber | 288 | 152 |

## Klubonkénti lefedettség

| Klub | Játékos | Születési dátum | Poszt | Nemzetiség | Mérkőzés | Perc | Gólpassz |
|---|---:|---:|---:|---:|---:|---:|---:|
| DVSC | 38 | 38 | 38 | 38 | 38 | 0 | 0 |
| DVTK | 45 | 45 | 45 | 45 | 45 | 0 | 0 |
| ETO FC | 35 | 35 | 35 | 35 | 35 | 0 | 0 |
| Ferencvárosi TC | 42 | 42 | 42 | 42 | 42 | 0 | 0 |
| Kisvárda Master Good | 38 | 38 | 38 | 38 | 38 | 29 | 29 |
| Kolorcity Kazincbarcika SC | 40 | 40 | 40 | 40 | 40 | 0 | 0 |
| MTK Budapest | 36 | 36 | 36 | 36 | 36 | 0 | 0 |
| Nyíregyháza Spartacus FC | 39 | 39 | 39 | 39 | 39 | 0 | 0 |
| Paksi FC | 33 | 33 | 33 | 33 | 33 | 0 | 0 |
| Puskás Akadémia FC | 34 | 34 | 34 | 34 | 34 | 0 | 0 |
| Újpest FC | 41 | 41 | 41 | 41 | 41 | 0 | 0 |
| ZTE FC | 43 | 43 | 43 | 43 | 43 | 0 | 0 |

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
