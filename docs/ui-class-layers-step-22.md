# Fociskártyák 2026 – 22. lépés: izolált UI-osztályrétegek

## Cél

A korábbi UX-, mobil-, scoreboard-, reliability-, accessibility- és vizuális modulok ne ugyanazt a közös `UI.prototype` objektumot írják felül egymás után.

A működés és a meglévő modulok viselkedése megmarad, de minden enhancement modul saját, névvel ellátott `UI`-alosztályt kap.

## Korábbi kockázat

A korábbi pipeline ugyan helyes sorrendben töltötte be a modulokat, de a modulok importáláskor közvetlenül módosították ugyanazt a prototípust.

Ennek hátrányai:

- egy későbbi modul láthatatlanul felülírhatott egy korábbi metódust;
- nehéz volt megállapítani, melyik modul melyik metódus tulajdonosa;
- sikertelen modulbetöltés után nem lehetett csak az aktuális réteget visszavonni;
- a böngészős és a standalone build ugyanazt a viselkedést eltérő technikai úton állította elő.

## Új osztálylánc

A `js/ui.js` most külön kezeli:

- az érintetlen `UIBase` osztályt;
- az alkalmazás számára exportált, élő `UI` osztálykötést;
- az aktuális enhancement réteg indítását;
- a réteg lezárását;
- hibánál az aktuális réteg visszavonását;
- a telepített rétegek diagnosztikai listáját.

Publikus API:

```text
UI
beginUiEnhancementLayer(name)
commitUiEnhancementLayer(name)
rollbackUiEnhancementLayer(name)
getUiEnhancementLayers()
```

Minden modul előtt új osztály jön létre:

```text
UIBase
  └─ ux.js
      └─ ux-fixes.js
          └─ matchday.js
              └─ opponents.js
                  └─ ...
```

Egy modul saját felülírásai csak az adott osztály prototípusán jelennek meg. A korábbi metódusok örökléssel érhetők el.

## Böngészős pipeline

A `js/ui/ui-enhancement-pipeline.js` minden modulnál:

1. elindít egy új UI-osztályréteget;
2. betölti a modult;
3. siker esetén lezárja a réteget;
4. hiba esetén csak az aktuális réteget vonja vissza;
5. újrapróbáláskor a már sikeresen telepített modulokat nem futtatja újra.

A pipeline továbbra is sorrendtartó és idempotens.

## Standalone és Android

A standalone builder ugyanazokat a modulokat ugyanabban a sorrendben lapítja a HTML-be, de minden enhancement fájl köré explicit rétegindítást és rétegzárást helyez.

Így az alábbi célok azonos architektúrával működnek:

- böngészős alkalmazás;
- egyfájlos HTML;
- PWA/offline használat;
- Android webcsomag.

## PWA

A cache-verzió `v68`.

A korábban kimaradt `visual-settings-persistence.js` is bekerült az offline shellbe.

## Regressziós védelem

Új teszt:

```bash
npm run test:ui-class-layers
```

Ellenőrzi:

- az alosztályláncot;
- az alapmetódusok öröklését;
- a saját rétegmetódusokat;
- a rétegek diagnosztikai listáját;
- a rollbacket;
- a párhuzamos vagy hibás rétegkezelés elutasítását.

A pipeline-teszt külön ellenőrzi:

- a begin/import/commit sorrendet;
- a sikertelen modul rollbackjét;
- az újrapróbálás folytatását;
- a standalone rétegezést;
- a PWA cache-verziót.

## Megmaradt működés

Nem változik:

- egyik játékmód szabálya;
- a kártyák és eredményjelző megjelenése;
- a mobil kezelőfelület;
- a pakliválasztás;
- az ellenfelek;
- a játékosadatok;
- a mentési formátum;
- a standalone és Android használat.

## Eredmény

A régi, közös prototípust egymás után módosító futásidejű lánc megszűnt. A kompatibilitási modulok viselkedése megmaradt, de a felülírások elkülönített, diagnosztizálható és visszavonható osztályrétegeken futnak.
