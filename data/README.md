# Játékosadatok

Az alkalmazás a `players.json` fájlt tölti be. A jelenlegi 136 kártya a korábbi 52 lapos, 12 klubos pakli és a frissebb 99 lapos ETO FC–Paksi FC–DVSC állomány veszteségmentes egyesítése; az azonos játékos–klub rekordok nem duplázódnak.

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
- A `yellowCards` és `redCards` a meglévő 2025/26-os MLSZ adatsorból származik.
- A forrás nem választja külön az egyenes pirosat és a második sárga miatti kiállítást. Emiatt a `secondYellowRedCards` ismeretlen (`null`), a `totalDismissals` pedig az MLSZ egyetlen piroslap/kiállítás értékét veszi át.
- Ismeretlen érték soha nem alakul automatikusan nullává.

A `validation.json` tartalmazza a pontos ismertérték-számokat és minden hiányzó születési dátumú kártya azonosítóját.
