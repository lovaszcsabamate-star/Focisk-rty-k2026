# Fociskártyák 2026 – 14. lépés: központi asset-service

## Cél

A képi assetek útvonalainak, támogatott kiterjesztéseinek, fallbackjeinek és jogi kiadási policyjének leválasztása a DOM-renderelő és branding rétegekről.

A lépés az architektúra-auditban kijelölt `asset-service` modult vezeti be. Nem ad hozzá új játékosfotót, klublogót vagy más hivatalos arculati elemet, és nem változtatja meg a jelenlegi látható felületet.

## Korábbi állapot

A `js/ui/dom-primitives.js` közvetlenül tartalmazta:

- a támogatott `png`, `jpg`, `jpeg`, `webp` kiterjesztéseket;
- a játékosportré útvonalát;
- a kártyahátlap útvonalát;
- a kocsmai barátok útvonalát;
- a kocsmaháttér útvonalát.

A `js/ui/card-component.js` külön fűzte a portréjelöltekhez a játékosadatban szereplő `meta.imageUrl` értéket.

A `js/branding.js` ettől függetlenül tartalmazta:

- a játékos-, klub- és alkalmazásikon-placeholder útvonalakat;
- az engedélyezett release assetek listáját;
- a védett assetmappák előtagjait;
- az útvonal-kanonizálást;
- a távoli kép URL felismerését;
- a nem engedélyezett portré- és logókérések blokkolási szabályát.

Ez ugyanazt az assetdomaint két külön helyen, eltérő felelősségekkel kezelte.

## Új modul

`js/services/asset-service.js`

A modul DOM-mentes, ezért Node alatt külön egységtesztelhető.

Publikus elemek:

- `ASSET_EXTENSION_ORDER`;
- `ASSET_ROOTS`;
- `ASSET_PLACEHOLDERS`;
- `ASSET_PROTECTED_PREFIXES`;
- `AssetServiceError`;
- `canonicalAssetPath(value)`;
- `createAssetService(options)`;
- `assetService`.

## Központi útvonalak

A szolgáltatás alapértelmezett assetgyökerei:

- játékosportrék: `assets/portraits`;
- kártyahátlap: `assets/cards/back`;
- kocsmai barátok: `assets/friends`;
- kocsmaháttér: `assets/pub/background`;
- klublogók: `assets/clubs`;
- zászlók: `assets/flags`.

A támogatott kiterjesztéssorrend változatlan:

1. `png`;
2. `jpg`;
3. `jpeg`;
4. `webp`.

## Candidate API

A szolgáltatás a következő képcandidate-listákat állítja elő:

- `playerPortraitCandidates(playerOrId, options)`;
- `clubLogoCandidates(clubOrId, options)`;
- `flagCandidates(nationKey)`;
- `cardBackCandidates()`;
- `friendCandidates(id)`;
- `pubBackgroundCandidates()`;
- `extensionCandidates(base)`.

A candidate-listák:

- üres értékeket nem tartalmaznak;
- nem tartalmaznak duplikációt;
- stabil sorrendűek;
- nem végeznek hálózati kérést;
- befagyasztott tömbként kerülnek visszaadásra.

## Játékosportrék kompatibilitása

A kártyakomponens korábbi sorrendje megmarad:

1. helyi portréjelöltek a négy támogatott kiterjesztéssel;
2. a játékosadat `meta.imageUrl` mezője, ha jelen van.

A branding request guard a távoli vagy nem engedélyezett képet továbbra is blokkolja, így a jogi működés változatlan.

A placeholder elérhető az asset-service API-jából, de a kártyák alapértelmezett candidate-listája nem kap automatikusan új placeholderképet. Ez megőrzi a jelenlegi CSS-iniciálé fallback vizuális viselkedését.

## Klublogó- és zászló-előkészítés

A szolgáltatás már közös API-t ad:

- stabil klubazonosító alapján képzett klublogójelöltekhez;
- kanonizált nemzetiségkulcs alapján képzett zászlójelöltekhez;
- jogtiszta klub-placeholderhez.

