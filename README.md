# Super Mega Fotbal 2026

A pub-style football comparison card game. The current build ships with a real
**2025/26 Hungarian NB I / Fizz Liga** deck.

## Running it

The game uses ES modules, so serve the repository over HTTP rather than opening
`index.html` directly from the filesystem.

```bash
npm start
```

Then open `http://localhost:8901`.

Any static server also works, including VS Code Live Server or `npx serve`.

## The rules

- One shared **52-card deck**; both sides hold five cards.
- Each round, the chooser names an attribute and commits a card.
- The opponent then chooses a card without seeing the committed card.
- Higher wins, except **age, yellow cards and red cards**, where lower wins.
- The winner takes both cards and any cards left in the tie pot.
- The winner of the previous round chooses the next attribute.
- After 26 rounds, the player with more cards wins.

## Real NB I data

The game automatically loads `data/players.json`.

- `data/players.json` contains the balanced 52-card playable deck.
- `data/validation.json` documents club quotas and statistic ranges.
- The complete source database contains 440 unique players in the separately
  generated `nb1_2025_26_webadatbazis_v2_8_complete.zip` package.

The seven comparison attributes are:

1. age at the end of the 2025/26 season;
2. league appearances;
3. league starts;
4. league goals;
5. yellow cards;
6. red cards;
7. a transparent 0–100 project game score.

The playable deck has five cards from each of the top four clubs and four cards
from each remaining club. Selection is spread across each club's score range,
so the deck is varied rather than containing only the highest-rated players.

The data comes from publicly displayed MLSZ Adatbank pages. No player photos,
club crests, MLSZ logos, Transfermarkt market values or invented missing values
are included. Position and nationality remain `Nincs adat` until a suitable,
verified source is added.

## Data contract

`js/data/players.js` exports `MOCK_PLAYERS`, `ATTRIBUTES`,
`ATTRIBUTE_BY_KEY` and `loadPlayers()`.

```js
{
  id,
  name,
  club,
  nation,
  position,
  stats: {
    age,
    appearances,
    starts,
    goals,
    yellowCards,
    redCards,
    overallScore
  }
}
```

Every playable statistic must be a finite number. If the real JSON file is
missing or invalid, the application falls back to a clearly fictional 52-card
demo deck.

## Project layout

| File | Role |
|---|---|
| `data/players.json` | Real, playable NB I deck |
| `data/validation.json` | Deck validation summary |
| `js/data/players.js` | Attribute definitions, validation and deck loader |
| `js/engine.js` | Game rules |
| `js/ai.js` | Opponent logic |
| `js/ui.js` | Rendering and art paths |
| `js/main.js` | Game loop |
| `test/simulate.mjs` | Headless game simulation |

## Art

The pub background belongs at `assets/pub/background.png`. JPEG and WebP also
work. Portraits are resolved from `assets/portraits/<player-id>.<ext>`; missing
images use the existing CSS fallback.

## Tests

```bash
npm test
```

The simulation prefers `data/players.json`, checks that the deck has 52 unique
cards, verifies all seven statistics and runs complete AI-versus-AI games.

## Known gaps

- Position and nationality are not yet populated.
- No licensed player portraits or official club marks are bundled.
- The legacy `pipeline/` folder targets an older Transfermarkt-based schema and
  is not used by the bundled MLSZ deck.
- No persistence between sessions.
