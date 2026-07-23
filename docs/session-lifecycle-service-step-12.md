# Fociskártyák 2026 – 12. lépés: Session lifecycle szolgáltatás

## Cél

A böngésző-életciklus, az automatikus mentésindítás, a globális hibák felületi kezelése és a mobil vissza-gombos kilépés leválasztása a nagy `Session` osztályról.

## Korábbi állapot

A `Session.installLifecycleHandlers()` közvetlenül regisztrálta:

- a `visibilitychange` eseményt;
- a `pagehide` eseményt;
- a globális `error` eseményt;
- az `unhandledrejection` eseményt;
- a `popstate` eseményt.

Ugyanez a metódus kezelte a history guard felépítését is, míg a `handleBackAction()` tárolta a kétszeri vissza-gombos kilépés időbélyegét és közvetlenül távolította el a `popstate` listenert.

A regisztráció és az eltávolítás ezért több helyre oszlott, és izolált tesztben csak valódi böngészőglobálisokkal lett volna ellenőrizhető.

## Új szolgáltatás

Az új modul:

- `js/app/session-lifecycle-service.js`

Publikus API:

- `SESSION_EXIT_CONFIRMATION_MS`;
- `SESSION_LIFECYCLE_MESSAGES`;
- `createSessionLifecycleService(options)`.

A létrehozott szolgáltatás metódusai:

- `install(callbacks)`;
- `dispose()`;
- `requestExit()`;
- `isInstalled()`;
- `hasHistoryGuard()`.

## Felelősségek

### Automatikus mentésindítás

A szolgáltatás meghívja az `onSave` callbacket:

- amikor a dokumentum `hidden` állapotba kerül;
- `pagehide` eseménynél;
- globális szinkron hiba után;
- nem kezelt Promise-elutasítás után.

A mentési callback hibája nem szakítja meg az eseménykezelést; a hiba naplózásra kerül.

### Globális hibák

A szolgáltatás megtartja a korábbi magyar felületi üzeneteket:

- `Váratlan hiba történt. A játékállást megőriztük.`;
- `Egy művelet nem fejeződött be. Próbáld újra.`

A tényleges UI-megjelenítés továbbra is a Session által átadott `onToast` callback felelőssége.

### History guard

Telepítéskor a szolgáltatás megpróbálja létrehozni:

1. a `base` history állapotot;
2. a `guard` history állapotot;
3. a `popstate` listenert.

Korlátozott beágyazott böngészőben a history integráció opcionális. Ha a History API hibát dob, a többi életciklus-listener továbbra is működik.

### Kétszeri vissza-gombos kilépés

Az első `requestExit()` hívás megjeleníti:

- `A kilépéshez nyomd meg újra a Vissza gombot`.

Ha 1600 ms-on belül ismét meghívják:

- a `popstate` guard listener eltávolításra kerül;
- a szolgáltatás `history.go(-2)` hívással engedi a kilépést.

Az időforrás injektálható, ezért a viselkedés várakozás nélkül tesztelhető.

## Session-integráció

A `Session` konstruktor saját lifecycle-service példányt kap.

A kompatibilitás érdekében az `installLifecycleHandlers()` metódus megmarad, de már csak callbackeket köt a szolgáltatáshoz:

- `onSave` → `saveCurrentGame()`;
- `onToast` → `ui.showToast()`;
- `onBackAction` → `handleBackAction()`.

A `handleBackAction()` továbbra is a játékspecifikus sorrendről dönt:

1. kártyainspektor bezárása;
2. overlay visszalépése;
3. folyamatban lévő játéknál szünetmenü;
4. egyébként kilépési megerősítés.

A negyedik lépést már a `lifecycle.requestExit()` végzi. A `Session` többé nem tárol `exitTapAt` vagy `_popStateHandler` mezőt.

## Idempotens kezelés

Az `install()` és `dispose()` idempotens:

- többszöri telepítés nem duplikál listenereket;
- többszöri eltávolítás nem okoz hibát;
- a `dispose()` minden regisztrált eseménykezelőt eltávolít;
- a belső kilépési időbélyeg és callbackek törlődnek.

## Függőséginjektálás

A szolgáltatás teszteléshez elfogadja:

- `windowRef`;
- `documentRef`;
- `historyRef`;
- `logger`;
- `now`;
- `exitConfirmationMs`.

A modul nem importál UI-t, játékmotort, storage-ot vagy játékosadatot.

## Standalone, PWA és Android

A lifecycle-service:

- a standalone modulrendben a `main.js` előtt szerepel;
- bekerül a PWA offline cache-be;
- így az Android offline webcsomagba is bekerül.

A cache-verzió a 12. lépésben `v58`.

## Tesztelés

A `test/session-lifecycle-service.test.mjs` ellenőrzi:

- az idempotens telepítést és eltávolítást;
- az összes listener regisztrációját;
- a háttérbe kerülés és `pagehide` mentését;
- a szinkron és aszinkron hiba üzenetét;
- a hibák utáni mentést;
- a `popstate` history guard újraépítését;
- a kétszeri vissza-gombos kilépést;
- a listener eltávolítását kilépés előtt;
- a korlátozott History API biztonságos kezelését;
- a mentési callback hibájának elszigetelését;
- a Session forrásszerződését;
- a standalone modulrendet;
- a PWA-cache bejegyzését.

## Nem része ennek a lépésnek

- a Session teljes felbontása;
- a menü- és overlay-navigáció áttervezése;
- új mentési események;
- analytics vagy hibakövető szolgáltatás;
- a játékszabályok, AI vagy felület módosítása.
