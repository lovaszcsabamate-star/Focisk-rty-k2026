/** Start both game modes in real headless Chrome and detect runtime errors/remote requests. */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const STANDALONE = path.join(ROOT, 'Fociskartyak2026.html');
const REPORT = path.join(ROOT, 'runtime-browser-report.json');
const MODES = [
  { id: 'classic', button: '#start-btn', expectedClass: 'mode-classic' },
  { id: 'penalties', button: '#penalties-btn', expectedClass: 'mode-penalties' },
];

const chrome = [
  process.env.CHROME_BIN,
  'google-chrome-stable',
  'google-chrome',
  'chromium',
  'chromium-browser',
].filter(Boolean).find(command => spawnSync(command, ['--version'], { encoding: 'utf8' }).status === 0);

if (!chrome) throw new Error('A futásidejű böngészőteszthez nem található Chrome vagy Chromium.');
if (!fs.existsSync(STANDALONE)) throw new Error('Hiányzik a generált Fociskartyak2026.html. Futtasd előbb az npm run build parancsot.');

const original = fs.readFileSync(STANDALONE, 'utf8');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fociskartyak-runtime-'));
const results = [];
const failures = [];

const instrumentation = `<script>
(() => {
  try {
    localStorage.setItem('fociskartyak:onboarding-complete', 'true');
    localStorage.setItem('fociskartyak:player-name:v1', 'Csabi');
    localStorage.removeItem('fociskartyak:saved-match:v2');
  } catch {}
  window.__runtimeSmoke = { errors: [], remoteRequests: [], consoleErrors: [] };
  window.addEventListener('error', event => window.__runtimeSmoke.errors.push(String(event.error?.stack || event.message || 'window error')));
  window.addEventListener('unhandledrejection', event => window.__runtimeSmoke.errors.push(String(event.reason?.stack || event.reason || 'unhandled rejection')));
  const nativeError = console.error.bind(console);
  console.error = (...args) => {
    window.__runtimeSmoke.consoleErrors.push(args.map(value => String(value?.stack || value)).join(' '));
    nativeError(...args);
  };
  const nativeFetch = window.fetch?.bind(window);
  if (nativeFetch) window.fetch = (...args) => {
    const value = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    if (/^https?:\\/\\//i.test(String(value || ''))) window.__runtimeSmoke.remoteRequests.push(String(value));
    return nativeFetch(...args);
  };
})();
</script>`;

for (const mode of MODES) {
  const appFileName = `app-${mode.id}.html`;
  const appFile = path.join(temporaryDirectory, appFileName);
  fs.writeFileSync(appFile, original.replace('<body>', `<body>${instrumentation}`));

  const harness = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#111}iframe{width:1280px;height:900px;border:0}</style></head><body>
  <iframe id="app" src="${appFileName}"></iframe>
  <script>
    const frame = document.querySelector('#app');
    frame.addEventListener('load', () => setTimeout(() => {
      const doc = frame.contentDocument;
      const titleText = doc.querySelector('#penalties-btn')?.textContent || '';
      doc.querySelector('${mode.button}')?.click();
      setTimeout(() => {
        const win = frame.contentWindow;
        const smoke = win.__runtimeSmoke || { errors: ['hiányzó instrumentáció'], remoteRequests: [], consoleErrors: [] };
        const pub = doc.querySelector('#pub');
        const scoreText = doc.querySelector('#hud-scores')?.textContent || '';
        const result = {
          mode: '${mode.id}',
          titleLocalised: /Büntetőpárbaj/.test(titleText),
          loadingHidden: Boolean(doc.querySelector('#app-loading')?.hidden),
          loadingError: Boolean(doc.querySelector('.app-loading__error')),
          modeClassPresent: Boolean(pub?.classList.contains('${mode.expectedClass}')),
          visibleCards: [...doc.querySelectorAll('#player-hand .card, #duel .card')].filter(card => card.getBoundingClientRect().width > 0).length,
          savedNameVisible: /Csabi/i.test(scoreText),
          errors: smoke.errors,
          consoleErrors: smoke.consoleErrors,
          remoteRequests: smoke.remoteRequests,
        };
        document.documentElement.setAttribute('data-runtime-smoke', encodeURIComponent(JSON.stringify(result)));
      }, 2200);
    }, 1500));
  </script></body></html>`;

  const harnessFile = path.join(temporaryDirectory, `harness-${mode.id}.html`);
  fs.writeFileSync(harnessFile, harness);
  const run = spawnSync(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--allow-file-access-from-files', '--window-size=1300,940', '--force-device-scale-factor=1',
    '--virtual-time-budget=6500', '--dump-dom', `file://${harnessFile}`,
  ], { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });

  if (run.status !== 0) {
    const message = `${mode.id}: a Chrome hibával leállt.`;
    failures.push(message);
    results.push({ mode: mode.id, failure: message, stderr: run.stderr.slice(-4000) });
    continue;
  }

  const match = run.stdout.match(/data-runtime-smoke="([^"]+)"/);
  if (!match) {
    const message = `${mode.id}: nem érkezett futásidejű mérési eredmény.`;
    failures.push(message);
    results.push({ mode: mode.id, failure: message, domTail: run.stdout.slice(-4000) });
    continue;
  }

  const result = JSON.parse(decodeURIComponent(match[1]));
  const modeFailures = [];
  if (!result.titleLocalised) modeFailures.push('a Büntetőpárbaj felirat nem magyar');
  if (!result.loadingHidden || result.loadingError) modeFailures.push('betöltési hibaképernyő vagy látható betöltőréteg');
  if (!result.modeClassPresent) modeFailures.push('a kiválasztott játékmód nem indult el');
  if (result.visibleCards < 2) modeFailures.push('nem jelentek meg játékoskártyák');
  if (!result.savedNameVisible) modeFailures.push('a mentett játékosnév nem jelent meg az eredményjelzőn');
  if (result.errors.length) modeFailures.push(`nem kezelt hibák: ${result.errors.join(' | ')}`);
  if (result.consoleErrors.length) modeFailures.push(`console.error: ${result.consoleErrors.join(' | ')}`);
  if (result.remoteRequests.length) modeFailures.push(`külső hálózati kérések: ${result.remoteRequests.join(', ')}`);
  failures.push(...modeFailures.map(message => `${mode.id}: ${message}.`));
  results.push({ ...result, failures: modeFailures });
  console.log(`✓ ${mode.id}: ${result.visibleCards} látható kártya, 0 külső kérés, 0 futásidejű hiba`);
}

fs.rmSync(temporaryDirectory, { recursive: true, force: true });
fs.writeFileSync(REPORT, `${JSON.stringify({ chrome, results, failures }, null, 2)}\n`);

if (failures.length) {
  console.error(`Futásidejű böngészőhibák:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('✓ Klasszikus és Büntetőpárbaj böngészős füstteszt: rendben');
}
