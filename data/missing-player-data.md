# Adatlefedettség és hiányzó játékosadatok

A játék 440 egyedi játékost tartalmaz a forrás 464 játékos–klub regisztrációjából.
A 24 klubváltó személyenként egy, több klubot feltüntető kártyát kapott.

| Mező | Ismert | Ismeretlen |
|---|---:|---:|
| birthDate | 120 | 320 |
| appearances | 143 | 297 |
| starts | 143 | 297 |
| goals | 440 | 0 |
| squads | 106 | 334 |
| yellowCards | 143 | 297 |
| redCards | 143 | 297 |
| totalDismissals | 143 | 297 |
| overallScore | 143 | 297 |

A gólérték mind a 440 játékosnál végleges személy–szezon összesítés. A többi hiányzó mező nem nulla: a forrásban még nincs feldolgozott részletes játékosoldal, ezért `null` marad.

A hiányzó rekordazonosítók mezőnként a `validation.json` `missingValueIds` részében találhatók.

## Forráskorlátok

- Mid-season transfers require match-level processing to split goals between clubs.
- Official team goals can include opponent own goals, so scorer totals are not expected to equal team goals-for.
- Four Paksi roster players appeared for two NB I clubs; the official player-page league row is aggregate and cannot be split by club without match-level processing.
- The earlier Ferencváros completion marker was corrected because the detailed values were not present in players.json/SQLite.
- Two DVSC roster players appeared for two NB I clubs; the official player-page league row is aggregate and cannot be split by club without match-level processing.
