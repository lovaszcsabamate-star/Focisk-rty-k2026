# Fociskártyák 2026 Android alkalmazásikon

Az Android launcher ikon kizárólag a jóváhagyott `futball_kártya_embléma_26.png` képből származik. A PNG tömörített Base64-forrása a `fociskartyak-app-icon.base64` fájlban található.

A `scripts/apply-android-icon.mjs` az Android-projekt létrehozása után automatikusan elkészíti:

- a normál `ic_launcher.png` ikonokat minden `mipmap-*` sűrűséghez;
- a kerek `ic_launcher_round.png` ikonokat;
- az adaptív `ic_launcher_foreground.png` rétegeket Android safe-zone méretezéssel;
- az adaptív ikon XML-fájljait és a sötétzöld háttérszínt.

A generálás parancsa:

```bash
node scripts/apply-android-icon.mjs
```

A parancshoz ImageMagick és egy előzőleg létrehozott Capacitor Android-projekt szükséges.
