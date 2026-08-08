# Beta Stabilization 1.2 + Match Experience Polish 1.0

## Cél

Ez a fejlesztési ciklus két egymásra épülő részt zárt le:

1. **Beta Stabilization 1.2 – Session Recovery & Match Flow Hardening**
2. **Match Experience Polish 1.0**

A vizuális fejlesztés csak a stabilizációs acceptance gate teljes zöldülése után indult el. A játékszabályok, az AI eredménylogika, a pontozás és a meglévő játékmódok nem változtak.

## Talált stabilitási problémák

- aszinkron körfolyamatokból későn visszatérő Promise egy újabb művelet állapotára hathatott;
- a `busy` interakciós lock tulajdonjoga nem volt tranzakcióhoz kötve;
- Torna → keret → Quick Match átadás közben process-kill esetén az egyszer használatos launch marker elveszhetett;
- félbemaradt tournament pending launch, stale lineup vagy érvénytelen `currentMatchId` nem rendelkezett egységes induláskori reconciliationnel;
- kezeletlen runtime/Promise hiba után nem volt központi, felhasználó által indítható helyreállítási UI;
- a recovery modulok első körben nem voltak részei a standalone/Android és PWA offline magjának;
- a liveness teszt nem reprodukálta teljesen a valódi kategória-coverage inicializálást, ezért az opcionális magasságkategóriát külön kellett életciklus-helyesen bekapcsolni.

## Javított stabilitási problémák

### Művelet-tokenes körvédelem

A `RoundController` aszinkron műveletei egyedi operation tokent kapnak. Csak az a Promise:

- oldhatja fel a `busy` lockot;
- hajthat végre AI-akciót;
- léphet tovább a következő körre;
- írhatja vissza az eredménynézetet,

amely még az aktuális művelet tulajdonosa és ugyanahhoz a játékpéldányhoz tartozik.

Nem került be globális watchdog vagy önkényes, időalapú játékmegszakítás.

### Tranzakciós Quick Match / Torna handoff

Az indítási lánc tartós inflight handoff markert használ. A marker rögzíti a staging előtt létező mérkőzésmentés `savedAt` értékét is.

Ez megkülönbözteti:

- a valóban létrejött új Session snapshotot;
- a staging előtt már létező régi mentést;
- a process-kill miatt félbemaradt launchot.

Ha nincs új snapshot, a launch a következő induláskor biztonságosan visszaállítható.

### Session reconciliation

Az új `session-recovery-service.js` induláskor ellenőrzi és rendezi:

- orphan tournament pending launch;
- érvénytelen Quick Match launchot;
- félbemaradt inflight handoffot;
- hibás `currentMatchId` értéket;
- stale vagy hibás lineup staginget;
- sérült, egyszer használatos launch JSON-t.

Érvényes torna- és mérkőzésmentést nem töröl automatikusan.

### „Játék helyreállítása”

Runtime vagy aszinkron hiba esetén központi recovery panel jelenhet meg:

- `Játék helyreállítása` – az utolsó konzisztens snapshotból újraépíti a futást;
- `Vissza a főmenübe` – csak az átmeneti launch/pending/lineup állapotot tisztítja.

A panel alertdialog szemantikát, fókuszkezelést, safe-area paddingot és reduced-motion támogatást használ.

## Új és bővített regressziós tesztek

- `test/session-recovery.test.mjs`
  - pending launch rollback/commit;
  - process-kill handoff;
  - snapshot baseline;
  - invalid launch;
  - invalid `currentMatchId`;
  - stale lineup.
- `test/round-operation-liveness.test.mjs`
  - stale Promise;
  - dupla kártya-akció;
  - recovery lock feloldása.
- `test/tournament-match-liveness.test.mjs`
  - 12 NB I klub;
  - mind a 66 klubpár;
  - 5 RNG seed;
  - Klasszikus + Büntető mód;
  - összesen **660 automatikus mérkőzés**;
  - **9562 állapotátmenet**;
  - **132 `📏 Magasabb játékos` párbaj**;
  - egyetlen mérkőzés sem maradt érvényes következő lépés nélküli állapotban.
- `test/match-experience-polish.test.mjs`
  - HUD másodlagos sor;
  - Magasabb játékos címke;
  - duel logból származó legjobb kategória;
  - AI személyiségcsoportok.

## Match Experience Polish 1.0

### Kompakt focis HUD

A meglévő broadcast scoreboard kapott egy kompakt Match Experience réteget:

- Quick Match/Torna esetén központi, jogtiszta generált klubbadge;
- rövid klubnév;
- mindig látható pontállás;
- torna/forduló vagy Quick Match kontextus;
- másodlagos sor a körrel/párbajjal és az aktív kategóriával;
- Büntető módban külön `Büntetőpárbaj` / `Hirtelen halál` jelzés.

A HUD nem mutat játékos-összpontszámot.

### Központi klubbranding

A 12 NB I klub generált, jogtiszta játékbeli prezentációja bekerült a központi branding API-ba. A Match Experience ugyanazt a `.quick-team-mark` badge-rendszert használja, mint a Quick Match és Torna UI.

