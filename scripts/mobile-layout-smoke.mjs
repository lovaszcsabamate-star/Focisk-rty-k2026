/** Render the standalone game in a real headless Chrome at common mobile widths. */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const STANDALONE = path.join(ROOT, 'Fociskartyak2026.html');
const REPORT = path.join(ROOT, 'mobile-layout-report.json');
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
const measurements = [];

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
    loadingHidden: Boolean(document.querySelector('#app-loading')?.hidden),
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
    const failure = `${width}px: a Chrome hibával leállt.`;
    failures.push(failure);
    measurements.push({ width, failure, stderr: run.stderr.slice(-4000) });
    continue;
  }

  const match = run.stdout.match(/data-layout-smoke="([^"]+)"/);
  if (!match) {
    const failure = `${width}px: a játék nem adott megjelenítési mérési eredményt.`;
    failures.push(failure);
    measurements.push({
      width,
      failure,
      stderr: run.stderr.slice(-4000),
      domTail: run.stdout.slice(-4000),
    });
    continue;
  }

  const result = JSON.parse(decodeURIComponent(match[1]));
  const overflow = result.documentWidth - result.viewport;
  const widthFailures = [];
  if (!result.hasHome && !result.hasOnboarding) widthFailures.push('nem jelent meg a mobilos kezdőképernyő');
  if (result.hasLoadingError) widthFailures.push('betöltési hibaképernyő jelent meg');
  if (!result.loadingHidden) widthFailures.push('a betöltőképernyő látható maradt');
  if (overflow > 1) widthFailures.push(`${overflow}px vízszintes dokumentum-kilógás`);
  if (result.offscreen.length) widthFailures.push(`képernyőn kívüli vezérlők: ${JSON.stringify(result.offscreen)}`);
  failures.push(...widthFailures.map(message => `${width}px: ${message}.`));
  measurements.push({ width, overflow, ...result, failures: widthFailures });

  console.log(`✓ ${width}px: panel rendben, dokumentumszélesség ${result.documentWidth}px, kilógás ${Math.max(0, overflow)}px`);
}

fs.rmSync(temporaryDirectory, { recursive: true, force: true });
fs.writeFileSync(REPORT, `${JSON.stringify({ chrome, measurements, failures }, null, 2)}\n`);

if (failures.length) {
  console.error(`Mobilos megjelenítési hibák:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('✓ Valódi Chrome mobilnézeti ellenőrzés: rendben');
}
