/** Generate deterministic desktop previews from the same bundled CSS as the game. */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const STANDALONE = path.join(ROOT, 'Fociskartyak2026.html');
const PREVIEW_DIRECTORY = path.join(ROOT, 'previews');
const WIDTH = 1440;
const HEIGHT = 1000;

const chrome = [
  process.env.CHROME_BIN,
  'google-chrome-stable',
  'google-chrome',
  'chromium',
  'chromium-browser',
].filter(Boolean).find(command => spawnSync(command, ['--version'], { encoding: 'utf8' }).status === 0);

if (!chrome) throw new Error('Az asztali előnézethez nem található Chrome vagy Chromium.');
if (!fs.existsSync(STANDALONE)) throw new Error('Hiányzik a generált Fociskartyak2026.html.');

const standalone = fs.readFileSync(STANDALONE, 'utf8');
const styleMatch = standalone.match(/<style>([\s\S]*?)<\/style>/i);
if (!styleMatch) throw new Error('A generált játékból nem olvasható ki a beágyazott CSS.');
const previewCss = styleMatch[1];
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fociskartyak-desktop-previews-'));

const card = (id, name, club, age, appearances, goals, yellowCards, extra = '') => `
  <article class="card selectable card--choice ${extra}" data-card-id="${id}" tabindex="0" role="button" aria-label="${name}, ${club}">
    <div class="card__portrait" role="img" aria-label="${name} semleges játékosillusztrációja"><span class="card__position">Játékos</span></div>
    <div class="card__name">${name}</div>
    <div class="card__club">${club} <span class="card__nation-flag" aria-hidden="true">🇭🇺</span><span class="card__nation-name">Magyarország</span></div>
    <div class="card__stats">
      <div class="stat active"><span class="stat__label">🎂 Életkor</span><span class="stat__value">${age} év</span></div>
      <div class="stat"><span class="stat__label">👕 Mérkőzések</span><span class="stat__value">${appearances}</span></div>
      <div class="stat"><span class="stat__label">⚽ Gólok</span><span class="stat__value">${goals}</span></div>
      <div class="stat"><span class="stat__label">🟨 Sárga lap</span><span class="stat__value">${yellowCards}</span></div>
    </div>
  </article>`;

const header = `
  <header id="hud">
    <div class="title">Fociskártyák 2026</div>
    <div class="score-strip" id="hud-scores">
      <div class="score leading"><span>CSABI</span><b>8</b></div>
      <div class="score"><span>GÉP</span><b>6</b></div>
    </div>
    <div class="meta" id="hud-meta">8. kör · 36 lap a pakliban</div>
    <div class="hud-settings" id="hud-settings"><button class="icon-toggle">🎨 Megjelenés</button></div>
  </header>`;

const independentNotice = '<p class="independent-project-note">A Fociskártyák 2026 független projekt. Nem áll hivatalos kapcsolatban a játékban megjelenített klubokkal, ligákkal vagy sportszövetségekkel.</p>';