Hivatalos klubcímert vagy távoli klublogót a fejlesztés nem vezetett be.

### Meccs előtti VS intro

A meglévő rövid, kihagyható intro bővült:

- klubbadge-ekkel;
- teljes csapatnevekkel;
- torna + szakasz kontextussal, ha rendelkezésre áll;
- `MÉRKŐZÉS INDÍTÁSA` vizuális CTA-val;
- Torna esetén `Keret: 11/11 ✓` jelzéssel, de csak tényleges 11-es aktív lineupnál.

Nem került be új játékmotor-állapot vagy hosszú blokkoló animáció.

### Kártyapárbaj

Eredménykor a két lap között megjelenik:

- a tényleges összehasonlított kategória;
- a két tényleges, formázott érték;
- `VS` elválasztás;
- rövid CSS-megjelenés.

Például a magasságkategória tényleges centiméterértékeket használ.

### Köreredmény

A verdict alatt rövid összefoglaló mutatja:

- ki nyerte a párbajt;
- melyik párbaj/kör zárult le;
- hogyan áll a mérkőzés.

### Meccs végi összefoglaló

A végeredmény panel Quick Match/Torna esetén klubbadge-es scoreline-t kap. A „Legjobb kategória” kizárólag a tényleges duel logból számolódik.

A meglévő `A mérkőzés játékosa` funkció megmaradt; nem készült második, kitalált ratingrendszer.

### AI személyiség UI

A meglévő nehézségi motor paraméterei változatlanok. A 9 ellenfél három, felhasználó számára egyértelműbb UI-karaktercsoportot kapott:

- `🍺 Kicsit spicces`;
- `🧔 Törzsvendég`;
- `🦈 Kocsmai cápa`.

A személyiség az ellenfélválasztóban, profilban, scoreboard-kontextusban és eredményben látható, de nem írja át az AI motor döntési szabályait.

## Hang, haptika és animációsebesség

A meglévő rövid, offline WebAudio visszajelzések és hangkapcsoló változatlanul megmaradtak; új külső hangasset nem került a release-be.

A külön haptika-beállítás és a `Gyors / Normál / Filmes` animációsebesség ebben a ciklusban **nem került be**, mert ezekhez új beállítási szerződés és további Android lifecycle/regressziós felület kellett volna. A stabilitás elsőbbséget kapott.

## Mobilos ellenőrzés

A kötelező mobil layout smoke az alábbi szélességeken fut:

- 320 px;
- 360 px;
- 390 px;
- 412 px;
- 480 px.

Ezen felül a browser/mobile phase smoke valódi mérkőzésfázisokat futtat, és ellenőrzi többek között:

- horizontal overflow hiányát;
- legalább 44 px-es touch targeteket;
- kategóriaválasztót;
- kártyakéz és csatatér arányát;
- aktív mérkőzés runtime-ot;
- portrait és landscape használhatóságot.

A Match Experience CSS külön 480 és 360 px alatti HUD/duel szabályokat, valamint alacsony landscape viewport szabályt tartalmaz.

## Accessibility

Megmaradt és bővült:

- látható fókusz;
- aria-label a recovery és Match Experience elemeknél;
- reduced-motion támogatás;
- nem kizárólag színre támaszkodó állapotjelzés;
- badge + név kombináció;
- kompakt scoreboardban a pontszám folyamatos láthatósága.

## Release gate

A végső `Beta Stabilization 1.2 release gate` futás:

- GitHub Actions run: **31260114833**;
- web/PWA/mobile regresszió: **SUCCESS**;
- Android debug APK: **SUCCESS**.

A gate tartalmazta:

- `npm audit --omit=dev --audit-level=high`;
- lint + új Match Experience syntax check;
- teljes `npm test`;
- `test:all`;
- recovery/liveness regressziók;
- 660 mérkőzéses stresszteszt;
- Tournament / Lineup / Quick Match regressziók;
- Match Experience regresszió;
- accessibility;
- PWA audit és offline cache;
- production build;
- standalone build és runtime;
- browser/mobile smoke;
- Android WebView asset smoke;
- `lintDebug`;
- `assembleDebug`;
- APK SHA-256 + artifact.

A párhuzamos meglévő Project validation, Pull request validation, Quick Match, Torna, Height, Localization, standalone/build és több APK-workflow szintén zöld volt a végső kódcommiton.

## Ismert korlátok

- a haptika külön kapcsolóval későbbi, alacsony prioritású fejlesztés;
- a háromfokozatú animációsebesség későbbi fejlesztés;
- új hangassetek nem kerültek be, a meglévő offline hangrendszer maradt;
- a fejlesztés nem tartalmaz Bluetooth/online multiplayert, accountot, szerveroldali mentést vagy új játékmotort;
- a klubbadge-ek szándékosan generált, jogtiszta játékbeli emblémák, nem hivatalos klubcímerek.

## Release verdict

**READY FOR RELEASE CANDIDATE**

A PR szándékosan nincs automatikusan merge-elve.