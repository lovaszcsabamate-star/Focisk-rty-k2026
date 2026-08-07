# Chrome/Chromium smoke tesztek időkorlátai

A böngészős regressziós tesztek közös `scripts/lib/chrome-smoke-runner.mjs` futtatót használnak, ezért egy beragadt Chrome/Chromium folyamat nem tud korlátlan ideig blokkolni egy CI jobot.

A jelenlegi felső korlátok:

- Chrome/Chromium bináris felderítése: 5 másodperc jelöltenként;
- általános headless smoke futás: 25 másodperc;
- teljes standalone mobil-layout futás: 45 másodperc mérésenként;
- teljes Klasszikus/Büntető browser-runtime: 45 másodperc játékmódonként;
- az Android mobil-runtime teljes gyermekfolyamata: 120 másodperc.

A hosszabb, 45 másodperces korlát kizárólag a teljes alkalmazást hideg GitHub runneren betöltő smoke tesztekre vonatkozik. A timeout továbbra is kemény felső korlát; időtúllépéskor a folyamat leáll, a riport `timeout` hibakategóriát és diagnosztikai stderr-részletet őriz meg.

A változtatás nem érinti a játék logikáját, vizuális megjelenését vagy játékosadatbázisát.