const selectionBody = `
<div id="pub" class="is-card-selection">
  <main id="table">
    ${header}
    <section class="zone" id="opponent-zone">
      <div class="pile" id="opponent-pile"><span class="pile__label">Gép nyereménye</span> 6</div>
      <div class="hand hand--opponent" id="opponent-hand"><div class="card card--back"></div><div class="card card--back"></div><div class="card card--back"></div><div class="card card--back"></div><div class="card card--back"></div></div>
    </section>
    <section id="felt">
      <div id="pot-indicator"></div>
      <div id="prompt">Válassz kártyát: <span class="highlight">Fiatalabb játékos</span><small class="ux-direction"> — a fiatalabb nyer</small></div>
      <div id="duel"><div class="duel-slot"><div class="duel-slot__who">CSABI</div><div class="card card--empty"></div></div><div class="versus">VS</div><div class="duel-slot"><div class="duel-slot__who">GÉP</div><div class="card card--back"></div></div></div>
      <div id="verdict"></div><div id="attribute-picker"></div>
    </section>
    <section class="zone" id="player-zone">
      <div class="pile filled" id="player-pile"><span class="pile__label">Megnyert lapok</span> 8</div>
      <div class="hand hand--selection" id="player-hand">
        ${card('lukacs', 'Lukács Bence', 'DVTK', 25, 27, 5, 4)}
        ${card('csoka', 'Csóka Dániel', 'ZTE FC', 26, 24, 2, 5, 'is-selected')}
        ${card('nagy', 'Nagy Barnabás', 'Ferencvárosi TC', 24, 19, 1, 3)}
        ${card('torocsik', 'Törőcsik Péter', 'Újpest FC', 27, 22, 3, 6)}
        ${card('szabo', 'Szabó Levente', 'Paksi FC', 23, 25, 7, 2)}
      </div>
    </section>
  </main>
  <aside id="banter"><h2>A hátsó asztal</h2><div id="banter-feed"><div class="bubble"><div class="avatar">B</div><div class="bubble__body"><div class="bubble__name">Bandi</div><div class="bubble__text">Ez most szoros lesz.</div></div></div></div>${independentNotice}</aside>
</div>`;

const battleBody = `
<div id="pub" class="is-battle-active is-duel-focus">
  <main id="table">
    ${header}
    <section class="zone" id="opponent-zone"><div class="pile" id="opponent-pile"></div><div class="hand" id="opponent-hand"></div></section>
    <section id="felt">
      <div id="pot-indicator"></div>
      <div id="prompt">FIATALABB JÁTÉKOS <small class="ux-direction">— a fiatalabb nyer</small></div>
      <div id="duel">
        <div class="duel-slot loser"><div class="duel-slot__who">CSABI</div>${card('csoka', 'Csóka Dániel', 'ZTE FC', 26, 24, 2, 5)}</div>
        <div class="versus">VS</div>
        <div class="duel-slot winner"><div class="duel-slot__who">GÉP</div>${card('nagy', 'Nagy Barnabás', 'Ferencvárosi TC', 24, 19, 1, 3)}</div>
      </div>
      <div id="verdict" class="lose">A GÉPÉ A KÖR<small>🎂 Fiatalabb játékos: 26 év – 24 év</small></div>
      <div id="attribute-picker"><button class="btn next-round-button">Következő kör</button></div>
    </section>
    <section class="zone" id="player-zone"><div class="pile" id="player-pile"></div><div class="hand" id="player-hand"></div></section>
  </main>
  <aside id="banter"><h2>A hátsó asztal</h2><div id="banter-feed"><div class="bubble"><div class="avatar">B</div><div class="bubble__body"><div class="bubble__name">Bandi</div><div class="bubble__text">A gép fiatalabb lapot tett.</div></div></div></div>${independentNotice}</aside>
</div>`;

fs.mkdirSync(PREVIEW_DIRECTORY, { recursive: true });
const previews = [
  ['selection-phase-desktop.png', selectionBody],
  ['battle-phase-desktop.png', battleBody],
];

const failures = [];
for (const [fileName, body] of previews) {
  const htmlPath = path.join(temporaryDirectory, fileName.replace(/\.png$/, '.html'));
  fs.writeFileSync(htmlPath, `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${previewCss}</style></head><body>${body}</body></html>`);
  const output = path.join(PREVIEW_DIRECTORY, fileName);
  const shot = spawnSync(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars',
    `--window-size=${WIDTH},${HEIGHT}`, '--force-device-scale-factor=1', '--virtual-time-budget=1800',
    `--screenshot=${output}`, `file://${htmlPath}`,
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (shot.status !== 0 || !fs.existsSync(output)) failures.push(`${fileName}: ${shot.stderr.slice(-700)}`);
}

fs.rmSync(temporaryDirectory, { recursive: true, force: true });
if (failures.length) {
  console.error(`Asztali előnézeti hibák:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`✓ Asztali választási és csataelőnézet elkészült (${WIDTH}×${HEIGHT}).`);
}
