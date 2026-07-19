# NB I 2025/26 game data

This folder contains the real-player data used by **Super Mega Fotbal 2026**.

## Files

- `players.json` — the balanced, playable 52-card deck loaded by the game.
- `validation.json` — deck size, club distribution and statistic ranges.

The complete source database contains 440 unique players and remains available in the separately generated `nb1_2025_26_webadatbazis_v2_8_complete.zip` package.

## Playable attributes

1. Age at the end of the 2025/26 season — lower wins.
2. League appearances — higher wins.
3. League starts — higher wins.
4. League goals — higher wins.
5. Yellow cards — lower wins.
6. Red cards — lower wins.
7. Project game score, 0–100 — higher wins.

The 52-card deck contains five players from each of the top four clubs and four players from each of the other eight clubs. Players are sampled across each club's score range instead of simply selecting the 52 highest-rated players.

## Source and limitations

The records were assembled from publicly displayed MLSZ Adatbank pages for the 2025/26 Fizz Liga season. The package does not contain player photos, club crests, MLSZ logos, Transfermarkt market values or invented missing statistics.

`nation` and `position` are currently shown as `Nincs adat`, because those fields were not consistently available in the verified source set.
