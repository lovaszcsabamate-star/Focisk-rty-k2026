# DVTK 2025/26 – magasságadat-bővítés

## Forrás

- HLSZ: Diósgyőr, 2025/2026-os keretoldal
- Ellenőrzés dátuma: 2026-07-24
- Forrásoldal: https://hlsz.hu/diosgyor

## Alkalmazott szabályok

- Csak a projekt meglévő 2025/26-os DVTK-játékoskártyáihoz egyértelműen illeszkedő rekord használható.
- Csak számszerűen közölt, centiméterben megadott magasság kerülhet be.
- A kötőjeles vagy üres magasság nem kerül becslésre.
- Meglévő `heightCm` érték nem írható felül.
- Néveltérés esetén ellenőrzött alias szükséges.

## Eredmény

- 14 ellenőrzött forrásrekord került az új adatgazdagítási rétegbe.
- 6 korábban hiányzó magasság töltődött be a normalizált adatbázisba.
- A magasságlefedettség 125/440-ről 131/440-re nőtt.
- 8 meglévő érték változatlan maradt.
- Az eltérő meglévő és felkínált értékeket a rendszer felülírás helyett `enrichmentConflicts` bejegyzésként naplózza.
- A játékosszám, a stabil azonosítók, a játékosnevek és a teljes `stats` objektum változatlan maradt.
