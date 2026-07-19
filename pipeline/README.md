# Data pipeline

Builds `data/players.json` — the real 52-card deck — from public football data.
**No API key, no signup.**

```bash
node pipeline/build.mjs              # build the deck
node pipeline/build.mjs --portraits  # ...and download player photos
node pipeline/build.mjs --no-caps    # skip the Wikidata lookup (faster)
node pipeline/build.mjs --refresh    # re-download, ignoring the cache
```

Reload the game afterwards — it picks the file up automatically. Until then it
plays the fictional mock deck, and the title screen says which one you're on.

> **This has never been run against the live dataset.** It was written and
> tested in an environment with no network access. The transform logic is
> covered by fixture tests (`node pipeline/test/transform.test.mjs`), but the
> column names are inferred from the dataset's documentation rather than
> observed. If upstream differs, the build stops with the real header list and
> tells you what to change — see *When it breaks* below.

## Where the data comes from

| Attribute | Source |
|---|---|
| Height | Transfermarkt `players.height_in_cm` |
| Market value | Transfermarkt `players.market_value_in_eur` |
| Minutes played | Σ `appearances.minutes_played` over the season |
| Assists | Σ `appearances.assists` |
| Yellow cards | Σ `appearances.yellow_cards` |
| Red cards | Σ `appearances.red_cards` |
| **International caps** | **Wikidata** — `P54` (member of sports team) qualified by `P1350` (matches played), restricted to national teams |

Stats come from [`dcaribou/transfermarkt-datasets`](https://github.com/dcaribou/transfermarkt-datasets):
public CSV exports, refreshed weekly, also on Kaggle as
[`davidcariboo/player-scores`](https://www.kaggle.com/datasets/davidcariboo/player-scores).

**Why not a stats API?** Because of market value. API-Football, Sportmonks and
football-data.org all cover height, minutes, assists and cards — but none of
them expose a market valuation, which is Transfermarkt's proprietary figure.
That single attribute forces this route.

### About caps

Caps are the weak column. They aren't in the Transfermarkt dataset, so they're
enriched from Wikidata, joined on the **Transfermarkt player ID** (`P2446`) —
an exact ID join, never fuzzy name matching, which would silently mix up
players who share a name.

Coverage is partial and often lags reality. The builder therefore:

- prefers players whose caps it actually knows when filling the deck;
- if it must fall back, writes `caps: 0` with **`meta.capsKnown: false`** and
  prints a warning. That is an *unknown* value, not a verified zero — don't
  read those cards as "uncapped".

Run with `--no-caps` and every card gets `capsKnown: false`.

## Configuration

Everything tweakable is in [`config.mjs`](config.mjs):

| Setting | Default | Notes |
|---|---|---|
| `competitions` | `GB1 ES1 IT1 L1 FR1` | Top-5 European leagues. Bad codes cause a failure listing valid ones. |
| `season` | 2025/26 | Appearances are filtered by date, since the table is per-match. |
| `minMinutes` | 600 | Below this a player's card is mostly zeroes. |
| `deck.byPosition` | 6/16/16/14 | GK/DEF/MID/ATT. Must total 52. |

### How the 52 are chosen

Not simply "the 52 most valuable". That squashes the market-value range so
every card reads €80–120M and the comparison becomes a coin flip. Sampling the
league uniformly fixes the range but fills the deck with unknowns.

Instead: rank each position group by value, then sample the **whole** range on
a power curve (`exponent 1.8`) that clusters picks toward the expensive end.
Both the most valuable player and the tail are represented. On the test
fixture this yields a ~400× value spread with 9 of 16 picks from the top third.

## When it breaks

The upstream dataset is community-maintained and can change shape. Failures are
designed to be loud and specific rather than silently producing a deck of
zeroes:

| Symptom | What it means |
|---|---|
| `Schema mismatch in players.csv` | A column was renamed. The error lists every column actually present — add the new name to the candidate list in [`sources/transfermarkt.mjs`](sources/transfermarkt.mjs). |
| `None of the configured competition codes exist` | League codes changed. The error prints valid codes; fix `CONFIG.competitions`. |
| `No appearances matched` | Season window has no data yet. Check `CONFIG.season` against how recent the refresh is. |
| `Download failed: 404` | The R2 bucket moved. Check the upstream repo and update `CONFIG.baseUrl`. |
| Build succeeds but a stat is flat | The summary table flags any column with ≤2 distinct values — it maps to the wrong source column. |

After a successful build, the console prints min/max/avg/distinct for all seven
stats. **Read it.** It's the fastest way to spot a column that mapped wrong.

## Licensing

The stats are Transfermarkt-derived. Fine for personal use and this prototype;
if you plan to ship this commercially, check Transfermarkt's terms first — the
dataset repackages their data and that isn't yours to redistribute by default.
Wikidata is CC0.

Player photos fetched with `--portraits` are hotlinked from Transfermarkt's CDN
and carry their own rights. They're a convenience for prototyping, not
clearance to publish.

## Tests

```bash
node pipeline/test/transform.test.mjs
```

Builds gzipped CSV fixtures in the expected schema and runs the real parsing,
aggregation and selection code over them. Covers quoted fields with embedded
commas and newlines, season/competition filtering, rejection of implausible
heights, the schema-mismatch guard, and the value spread of the selection.

These prove the transform is correct **given that schema**. They cannot prove
the schema matches the live dataset — only running it can.
