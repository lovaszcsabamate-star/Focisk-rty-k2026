/** Run the existing browser smoke test against the exact HTML copied into the Android APK. */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const MOBILE_INDEX = path.join(ROOT, 'mobile-www', 'index.html');
const STANDALONE = path.join(ROOT, 'Fociskartyak2026.html');
const BACKUP = path.join(ROOT, 'Fociskartyak2026.mobile-runtime-backup.html');
const RUNTIME_SCRIPT = path.join(HERE, 'runtime-browser-smoke.mjs');

if (!fs.existsSync(MOBILE_INDEX)) {
  throw new Error('Hiányzik a mobile-www/index.html. Futtasd előbb az npm run mobile:prepare parancsot.');
}
if (!fs.existsSync(STANDALONE)) {
  throw new Error('Hiányzik a Fociskartyak2026.html, ezért a mobilteszt nem indítható.');
}

const mobileHtml = fs.readFileSync(MOBILE_INDEX, 'utf8');
const requiredMarkers = [
  'mobile-webview-compatible',
  '__EMBEDDED_PLAYER_DATA__',
  'quickMatchStorageService',
  'beginUiEnhancementLayer',
  'new Session(players, source, meta',
];
for (const marker of requiredMarkers) {
  if (!mobileHtml.includes(marker)) throw new Error(`A mobil webcsomagból hiányzik: ${marker}`);
}
if (mobileHtml.indexOf('beginUiEnhancementLayer(') < mobileHtml.indexOf('/* ===== js/ui.js ===== */')) {
  throw new Error('A mobil webcsomag UI enhancement réteget indít az UI alaposztály inicializálása előtt.');
}

fs.copyFileSync(STANDALONE, BACKUP);
let result;
try {
  fs.copyFileSync(MOBILE_INDEX, STANDALONE);
  result = spawnSync(process.execPath, [RUNTIME_SCRIPT], {
    cwd: ROOT,
    stdio: 'inherit',
    timeout: 120_000,
    killSignal: 'SIGTERM',
    env: {
      ...process.env,
      FOCISKARTYAK_RUNTIME_TARGET: 'android-mobile-www',
    },
  });
} finally {
  fs.copyFileSync(BACKUP, STANDALONE);
  fs.rmSync(BACKUP, { force: true });
}

if (result.error?.code === 'ETIMEDOUT') {
  throw new Error('A mobil APK böngészős futástesztje 120000 ms után időtúllépéssel leállt.');
}
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`A mobil APK futásidejű tesztje hibával leállt (${result.status ?? 'ismeretlen'}).`);
}

console.log('✓ Az Android APK pontos mobil webcsomagja valódi böngészőben elindult és játszható.');
