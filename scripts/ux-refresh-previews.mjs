/** Generate and validate mobile/desktop previews for the UX refresh. */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const STANDALONE = path.join(ROOT, 'Fociskartyak2026.html');
const PREVIEW_DIRECTORY = path.join(ROOT, 'previews');
const REPORT_FILE = path.join(ROOT, 'ux-refresh-preview-report.json');

const chrome = [
  process.env.CHROME_BIN,
  'google-chrome-stable',
  'google-chrome',
  'chromium',
  'chromium-browser',
].filter(Boolean).find(command => spawnSync(command, ['--version'], { encoding: 'utf8' }).status === 0);

if (!chrome) throw new Error('Az UX-előnézetekhez nem található Chrome vagy Chromium.');
if (!fs.existsSync(STANDALONE)) throw new Error('Hiányzik a generált Fociskartyak2026.html. Előbb futtasd az npm run build parancsot.');

const standalone = fs.readFileSync(STANDALONE, 'utf8');
const styleMatch = standalone.match(/<style>([\s\S]*?)<\/style>/i);
if (!styleMatch) throw new Error('A generált játékból nem olvasható ki a beágyazott CSS.');
const previewCss = styleMatch[1].replace(/url\("data:[^"]+"\)/g, 'none');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fociskartyak-ux-refresh-'));

const opponentPicker = `
  <details class="opponent-details" open>
    <summary>👤 Ellenfél kiválasztása</summary>
    <section class="opponent-picker">
      <h2 class="opponent-picker__title">Válassz ellenfelet</h2>
      <div class="opponent-picker__grid">
        <label class="opponent-card"><input type="radio" checked><span class="opponent-card__art opponent-sprite"><span class="opponent-card__level">LVL 5</span></span><span class="opponent-card__body"><b class="opponent-card__name">D. Raven</b><span class="opponent-card__rating">OVR 87</span><small class="opponent-card__title">A hidegvérű kihívó</small></span></label>
        <label class="opponent-card"><input type="radio"><span class="opponent-card__art opponent-sprite"><span class="opponent-card__level">LVL 8</span></span><span class="opponent-card__body"><b class="opponent-card__name">H. Li</b><span class="opponent-card__rating">OVR 93</span><small class="opponent-card__title">A számító stratéga</small></span></label>
      </div>
    </section>
  </details>`;

const mainMenu = `
<div id="overlay"><div class="panel" id="overlay-body">
  <div class="menu-panel mobile-home">
    <p class="eyebrow">A hátsó asztal bajnoksága</p>
    <h1>Fociskártyák 2026</h1>
    <p>Válassz ellenfelet és játékmódot. A játék internet nélkül is teljes értékűen működik.</p>
    <h2 class="menu-section-title">Új játék</h2>
    <section class="current-match-summary">
      <h3>Aktuális mérkőzés</h3>
      <dl>
        <div><dt>Pakli</dt><dd>Paksi FC · 31 kártya</dd></div>
        <div><dt>Ellenfél</dt><dd>D. Raven · 5. szint · OVR 87</dd></div>
        <div><dt>Játékmód</dt><dd>Válassz játékmódot</dd></div>
      </dl>
    </section>
    <div class="primary-mode-actions">
      <button class="btn mode-start"><span>🃏 Klasszikus mód</span><small>52 lapos kártyameccs</small></button>
      <button class="btn mode-start"><span>⚽ Büntetőpárbaj</span><small>11 lap, öt rendes párbaj</small></button>
    </div>
    <button class="btn quick-match-button"><span>⚡ Gyors meccs</span><small>Azonnali Klasszikus mérkőzés véletlen ellenféllel</small></button>
    ${opponentPicker}
  </div>
</div>`;

const categoryTile = ({ icon, label, direction, value, status = 'enabled' }) => `
<button class="attr-btn attr-btn--mobile category-tile" data-category-status="${status}" aria-pressed="false">
  <span class="attr-btn__label">${icon} ${label}</span>
  <strong class="attr-btn__value">Legjobb saját: ${value}</strong>
  <small class="attr-btn__direction">${direction}</small>
  ${status === 'experimental' ? '<span class="category-tile__availability">Korlátozott adatok</span>' : ''}
  <span class="category-tile__check">✓</span>
</button>`;

const categoryPicker = `
<div id="pub" class="is-category-selection"><main id="table">
  <header id="hud"><div class="title">Fociskártyák 2026</div><div id="hud-scores"></div><div id="hud-meta">1. kör</div><div id="hud-settings"></div></header>
  <section id="felt">
    <div id="prompt">Te következel – válassz kategóriát</div>
    <div id="duel"></div><div id="verdict"></div>
    <div id="attribute-picker">
      <div class="category-grid">
        <h3 class="category-group-title">Alapadatok</h3>
        ${categoryTile({ icon: '🎂', label: 'Fiatalabb játékos', direction: 'kevesebb életkor a jobb', value: '19 év' })}
        ${categoryTile({ icon: '📏', label: 'Magasabb játékos', direction: 'több a jobb', value: '198 cm', status: 'experimental' })}
        <h3 class="category-group-title">Pályára lépés</h3>
        ${categoryTile({ icon: '👕', label: 'Több mérkőzés', direction: 'több a jobb', value: '27' })}
        ${categoryTile({ icon: '⏱️', label: 'Több játékperc', direction: 'több a jobb', value: '2260 perc' })}
        <h3 class="category-group-title">Támadás</h3>
        ${categoryTile({ icon: '⚽', label: 'Több gól', direction: 'több a jobb', value: '11' })}
        ${categoryTile({ icon: '🅰️', label: 'Több gólpassz', direction: 'több a jobb', value: '7', status: 'experimental' })}
        <h3 class="category-group-title">Fegyelem</h3>
        ${categoryTile({ icon: '🟨', label: 'Kevesebb sárga lap', direction: 'kevesebb a jobb', value: '0' })}
        ${categoryTile({ icon: '🟥', label: 'Kevesebb kiállítás', direction: 'kevesebb a jobb', value: '0' })}
      </div>
      <div class="category-picker__actions"><span class="category-picker__status">Több gól kijelölve. Még válthatsz, vagy lépj tovább.</span><button class="category-picker__next">Tovább a kártyákhoz</button></div>
    </div>
  </section>
</main></div>`;

const recentDuels = `
<div id="pub" class="is-battle-active"><main id="table">
  <header id="hud"><div class="title">Fociskártyák 2026</div><div id="hud-scores"><div class="score leading"><span>CSABI</span><b>12</b></div><div class="score"><span>D. RAVEN</span><b>10</b></div></div><div id="hud-meta">9. kör · 30 lap a pakliban</div><div id="hud-settings"><button class="icon-toggle">☰ Menü</button></div></header>
  <section id="felt">
    <div id="prompt">Eredmény</div>
    <div id="duel"><div class="duel-slot winner"><div class="duel-slot__who">Csabi</div><div class="card card--empty"></div></div><div class="versus">VS</div><div class="duel-slot loser"><div class="duel-slot__who">D. Raven</div><div class="card card--back"></div></div></div>
    <div id="verdict" class="win">MEGNYERTED A KÖRT<small>⚽ Több gól: 5–2</small></div>
    <section class="recent-duels"><h2 class="recent-duels__title">Legutóbbi párbajok</h2><ol class="recent-duels__list">
      <li class="recent-duels__item recent-duels__item--human"><span class="recent-duels__round">7. kör</span><span class="recent-duels__category">Több gól</span><span class="recent-duels__result">5–2 · Győzelem</span></li>
      <li class="recent-duels__item recent-duels__item--ai"><span class="recent-duels__round">8. kör</span><span class="recent-duels__category">Fiatalabb játékos</span><span class="recent-duels__result">24–21 év · Vereség</span></li>
      <li class="recent-duels__item recent-duels__item--tie"><span class="recent-duels__round">9. kör</span><span class="recent-duels__category">Kevesebb sárga lap</span><span class="recent-duels__result">2–2 · Döntetlen</span></li>
    </ol></section>
    <div id="attribute-picker"><button class="btn next-round-button">Következő kör</button></div>
  </section>
</main></div>`;

const classicResult = `
<div id="overlay"><div class="panel" id="overlay-body">
  <div class="result-panel result-panel--win">
    <div class="result-opponent"><div class="result-opponent__portrait opponent-sprite"></div><div class="result-opponent__text"><span>ELLENFÉL</span><strong>D. Raven</strong><small>5. szint · OVR 87</small></div></div>
    <h1>GYŐZELEM</h1>
    <div class="final-score">CSABI 31–21 GÉP</div>
    <dl class="result-stats result-stats--classic">
      <div><dt>Lejátszott körök</dt><dd>26</dd></div><div><dt>Megnyert párbajok</dt><dd>14</dd></div>
      <div><dt>A gép nyert párbajai</dt><dd>10</dd></div><div><dt>Döntetlen párbajok</dt><dd>2</dd></div>
      <div><dt>Legsikeresebb kategória</dt><dd>⚽ Több gól · 5 győzelem</dd></div><div><dt>Ellenfél</dt><dd>D. Raven · 5. szint · OVR 87</dd></div>
    </dl>
    <section class="player-of-match"><p class="eyebrow">A mérkőzés játékosa</p><h2>Lukács Bence</h2><p>DVTK · 3 megnyert párbaj</p></section>
    <div class="result-actions"><button class="btn">Visszavágó</button><button class="btn btn--ghost">Vissza a főmenübe</button></div>
  </div>
</div>`;

const screens = [
  ['main-menu', mainMenu],
  ['category-picker', categoryPicker],
  ['recent-duels', recentDuels],
  ['classic-result', classicResult],
];
const viewports = [
  { name: 'mobile', width: 390, height: 900 },
  { name: 'desktop', width: 1440, height: 1000 },
];
const failures = [];
const measurements = [];

fs.mkdirSync(PREVIEW_DIRECTORY, { recursive: true });

for (const viewport of viewports) {
  for (const [screen, body] of screens) {
    const key = `${screen}-${viewport.name}`;
    const fixture = path.join(temporaryDirectory, `${key}.html`);
    const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${previewCss}</style></head><body>${body}<script>
      setTimeout(()=>{
        const root=document.documentElement;const docWidth=Math.max(root.scrollWidth,document.body.scrollWidth);
        const buttons=[...document.querySelectorAll('button')].map(node=>Math.round(node.getBoundingClientRect().height));
        const result={viewport:innerWidth,documentWidth:docWidth,minButton:buttons.length?Math.min(...buttons):null,recentCount:document.querySelectorAll('.recent-duels__item').length,visible:Boolean(document.body.getBoundingClientRect().height)};
        root.setAttribute('data-ux-preview',encodeURIComponent(JSON.stringify(result)));
      },120);
    </script></body></html>`;
    fs.writeFileSync(fixture, html);

    const dump = spawnSync(chrome, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars',
      '--allow-file-access-from-files', `--window-size=${viewport.width},${viewport.height}`,
      '--force-device-scale-factor=1', '--virtual-time-budget=1200', '--dump-dom', `file://${fixture}`,
    ], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    const match = dump.stdout.match(/data-ux-preview="([^"]+)"/);
    if (dump.status !== 0 || !match) {
      failures.push(`${key}: az elrendezés nem mérhető.`);
      continue;
    }
    const result = JSON.parse(decodeURIComponent(match[1]));
    const screenFailures = [];
    if (result.documentWidth > result.viewport + 1) screenFailures.push(`vízszintes túllógás: ${result.documentWidth}/${result.viewport}px`);
    if (result.minButton != null && result.minButton < 44) screenFailures.push(`44 px alatti gomb: ${result.minButton}px`);
    if (screen === 'recent-duels' && result.recentCount !== 3) screenFailures.push(`az előzménylista ${result.recentCount} sort tartalmaz`);
    failures.push(...screenFailures.map(message => `${key}: ${message}.`));
    measurements.push({ screen, viewport: viewport.name, ...result, failures: screenFailures });

    const output = path.join(PREVIEW_DIRECTORY, `${key}.png`);
    const shot = spawnSync(chrome, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars',
      '--allow-file-access-from-files', `--window-size=${viewport.width},${viewport.height}`,
      '--force-device-scale-factor=1', '--virtual-time-budget=1200', `--screenshot=${output}`, `file://${fixture}`,
    ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    if (shot.status !== 0 || !fs.existsSync(output)) failures.push(`${key}: az előnézet nem készült el.`);
    else console.log(`✓ ${key}.png`);
  }
}

fs.rmSync(temporaryDirectory, { recursive: true, force: true });
fs.writeFileSync(REPORT_FILE, `${JSON.stringify({ generatedAt: new Date().toISOString(), measurements, failures }, null, 2)}\n`);

if (failures.length) {
  console.error(`UX-előnézeti hibák:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('✓ Főmenü, kategóriaválasztó, párbajtörténet és Klasszikus végeredmény mobilon és asztali nézetben rendben.');
}
