/** Build the dependency-free game and prepare Capacitor's mobile web directory. */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const MOBILE_DIR = path.join(ROOT, 'mobile-www');
const STANDALONE_FILE = path.join(ROOT, 'Fociskartyak2026.html');

execFileSync(process.execPath, [path.join(HERE, 'build-standalone.mjs')], {
  cwd: ROOT,
  stdio: 'inherit',
});

fs.rmSync(MOBILE_DIR, { recursive: true, force: true });
fs.mkdirSync(MOBILE_DIR, { recursive: true });

const standalone = fs.readFileSync(STANDALONE_FILE, 'utf8')
  .replace(
    '</head>',
    '  <meta name="application-name" content="Fociskártyák 2026">\n'
      + '  <meta name="format-detection" content="telephone=no">\n'
      + '</head>',
  );

fs.writeFileSync(path.join(MOBILE_DIR, 'index.html'), standalone);

const copies = [
  ['manifest.webmanifest', 'manifest.webmanifest'],
  ['assets', 'assets'],
];

for (const [sourceRelative, targetRelative] of copies) {
  const source = path.join(ROOT, sourceRelative);
  if (!fs.existsSync(source)) {
    console.warn(`[mobile] Figyelmeztetés: a(z) ${sourceRelative} nem található, ezért nem került a mobilcsomagba.`);
    continue;
  }
  fs.cpSync(source, path.join(MOBILE_DIR, targetRelative), { recursive: true });
}

const hasAnyExtension = relativeBase => ['png', 'jpg', 'jpeg', 'webp', 'svg']
  .some(extension => fs.existsSync(path.join(ROOT, `${relativeBase}.${extension}`)));

const optionalAssetChecks = [
  ['assets/portraits', () => fs.existsSync(path.join(ROOT, 'assets/portraits')), 'játékosportrék mappája'],
  ['assets/cards/back', () => hasAnyExtension('assets/cards/back'), 'kártyahátlap'],
  ['assets/pub/background', () => hasAnyExtension('assets/pub/background'), 'kocsmai háttér'],
  ['assets/friends', () => fs.existsSync(path.join(ROOT, 'assets/friends')), 'karakter- és kommentátorképek'],
  ['assets/opponents', () => fs.existsSync(path.join(ROOT, 'assets/opponents')) || hasAnyExtension('assets/opponents'), 'ellenfélképek'],
  ['assets/icons', () => fs.existsSync(path.join(ROOT, 'assets/icons')), 'alkalmazásikonok'],
  ['assets/qr', () => fs.existsSync(path.join(ROOT, 'assets/qr')), 'QR-kódok'],
];

for (const [relative, check, label] of optionalAssetChecks) {
  if (!check()) console.warn(`[mobile] Figyelmeztetés: hiányzik a(z) ${label} (${relative}); a build folytatódik.`);
}

console.log(`Mobil webcsomag elkészült: ${MOBILE_DIR}`);
