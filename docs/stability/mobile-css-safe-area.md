# Mobil CSS és safe-area rétegsorrend

A kézszintű nagyító és a mobil kiválasztási nézet safe-area, rövid kijelzős és fekvő nézeti szabályai a `css/mobile-selection-fix.css` modulban maradnak. Az `index.html` nem tartalmazza ezeket külön inline felülírásként.

A cél, hogy a normál böngészős, standalone, PWA/offline és Android WebView build ugyanazt a CSS-rétegsorrendet használja. A mobil szabályoknak a később betöltődő általános UI-rétegekkel szemben is meg kell őrizniük a kompakt nagyítógomb-méreteket, miközben új külső stylesheet-függőség nem jön létre.

A regressziós ellenőrzés a stylesheet sorrendet, a service-worker cache jelenlétét, a safe-area szabályokat és a standalone beágyazási sorrendet is védi.
