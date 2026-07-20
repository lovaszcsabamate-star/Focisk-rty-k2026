# Fociskártyák 2026 – Android

A projekt a meglévő, teljesen offline egyfájlos játékbuildet Capacitor segítségével Android-alkalmazásba csomagolja.

## APK letöltése

A GitHub `Releases` oldalán a **Fociskártyák 2026 – Android** kiadásból tölthető le a `Fociskartyak2026-Android.apk` fájl.

Az APK tesztverzió, ezért az Android telepítéskor kérheti az ismeretlen forrásból származó alkalmazások engedélyezését.

## Helyi Android-build

Előfeltételek:

- Node.js 22 vagy újabb;
- Android Studio és Android SDK;
- Java 21.

Parancsok:

```bash
npm install
npm run mobile:add:android
cd android
./gradlew assembleDebug
```

A létrejött APK helye:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Ha az `android` könyvtár már létezik, frissítéshez:

```bash
npm run mobile:sync:android
```

## Automatikus build

A `.github/workflows/android-apk.yml` minden `main` ági frissítés után:

1. lefuttatja a lintet és a játékteszteket;
2. elkészíti az offline mobil webcsomagot;
3. létrehozza az Android-projektet;
4. elkészíti az installálható APK-t;
5. feltölti build-artifactként és frissíti a `mobile-latest` kiadást.
