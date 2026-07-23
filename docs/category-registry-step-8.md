# 8. lépés – Központi kategóriaregiszter

## Cél

A Fociskártyák 2026 minden összehasonlítási kategóriájának egyetlen, verziózott konfigurációba szervezése úgy, hogy a meglévő játékszabályok, megjelenés és publikus `ATTRIBUTE_*` API változatlan maradjon.

## Központi modul

Az új regiszter helye:

- `js/data/categories.js`

A regiszter sémaverziója:

- `CATEGORY_SCHEMA_VERSION = 1`

## Kanonikus kategóriaszerződés

Minden kategória kötelezően tartalmazza:

- `id` – stabil, nyelvfüggetlen azonosító;
- `nameHu` – teljes magyar név;
- `shortNameHu` – rövid magyar név;
- `value(card)` – összehasonlítható numerikus érték előállítása;
- `direction` – `higher`, `lower`, `later` vagy `earlier`;
- `formatValue(value, card)` – felületi formázás;
- `requiredFields` – a szükséges játékosadatmezők listája;
- `minimumMinutes` – percalapú mutatóknál a minimális játékperc;
- `group` – magyar kategóriacsoport;
- `enabled` – aktuális engedélyezési állapot.

A konfiguráció továbbra is tartalmazza a megjelenítéshez szükséges ikont, kártyafeliratot, súgószöveget, pontosságot és opcionális állapotot.

## Csoportok

- `Alapadatok`
- `Pályára lépés`
- `Támadás`
- `Fegyelem`

## Adatkövetelmények

Példák:

- `birthDate` → `birthDate`;
- `startRate` → `stats.starts`, `stats.appearances`;
- `goalsPer90` → `stats.goals`, `stats.minutes`;
- `goalContributionsPer90` → `stats.goals`, `stats.assists`, `stats.minutes`;
- `discipline` → `stats.yellowCards`, `stats.totalDismissals`.

A `requiredFields` jelenleg deklaratív metaadat. Nem tölt ki hiányzó értéket és nem talál ki statisztikát. A tényleges értékfüggvény továbbra is `null` értékkel jelzi, ha nincs hiteles összehasonlítási adat.

## Engedélyezés

A kategóriák két állapotszintet őriznek:

- `enabledByDefault` – kompatibilitási jelzés az induló állapotról;
- `enabled` – az aktuális adatbázis lefedettsége alapján meghatározott futásidejű állapot.

A lehetséges futásidejű státuszok:

- `enabled`;
- `experimental`;
- `disabled`.

A jelenlegi 10%-os minimumlefedettségi szabály és a legalább két ismert érték követelménye változatlan marad.

## Kompatibilitási aliasok

A régi mezőnevek ugyanarra az értékre mutatnak:

- `key` → `id`;
- `label` → `nameHu`;
- `shortLabel` → `shortNameHu`;
- `getValue` → `value`;
- `format` → `formatValue`;
- `cardStatKey` → `cardField`.

A `js/data/players.js` továbbra is exportálja:

- `ATTRIBUTE_DEFINITIONS`;
- `ATTRIBUTE_BY_KEY`;
- `ATTRIBUTES`;
- `CARD_ATTRIBUTE_KEYS`;
- `attributeValue()`;
- `hasAttributeData()`;
- `formatAttribute()`;
- `configureAttributes()`.

Ezek a központi kategóriaregiszter kanonikus exportjainak kompatibilitási aliasai.

## Új kanonikus exportok

A `js/data/players.js` új neveken is elérhetővé teszi:

- `CATEGORY_DEFINITIONS`;
- `CATEGORY_BY_ID`;
- `ENABLED_CATEGORIES`;
- `CARD_CATEGORY_IDS`;
- `CATEGORY_AVAILABILITY`;
- `categoryValue()`;
- `hasCategoryData()`;
- `formatCategoryValue()`;
- `configureCategories()`.

## Viselkedési kompatibilitás

Nem változik:

- a 26 kategória azonosítója;
- a magyar feliratok;
- az összehasonlítás iránya;
- a pontos születési dátum alapú fiatalabb/idősebb szabály;
- a per 90 és per gól mutatók számítása;
- a hiányzó adat `null` kezelése;
- a nulla érték megőrzése;
- a kategórialefedettségi aktiválás;
- a kártyán megjelenő alapstatisztikák listája.

## Build és offline működés

A `categories.js` a `players.js` előtt kerül:

- az önálló HTML modulrendjébe;
- a PWA offline cache-be;
- az Android offline webcsomagba.

## Tesztelés

A `test/category-registry.test.mjs` ellenőrzi:

- mind a 26 kategória sémáját;
- az azonosítók egyediségét;
- a kötelező magyar neveket;
- a `value` és `formatValue` függvényeket;
- az irányokat és csoportokat;
- a `requiredFields` és `minimumMinutes` metaadatokat;
- a régi és új exportok objektumazonosságát;
- a kategóriaértékek és formázás működését;
- az adatlefedettség-alapú engedélyezést.
