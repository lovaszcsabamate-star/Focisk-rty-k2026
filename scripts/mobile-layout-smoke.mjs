/** Render the standalone game in a real headless Chrome at common mobile widths. */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const STANDALONE = path.join(ROOT, 'Fociskartyak2026.html');
const WIDTHS = [320, 360, 390, 412, 480];
const HEIGHT = 900;

const chrome = [
  process.env.CHROME_BIN,
  'google-chrome-stable',
  'google-chrome',
  'chromium',
  'chromium-browser',
].filter(Boolean).find(command => {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8' });
  return result.status === 0;
});

if (!chrome) throw new Error('A mobilos megjelenítési teszthez nem található Chrome vagy Chromium.');
if (!fs.existsSync(STANDALONE)) throw new Error('Hiányzik a generált Fociskartyak2026.html. Futtasd előbb az npm run build parancsot.');

const original = fs.readFileSync(STANDALONE, 'utf8');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fociskartyak-layout-'));
const failures = [];

for (const width of WIDTHS) {
  const probeScript = `
<script>
window.addEventListener('load', () => setTimeout(() => {
  const doc = document.documentElement;
  const body = document.body;
  const viewport = window.innerWidth;
  const candidates = [...document.querySelectorAll('.mobile-home, .onboarding-panel, #hud, #attribute-picker, button')];
  const offscreen = candidates
    .map(node => ({ node, rect: node.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 0 && (rect.left < -1 || rect.right > viewport + 1))
    .slice(0, 12)
    .map(({ node, rect }) => ({
      selector: node.id ? '#' + node.id : String(node.className || node.tagName),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      width: Math.round(rect.width),
    }));
  const result = {
    viewport,
    documentWidth: Math.max(doc.scrollWidth, body.scrollWidth),
    hasHome: Boolean(document.querySelector('.mobile-home')),
    hasOnboarding: Boolean(document.querySelector('.onboarding-panel')),
    hasLoadingError: Boolean(document.querySelector('.app-loading__error')),
    offscreen,
  };
  doc.setAttribute('data-layout-smoke', encodeURIComponent(JSON.stringify(result)));
}, 1200));
</script>`;

  const instrumented = original
    .replace('<body>', '<body><script>try{localStorage.setItem("fociskartyak:onboarding-complete","true")}catch{}</script>')
    .replace('</body>', `${probeScript}</body>`);
  const file = path.join(temporaryDirectory, `mobile-${width}.html`);
  fs.writeFileSync(file, instrumented);

  const run = spawnSync(chrome, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--allow-file-access-from-files',
    `--window-size=${width},${HEIGHT}`,
    '--force-device-scale-factor=1',
    '--virtual-time-budget=3500',
    '--dump-dom',
    `file://${file}`,
  ], {
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  });

  if (run.status !== 0) {
    failures.push(`${width}px: a Chrome hibával leállt.`);
    continue;
  }

  const match = run.stdout.match(/data-layout-smoke="([^"]+)"/);
  if (!match) {
    failures.push(`${width}px: a játék nem adott megjelenítési mérési eredményt.`);
    continue;
  }

  const result = JSON.parse(decodeURIComponent(match[1]));
  const overflow = result.documentWidth - result.viewport;
  if (!result.hasHome && !result.hasOnboarding) failures.push(`${width}px: nem jelent meg a mobilos kezdőképernyő.`);
  if (result.hasLoadingError) failures.push(`${width}px: betöltési hibaképernyő jelent meg.`);
  if (overflow > 1) failures.push(`${width}px: ${overflow}px vízszintes dokumentum-kilógás.`);
  if (result.offscreen.length) failures.push(`${width}px: képernyőn kívüli vezérlők: ${JSON.stringify(result.offscreen)}`);

  console.log(`✓ ${width}px: panel rendben, dokumentumszélesség ${result.documentWidth}px, kilógás ${Math.max(0, overflow)}px`);
}

fs.rmSync(temporaryDirectory, { recursive: true, force: true });

if (failures.length) throw new Error(`Mobilos megjelenítési hibák:\n- ${failures.join('\n- ')}`);

console.log('✓ Valódi Chrome mobilnézeti ellenőrzés: rendben');
