# Tournament UI Improvement – Klubcímerek + egyszerűbb Torna mód

## Cél

Ez a fejlesztés kizárólag a meglévő Torna mód vizuális és használhatósági rétegét finomítja. Nem módosítja a torna-domain szabályait, a sorsolást, a továbbjutást, a mérkőzés-finalizációt vagy a mentési sémát.

## Klubcímerek

A Torna UI ugyanazt a jogtiszta, generált pajzslogó-mechanizmust használja, amelyet a Quick Match és a korábbi Torna nézetek is használnak. Hivatalos vagy távoli klubcímer nem került a projektbe.

A 2025/26-os NB I 12 klubjához a közös klubszín + rövid klubjel prezentáció kapcsolódik:

- DVSC
- DVTK
- ETO
- FTC
- KISV
- KBSC
- MTK
- NYÍR
- PAKS
- PAFC
- UTE
- ZTE

A `js/tournament/tournament-ui-improvement.js` a Torna v2 felületén található klubjeleket a már meglévő `branding.js` generált SVG-pajzs rendszeréhez köti. Emiatt például a Puskás Akadémia FC nem `PAF` szöveges fallbackként jelenik meg, hanem a kanonikus `PAFC` klubjellel és a megfelelő klubszínekkel generált pajzson.

### Címerrel támogatott tornafelületek

- Torna v2 csapatválasztó nagy klubkártyája;
- csapatválasztó mini gyorsválasztója;
- Saját kupa kiválasztott/candidate csapatai, ahol klub szerepel;
- Tournament Lineup 1.1 saját csapat és ellenfél fejléc;
- a korábban már támogatott Torna Center következő mérkőzés;
- tabella;
- bracket / tornaág;
- eredménylista;
- tornazáró / bajnok nézet.

A válogatottak és föderációs csapatok meglévő zászló- és badge-megjelenítése változatlan marad.

## Kupa- és tornaválasztó

A kupa választás logikája változatlan, de a vizuális karakter egyértelműbb:

- **Magyar Bajnokság** – ligás/stadionos karakter, `Szezon` jelölés;
- **Magyar Kupa** – melegebb kupahangulat, `Kieséses` jelölés;
- **Nemzetközi / Nemzetek kupa** – kékebb nemzetközi karakter;
- **Saját kupa** – zöldes, testreszabható karakter.

A trófea kisebb, a fő információk közelebb kerültek egymáshoz, és a kupa kártya kevesebb vertikális helyet foglal. A helyszínfülek hosszabb feliratai mobilon többé nem kényszerülnek egysoros ellipszises rövidítésre.

## Egyszerűbb folyamat

A meglévő lépések megmaradtak, de rövidebb címkéket kapnak:

- `Tornaválasztás` → **Kupa**;
- `Csapatválasztás` → **Csapat**;
- `Torna beállításai` → **Beállítások**;
- `Összefoglaló` → **Indítás**.

A csapatválasztó fejlécének hosszú `Kilépés` gombja kompakt, 44 px-es `×` vezérlővé válik, teljes `aria-label` megtartásával. A fő CTA marad vizuálisan domináns.

## Mobil UX

A UI-réteg külön szabályokat tartalmaz 560 px, 390 px és 340 px alatt, így a kért 320 / 360 / 390 / 412 / 480 px viewportok mind a mobil elrendezési tartományba esnek.

Fő változások:

- nincs szándékolatlan vízszintes overflow;
- kisebb, de jól olvasható kupa- és csapatkártyák;
- hosszú klubnevek törhetők;
- a csapatlapozó nyilak nem takarják a címert vagy a nevet;
- a sticky alsó akciósáv mobilon statikussá válik, így nem fedi a mini csapatválasztót;
- a fontos nyilak, súgó és CTA-k legalább kb. 44 px érintési célok;
- 390 px alatt a meta-információk nem kényszerülnek káros egysoros elrendezésre.

## Technikai integráció

Az új modul:

`js/tournament/tournament-ui-improvement.js`

Bekötési pontok:

- `js/tournament-experience-v2.js` – böngészős runtime;
- `scripts/postprocess-standalone.mjs` – egyfájlos standalone build;
- `sw.js` – atomikus PWA CORE cache;
- `.github/workflows/tournament-mode.yml` – syntax, regresszió, standalone és mobile build gate.

Regressziós teszt:

`test/tournament-ui-improvement.test.mjs`

A teszt ellenőrzi a 12 klub kanonikus rövid jelét és színeit, a kupa vizuális kategóriáit, a 44 px touch-target szerződést, a mobil breakpointokat, a távoli klubcímer-URL-ek hiányát, valamint a browser/standalone/PWA bekötést.

## Ismert korlátozások

- A klubpaletta jelenleg a 2025/26-os NB I 12 ismert klubjára explicit. Új vagy ismeretlen klubnál a meglévő általános fallback marad, amíg a központi klubprezentáció nem bővül.
- Nem kerültek be hivatalos klubcímerek; a pajzsok saját, generált, jogtiszta vizuális elemek.
- A fejlesztés nem változtatja meg a Torna mód játékszabályait vagy adatait.
