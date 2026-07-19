# Super Mega Fotbal 2026

A pub card game. You, three mates who won't shut up, and Barry — who reckons
he's unbeatable at football top trumps.

Proof of concept: playable end to end, no build step, no dependencies.

## Running it

The game uses ES modules, so it needs to be served over HTTP — opening
`index.html` from the filesystem will not work.

```
npm start          # python -m http.server 8901
```

then open <http://localhost:8901>.

Any static server works (`npx serve`, VS Code Live Server, …).

## The rules

- One shared **52-card deck**. Both sides draw from it; hands hold **5 cards**.
- Each round one side names an **attribute**. Round 1's chooser is random;
  after that, **the winner of the previous round chooses**.
- The chooser commits their card *at the same time* as naming the attribute, so
  neither side ever picks while looking at the other's card.
- Higher value wins — **except red and yellow cards, where fewer wins.**
- The winner takes **both cards** as victory points.
- A **dead heat** leaves both cards on the table as a pot; whoever wins the next
  round scoops the lot.
- The deck runs out after 26 rounds. Most cards wins.

Three difficulty settings ("Had a few" / "Regular" / "Card shark") vary how much
random noise the AI applies to its judgement.

## Reading your cards

Cards in hand are small, so **click any card to open it full size** — all seven
stats at readable type, with the round's attribute highlighted.

This works at *every* point in the round, not just when it's your turn to play,
because deciding which attribute to call means reading your hand first.

| | |
|---|---|
| `←` `→` | page through the rest of your hand without closing |
| `Enter` | play the card you're looking at (when it's your turn) |
| `Esc` | back out |

Paging is the point: you compare cards side by side at full size, then commit.

All seven stats fit on the card at normal window sizes. If the window is too
short for them, the stat list scrolls (with a shadow at the edge showing
there's more) rather than silently cutting rows off.

## Layout

| File | Role |
|---|---|
| `pipeline/` | Fetches real player data → `data/players.json`. See its README. |
| `js/data/players.js` | Deck loader + attribute metadata + the fictional fallback deck. |
| `js/engine.js` | Rules. Pure logic — no DOM, no timers. |
| `js/ai.js` | Opponent. Percentile model + a sacrifice heuristic. |
| `js/banter.js` | Pub dialogue, keyed by game event. |
| `js/ui.js` | All DOM rendering. Owns every art path. |
| `js/main.js` | Game loop, turn sequencing, AI pacing. |
| `test/simulate.mjs` | Headless soak test. |

## Adding art

**The pub background goes at `assets/pub/background.png`** (`.jpg`, `.jpeg` and
`.webp` also work — the first extension that loads wins). A dark scrim is
composited over it automatically so the UI stays readable on any photo; tune it
via `PUB_SCRIM` in `js/ui.js`.

Everything else — portraits, card backs, friend avatars — follows the same
pattern; names and sizes are in [`assets/README.md`](assets/README.md). Every
slot probes for its file and only swaps it in once it loads, so missing art
silently keeps the CSS fallback — **no code changes needed**. All paths live in
the `ART` object at the top of `js/ui.js`.

## Tests

```
npm run test:all      # pipeline transforms + 2000 full games AI-vs-AI
npm test              # game engine only
npm run test:pipeline # pipeline transforms only
```

The engine soak test asserts every game terminates, that all 52 cards are
conserved with no duplicates across deck/hands/piles/pot, and that no hand is
ever empty at the start of a round. It runs against `data/players.json` when
that exists, otherwise the mock.

The pipeline test runs the real parsing and selection code over gzipped CSV
fixtures — see [`pipeline/README.md`](pipeline/README.md#tests) for what it
does and doesn't prove.

## Real player data

```bash
node pipeline/build.mjs
```

Builds `data/players.json` from public football data — **no API key needed** —
and the game picks it up on the next reload. Full details in
[`pipeline/README.md`](pipeline/README.md).

Until you run it, the game plays a **fictional** demo deck: the stats are
invented, and attaching invented numbers to real footballers would misrepresent
real people. The title screen always says which deck you're on, so it's never
ambiguous.

Sources: height, market value, minutes, assists and cards come from
[transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets);
international caps from Wikidata. Market value is why a plain stats API won't
do — no free API exposes it.

`--portraits` also downloads player photos into `assets/portraits/`, filling
the card art slots automatically. Your own art at the same id still wins.

### The data contract

`js/data/players.js` exports `MOCK_PLAYERS`, `ATTRIBUTES` and `loadPlayers()`.
Any deck — real or mock — is a list of:

```js
{ id, name, club, nation, position,
  stats: { height, marketValue, redCards, yellowCards, caps, minutes, assists },
  meta: { imageUrl, capsKnown, ... }        // optional
}
```

`ATTRIBUTES` carries a `higherWins` flag per stat — the engine and the AI both
read it, so adding or reversing a stat is a data change, not a code change.
Player `id` doubles as the portrait filename.

The AI builds its percentile model from whichever deck is in play, so real data
(with completely different ranges from the mock) needs no code changes.

## Known gaps (it's a PoC)

- **The pipeline has never been run against the live dataset** — it was built
  in an offline environment. Transform logic is fixture-tested; the upstream
  column names are inferred from documentation. It fails loudly and specifically
  if they differ.
- International caps coverage is partial (Wikidata); unknown values are flagged
  `capsKnown: false` rather than silently written as 0.
- No sound, no card-deal animation beyond a simple fade.
- The AI doesn't track which cards have already been played.
- Banter is event-keyed, not stateful — the mates don't remember the game so far.
- No persistence between sessions.
