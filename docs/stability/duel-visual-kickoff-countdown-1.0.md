# Duel Visual Polish + Kickoff Countdown 1.0

## Állapot

A fejlesztési kör a `feat/duel-visual-kickoff-countdown-1` ágon készült el, és a PR #160 közvetlenül a `main` ágat célozza.

A függő Beta Stabilization 1.2 + Match Experience Polish 1.0 fejlesztés (PR #159) 2026-08-09-én bekerült a `main` ágba, merge commit: `7c49dfa39a4e93f90ce01d09007ffb3ca475cb40`.

## Duel Visual Polish

A párbaj eredményének megjelenítése mindkét kijátszott lapot megtartja. A vesztes lap explicit `duel-visual-loser` állapotot kap, enyhe grayscale/saturation/brightness/opacity csökkentéssel, miközben a név, statisztikák és aktív összehasonlított érték olvasható marad. Döntetlennél nincs vesztes állapot.

A játékmotor, pontozás és AI döntési logika nem változott.

## Kickoff Countdown

Az új kickoff-szekvencia:

1. `3`
2. `2`
3. `1`
4. `Hajrá!`
5. síp
6. tényleges első kör / AI-akció

A countdown tokenizált, egyszerre csak egy példány futhat, reset/recovery esetén megszakítható, és a Session valódi `beginRound()` hívása csak a completion callback után történik. A `busy` interakciós lock a rövid kickoff teljes ideje alatt aktív.

A `prefers-reduced-motion` környezet rövidített, visszafogottabb időzítést és animációt kap.

## Síp asset

Lokális, saját készítésű asset:

`assets/ui/referee-whistle.svg`

Az asset:

- nem használ külső CDN-t;
- nem tartalmaz klub-, liga-, márka- vagy gyártói arculatot;
- szerepel az assetlicenc-nyilvántartásban;
- PWA CORE_SHELL erőforrás;
- standalone és Android WebView bundle esetén data URI-ként beágyazódik.

## Tesztelési szerződés

A dedikált `Duel Visual + Kickoff Countdown 1.0` release gate ellenőrzi:

- a pontos `3 → 2 → 1 → Hajrá! → Síp` sorrendet;
- dupla countdown és stale timer elleni védelmet;
- winner/loser/tie vizuális állapotot;
- Session kickoff gate-et;
- asset-jogtisztaságot és PWA cache-integrációt;
- teljes projekt regressziót;
- Session Recovery és round-operation liveness teszteket;
- 660 mérkőzéses Tournament stressztesztet;
- production és standalone buildet;
- valós Chrome runtime smoke-ot;
- mobil layoutot 320 / 360 / 390 / 412 / 480 px szélességeken;
- Android WebView bundle-t;
- Android `lintDebug` + `assembleDebug` buildet;
- debug APK artifactot és SHA-256 lenyomatot.

A browser smoke nem fix, vak kickoff timeoutot használ: a `.kickoff-countdown-intro` tényleges lezárását várja meg, majd csak ezután ellenőrzi a játék első interaktív állapotát.

## Merge-szabály

A PR #160 nem merge-elhető automatikusan. A `main` elleni záró CI sikeres lefutása után felülvizsgálatra / kézi merge-re kész állapotban marad.