A 14. lépés nem kapcsol be új logókat vagy zászlóképeket a felületen. Csak a későbbi UI-migráció egységes alapját hozza létre.

## Jogi policy

Az asset-service központilag kezeli:

- az engedélyezett release asseteket;
- a védett portré-, logó-, klub-, liga-, háttér- és kártyamappákat;
- az útvonalak query/hash nélküli kanonikus alakját;
- a távoli URL felismerését;
- a védett, de nem jóváhagyott asset felismerését.

Publikus policy-műveletek:

- `isRemoteAssetUrl(value, context)`;
- `isApprovedReleaseAsset(path)`;
- `isProtectedUnapprovedArt(path)`;
- `placeholder(kind)`.

A tényleges böngészős `Image` request guard a `branding.js` fájlban marad, mert az DOM- és böngészőfüggő. A guard azonban már a központi asset-service szabályait használja.

## DOM-primitívek integrációja

A `js/ui/dom-primitives.js` többé nem tartalmaz saját kiterjesztéslistát vagy beégetett assetútvonalakat.

A kompatibilis `ART` API megmarad, de a metódusai az asset-service-re delegálnak:

- `ART.portrait(id)`;
- `ART.playerPortrait(card)`;
- `ART.cardBack()`;
- `ART.friend(id)`;
- `ART.pub()`;
- `ART.clubLogo(clubOrId)`;
- `ART.flag(nationKey)`.

A `tryArt()` továbbra is kizárólag a DOM-os képbetöltésért és a következő candidate kipróbálásáért felel.

## Branding integrációja

A `branding.js`:

- az asset-service placeholder-konstansait használja;
- az asset-service útvonal-kanonizálását használja;
- az asset-service release engedélylistáját használja;
- az asset-service protected-prefix policyjét használja;
- az asset-service távoli URL ellenőrzését használja a jelenlegi dokumentum originjével.

Megmarad a korábbi globális kompatibilitási objektum:

```js
globalThis.__FOCISKARTYAK_BRANDING__
```

## Hibakezelés

Strukturált asset-service hibák:

- `INVALID_EXTENSIONS`;
- `UNKNOWN_PLACEHOLDER`.

A gyökér- és placeholder-konfigurációk típusellenőrzöttek. Az extension-lista normalizálja a kezdő pontot, kisbetűsít és eltávolítja a duplikációkat.

## Standalone, PWA és Android

- az asset-service a standalone modulrendben a branding és a DOM-primitívek előtt szerepel;
- a modul top-level nevei nem ütköznek a flattenelt bundle más moduljaival;
- bekerül a PWA offline cache-be;
- a PWA cache-verzió emelkedik;
- az Android offline webcsomag a meglévő buildfolyamaton keresztül megkapja.

## Tesztelés

Az új `test/asset-service.test.mjs` ellenőrzi:

- az extension-sorrendet;
- az útvonal-kanonizálást;
- a portré-, kártyahátlap-, barát-, háttér-, klublogó- és zászlójelölteket;
- a metadata kép URL kompatibilitását;
- az opcionális placeholdert;
- a távoli URL felismerését;
- az approved release asseteket;
- a protected-prefix policyt;
- hibás extension- és placeholder-konfigurációkat;
- egyedi gyökerek és kiterjesztések támogatását;
- a DOM-függetlenséget;
- a DOM-primitívek delegálását;
- a kártyakomponens központi portréfeloldását;
- a branding központi policyhasználatát;
- a standalone modulrendet;
- a service worker cache-bejegyzést.

## Nem része ennek a lépésnek

- új játékosfotók letöltése vagy generálása;
- hivatalos klublogók használata;
- új zászlófájlok hozzáadása;
- a kártyák vizuális áttervezése;
- a CSS fallbackek módosítása;
- az opponent sprite-rendszer átalakítása;
- assetfájlok tömeges átnevezése vagy mozgatása;
- UI-prototype patchek összevonása.
