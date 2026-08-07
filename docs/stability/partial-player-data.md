# Hiányos, de használható játékosadatok

A futásidejű játszhatóság és a szigorú adatminőségi audit külön felelősség.

A játékhoz kötelező az egyedi, érdemi `id`, a játékos `name` értéke és a klub azonosítható neve (`club` vagy `clubName`). Az opcionális statisztikák hiánya nem válthat ki teljes adatforrás-fallbacket, és a hiányzó értékeket nem szabad automatikusan `0` értékké alakítani.

A kategória csak akkor játszható, ha az adott összehasonlításhoz szükséges hiteles érték mindkét aktuális kártyán rendelkezésre áll. A szigorú adatbázis-audit ettől függetlenül továbbra is jelzi a hiányzó vagy ellentmondásos adatokat.
