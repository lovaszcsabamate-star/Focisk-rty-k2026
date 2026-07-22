/** Build the dependency-free game and prepare Capacitor's mobile web directory. */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const MOBILE_DIR = path.join(ROOT, 'mobile-www');
const STANDALONE_FILE = path.join(ROOT, 'Fociskartyak2026.html');

for (const script of [
  'build-standalone.mjs',
  'postprocess-standalone.mjs',
  'finalize-usability-standalone.mjs',
]) {
  execFileSync(process.execPath, [path.join(HERE, script)], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

fs.rmSync(MOBILE_DIR, { recursive: true, force: true });
fs.mkdirSync(MOBILE_DIR, { recursive: true });

const standalone = fs.readFileSync(STANDALONE_FILE, 'utf8')
  .replace(
    '</head>',
    '  <meta name="application-name" content="Fociskártyák 2026">\n' +
      '  <meta name="format-detection" content="telephone=no">\n' +
      '</head>'
  );

fs.writeFileSync(path.join(MOBILE_DIR, 'index.html'), standalone);

const optionalCopies = [
  ['manifest.webmanifest', 'manifest.webmanifest'],
  ['src/assets/placeholders', 'src/assets/placeholders'],
];

for (const [sourceRelative, targetRelative] of optionalCopies) {
  const source = path.join(ROOT, sourceRelative);
  if (!fs.existsSync(source)) continue;
  fs.cpSync(source, path.join(MOBILE_DIR, targetRelative), { recursive: true });
}

console.log(`Mobil webcsomag elkészült: ${MOBILE_DIR}`);
