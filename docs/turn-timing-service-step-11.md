# Fociskártyák 2026 – 11. lépés: explicit játékmenet-időzítés

## Cél

A globális `setTimeout`-felülírás megszüntetése, és az AI- valamint játékmenet-késleltetések áthelyezése egy DOM-mentes, injektálható szolgáltatásba.

## Korábbi kockázat

A `mobile-experience.js` korábban lecserélte a `globalThis.setTimeout` függvényt. A módosítás a prompt DOM-szövegéből próbálta felismerni az AI-választás két késleltetését.

Ez azért volt veszélyes, mert:

- minden később létrehozott böngészőidőzítőt érintett;
- az időzítés a felületi magyar szövegtől függött;
- a működés betöltési sorrendhez kötődött;
- más modulok és külső könyvtárak időzítőit is módosíthatta;
- nehezen volt izoláltan tesztelhető.

## Új szolgáltatás

`js/services/turn-timing-service.js`

A modul:

- nem használ DOM-ot;
- nem módosít globális függvényt;
- név szerinti késleltetéseket ad;
- továbbra is elfogad számszerű késleltetést a kompatibilitás miatt;
- figyelembe veszi az animációk ki- és bekapcsolását;
- tesztekhez saját timer függvénnyel injektálható.

## Publikus API

- `TURN_DELAY` – a támogatott időzítési kulcsok;
- `TURN_DELAY_MS` – az alapértékek;
- `REDUCED_ANIMATION_DELAY_MS` – animációmentes felső korlát;
- `TurnTimingError` – strukturált hibák;
- `createTurnTimingService(options)` – injektálható szolgáltatás;
- `turnTimingService` – alapértelmezett példány.

## Késleltetések

- AI kategóriaválasztás: 90 ms;
- AI kártyaválasztás: 110 ms;
- játékosi kártya felfedése: 250 ms;
- eredmény felfedése: 320 ms;
- eredménytartás: 650 ms;
- visszatöltött AI-lépés: 350 ms.

Az animációk kikapcsolásakor a hosszabb késleltetések legfeljebb 90 ms-ra csökkennek.

## Session-integráció

A `Session` saját timing service példányt kap. A `delay()` metódus megmarad kompatibilitási határként, de már a service `wait()` függvényét hívja.

Az AI két lépése explicit kulcsot használ:

- `TURN_DELAY.AI_CHOOSE_ATTRIBUTE`;
- `TURN_DELAY.AI_CHOOSE_CARD`.

Így a késleltetés többé nem a prompt szövegéből következtethető ki.

## Mobilréteg

A `mobile-experience.js` fájlból kikerül:

- `FAST_AI_TURN_DELAYS`;
- `adjustedTurnDelay()`;
- `installFastAiTurnTimer()`;
- `__FOCISKARTYAK_FAST_AI_TIMER__`;
- a `globalThis.setTimeout` felülírása.

A megszakadt AI-lépések helyreállítási eseménykezelője megmarad. Ez normál `window.setTimeout` hívást használ, globális módosítás nélkül.

## Kompatibilitás

Nem változik:

- a felhasználó által érzékelt AI-sebesség;
- az animációk kikapcsolásának gyorsító hatása;
- a Klasszikus és Büntetőpárbaj szabályai;
- a Session külső működése;
- az AI döntési algoritmusa;
- a mentési formátum;
- a felület.

## Tesztelés

A `test/turn-timing-service.test.mjs` ellenőrzi:

- a globális `setTimeout` változatlanságát;
- az AI 90 és 110 ms-os késleltetését;
- az animációmentes 90 ms-os korlátot;
- a numerikus kompatibilitást;
- az injektált timer működését;
- az ismeretlen vagy hibás késleltetések elutasítását;
- a DOM-függetlenséget;
- a mobil globális patch eltávolítását;
- a Session explicit kulcsait;
- a standalone modulrendet;
- a PWA-cache bejegyzését.

## Nem része ennek a lépésnek

- az AI döntési logikájának módosítása;
- új nehézségi szintek;
- animációk áttervezése;
- a teljes Session további felbontása;
- a helyreállítási eseménykezelő külön szolgáltatásba mozgatása.
