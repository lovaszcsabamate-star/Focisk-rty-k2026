# Art assets

## → The pub background goes here: `assets/pub/background.png`

That's the one you asked about. `.jpg`, `.jpeg` and `.webp` work too — the game
tries each extension in turn and uses the first that loads, so just drop the
file in as `background.<ext>` and reload. Nothing else to change.

A dark scrim (`rgba(18,11,5,.62 → .78)`) is composited over it automatically so
the cards and text stay readable no matter how bright or busy the photo is. If
your image is already dark and you want it to come through more strongly, lower
those alpha values in `PUB_SCRIM` near the top of [`js/ui.js`](../js/ui.js).

---

Nothing here is required to play — every slot has a CSS fallback and the game
probes for each file, only swapping it in once it loads. Drop files in with the
exact names below and they appear. **No code changes needed.**

All paths are resolved in one place: the `ART` object at the top of
[`js/ui.js`](../js/ui.js). Change extensions or folder layout there.

Any of `.png` / `.jpg` / `.jpeg` / `.webp` works in every slot below.

| Slot | Path | Size (suggested) | Notes |
|---|---|---|---|
| **Pub background** | **`pub/background.png`** | 1920 × 1080 | Sits behind everything, under an automatic dark scrim. Keep the centre-left uncluttered — the table sits there. |
| Player portrait | `portraits/<player-id>.png` | 600 × 340 | IDs are in `js/data/players.js` — `gk-01`, `df-07`, `fw-12`… Anchored top-centre, so keep the face in the upper third. Sized for the 300px-wide inspector view, then scaled down in hand. |
| Card back | `cards/back.png` | 264 × 380 (2×) | Fills the whole card; used for the opponent's hand. |
| Friend avatar | `friends/<speaker-id>.png` | 128 × 128 | IDs: `dermot`, `priya`, `gaz`. Rendered as a circle — keep content centred. |
| UI bits | `ui/` | — | Reserved: felt texture, brass frames, pint glass, chalk scoreboard. |

Portraits are worth supplying at ~600 × 340: the card inspector blows a card up
to 300px wide with a 168px-tall portrait area, so anything smaller will look
soft there even if it's fine in the hand.

## Card face layout

The card is 132 × 190 CSS px. Top 74px is portrait; below that sits the name,
club, and the seven stat rows. The active stat row highlights in brass, so
portraits don't need to reserve space for it.

## Adding a full card illustration

If you'd rather supply whole pre-composed card faces instead of portraits, add
a branch in `UI.renderCard()` (`js/ui.js`) that sets a `assets/cards/<id>.png`
background on the `.card` node and skips the stat rows — the stat values still
need to be readable somewhere for the game to make sense.
