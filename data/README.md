# Játékosadatok

Az alkalmazás a `players.json` fájlt tölti be. A jelenlegi adatbázis 440 egyedi játékoskártyát tartalmaz a 2025/26-os NB I mind a 464 játékos–klub regisztrációjából. A 24 klubváltó személyenként egy kártyán, mindkét klubbal és személy–szezon összesítéssel szerepel, így nincs duplikáció.

## Új mezők

```js
{
  birthDate: "2002-01-28" | null,
  stats: {
    yellowCards: 4,
    redCards: 0,
    secondYellowRedCards: null,
    totalDismissals: 0
  }
}
```

- A `birthDate` csak pontos, forrással rendelkező dátum lehet.
- A `goals` mind a 440 személynél ismert, végleges MLSZ szezonösszeg.
- A `yellowCards` és `redCards` csak ott szám, ahol rendelkezésre áll 2025/26-os MLSZ részletes adat; egyébként `null`.
- A forrás nem választja külön az egyenes pirosat és a második sárga miatti kiállítást. Emiatt a `secondYellowRedCards` ismeretlen (`null`), a `totalDismissals` pedig az MLSZ egyetlen piroslap/kiállítás értékét veszi át.
- Ismeretlen értéket soha nem alakítunk automatikusan hiteles nullává (`0`).

## Lefedettség

| Mező | Ismert / 440 |
|---|---:|
| Gól | 440 |
| Születési dátum | 120 |
| Mérkőzés, kezdés, sárga és kiállítás | 143 |
| Meccskeret | 106 |

A `validation.json` tartalmazza a pontos ismertérték-számokat és minden hiányzó mező kártyaazonosítóit. A `missing-player-data.md` összefoglalja a forrás korlátait.
