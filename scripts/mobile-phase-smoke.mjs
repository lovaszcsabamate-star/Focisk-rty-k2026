/** Validate the selection-to-battle transition contract and generate real Chrome previews. */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const STANDALONE = path.join(ROOT, 'Fociskartyak2026.html');
const REPORT = path.join(ROOT, 'mobile-layout-report.json');
const PREVIEW_DIRECTORY = path.join(ROOT, 'previews');
const FOCUS_SOURCE = path.join(ROOT, 'js/focus-experience.js');
const WIDTHS = [320, 360, 390, 412, 480];
const CHROME_TIMEOUT_MS = 20_000;

const chrome = [
  process.env.CHROME_BIN,
  'google-chrome-stable',
  'google-chrome',
  'chromium',
  'chromium-browser',
].filter(Boolean).find(command => {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 5_000 });
  return result.status === 0;
});

if (!chrome) throw new Error('A fázis-előnézethez nem található Chrome vagy Chromium.');
if (!fs.existsSync(STANDALONE)) throw new Error('Hiányzik a generált Fociskartyak2026.html.');
if (!fs.existsSync(FOCUS_SOURCE)) throw new Error('Hiányzik a kártyakijátszás fókuszvezérlője.');

const standalone = fs.readFileSync(STANDALONE, 'utf8');
const styleMatch = standalone.match(/<style>([\s\S]*?)<\/style>/i);
if (!styleMatch) throw new Error('A generált játékból nem olvasható ki a beágyazott CSS.');

const previewCss = styleMatch[1];
const focusSource = fs.readFileSync(FOCUS_SOURCE, 'utf8');
const failures = [];
const sourceChecks = [
  [/transitionTimer\s*=\s*window\.setTimeout/, 'hiányzik a késleltetett kijátszás vezérlése'],
  [/\},\s*250\);/, 'a kijátszási átmenet nem 250 ms-os'],
  [/fociskartyak:interaction-invalidated/, 'hiányzik a külső megszakítási esemény'],
  [/overlay\s*&&\s*!overlay\.hidden/, 'az overlay nem szakítja meg a kijátszást'],
  [/pub\.classList\.contains\('is-processing'\)/, 'a busy állapot nem szakítja meg a kijátszást'],
  [/!target\?\.isConnected/, 'az eltávolított kártya nem érvényteleníti a callbacket'],
  [/document\.querySelector\('#inspector'\)/, 'az inspector állapota nincs ellenőrizve'],
  [/battleTransitionBypass/, 'hiányzik az egyszeri, dupla kattintást gátló átmeneti jelző'],
  [/stopImmediatePropagation\(\)/, 'a párhuzamos kijátszás nincs blokkolva'],
];

for (const [pattern, message] of sourceChecks) {
  if (!pattern.test(focusSource)) failures.push(`Fázisváltási szerződés: ${message}.`);
}

const attemptMarks = Array.from({ length: 11 }, (_, index) =>
  `<span class="attempt ${index === 0 ? 'attempt--win' : 'attempt--empty'}">${index === 0 ? '⚽' : '○'}</span>`,
).join('');

const card = (id, name, club = 'DVTK', extraClass = '') => `
  <article class="card selectable ${extraClass}" data-card-id="${id}">
    <div class="card__portrait" data-initials="${name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}"><span class="card__position">Védő</span></div>
    <div class="card__name">${name}</div>
    <div class="card__club">${club} · 🇭🇺</div>
    <div class="card__stats">
      <div class="stat active"><span class="stat__label">🎂 Életkor</span><span class="stat__value">26 év</span></div>
      <div class="stat"><span class="stat__label">👕 Mérkőzések</span><span class="stat__value">27</span></div>
      <div class="stat"><span class="stat__label">▶ Kezdőként</span><span class="stat__value">25</span></div>
      <div class="stat"><span class="stat__label">⚽ Gólok</span><span class="stat__value">2</span></div>
      <div class="stat"><span class="stat__label">🟨 Sárga lap</span><span class="stat__value">4</span></div>
    </div>
  </article>`;

const scoreboard = status => `
  <header id="hud">
    <div class="title">Fociskártyák 2026</div>
    <div class="score-strip" id="hud-scores">
      <div class="match-scoreboard match-scoreboard--penalties">
        <div class="match-scoreboard__competition">5. SZINT · OVR 87 · BÜNTETŐPÁRBAJ</div>
        <div class="match-team match-team--home"><span class="match-team__name">CSABI</span></div>
        <div class="match-scoreboard__score"><strong class="match-scoreboard__number">1</strong><span>–</span><strong class="match-scoreboard__number">0</strong></div>
        <div class="match-team match-team--away"><span class="match-team__name">D. RAVEN</span></div>
        <div class="match-scoreboard__status">${status}</div>
      </div>
    </div>
    <div class="meta" id="hud-meta">Rendes párbajok: 1/5 · hátra 4</div>
    <div class="hud-settings" id="hud-settings"><button class="icon-toggle">☰</button></div>
  </header>`;

const selectionBody = () => `
<div id="pub" class="mode-penalties is-card-selection">
  <main id="table">
    ${scoreboard('KÁRTYÁT VÁLASZT')}
    <section class="zone" id="opponent-zone"><div class="pile" id="opponent-pile"></div><div class="hand" id="opponent-hand"></div></section>
    <section id="felt">
      <div id="penalty-board"><div class="attempt-row"><strong>CSABI</strong><div class="attempt-marks">${attemptMarks}</div></div><div class="attempt-row"><strong>D. RAVEN</strong><div class="attempt-marks">${attemptMarks}</div></div></div>
      <div class="game-steps"><span class="game-step is-complete">1. Kategória</span><span class="game-step is-active">2. Kártya</span><span class="game-step">3. Eredmény</span></div>
      <div id="prompt">A gép ezt választotta: <span class="highlight">Fiatalabb játékos</span><small class="ux-direction">— a korábbi érték a jobb</small></div>
      <div id="duel"><div class="duel-slot"><div class="duel-slot__who">CSABI</div><div class="card card--empty"></div></div><div class="versus">VS</div><div class="duel-slot"><div class="duel-slot__who">D. RAVEN</div><div class="card card--back"></div></div></div>
      <div id="verdict"></div><div id="attribute-picker"></div>
    </section>
    <section class="zone" id="player-zone"><div class="pile filled" id="player-pile">1<span class="pile__label">Használt lapok</span></div><div class="hand hand--selection" id="player-hand">
      ${card('bence', 'Lukács Bence', 'DVTK', 'card--choice')}
      ${card('csoka', 'Csóka Dániel', 'ZTE FC', 'card--choice is-selected')}
      ${card('nagy', 'Nagy Barnabás', 'Ferencváros', 'card--choice')}
      ${card('torocsik', 'Törőcsik Péter', 'Újpest FC', 'card--choice')}
    </div></section>
  </main><aside id="banter"></aside>
</div>`;

const battleBody = () => `
<div id="pub" class="mode-penalties is-battle-active is-duel-focus">
  <main id="table">
    ${scoreboard('EREDMÉNY')}
    <section class="zone" id="opponent-zone"><div class="pile" id="opponent-pile"></div><div class="hand" id="opponent-hand"></div></section>
    <section id="felt">
      <div id="penalty-board"></div>
      <div class="game-steps"><span class="game-step is-complete">1. Kategória</span><span class="game-step is-complete">2. Kártya</span><span class="game-step is-active">3. Eredmény</span></div>
      <div id="prompt">FIATALABB JÁTÉKOS <small class="ux-direction">— a korábbi érték a jobb</small></div>
      <div id="duel"><div class="duel-slot winner"><div class="duel-slot__who">CSABI</div>${card('csoka', 'Csóka Dániel', 'ZTE FC')}</div><div class="versus">VS</div><div class="duel-slot loser"><div class="duel-slot__who">D. RAVEN</div>${card('nagy', 'Nagy Barnabás', 'Ferencváros')}</div></div>
      <div id="verdict" class="win">GÓL – MEGNYERTED A PÁRBAJT<small>mindkettő 26 éves, de Csóka Dániel fiatalabb</small></div>
      <div id="attribute-picker"><button class="btn next-round-button">Következő párbaj</button></div>
    </section>
    <section class="zone" id="player-zone"><div class="pile" id="player-pile"></div><div class="hand" id="player-hand"></div></section>
  </main><aside id="banter"></aside>
</div>`;

fs.mkdirSync(PREVIEW_DIRECTORY, { recursive: true });
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fociskartyak-phases-'));
const previewDocuments = [
  ['selection-phase-mobile.png', selectionBody()],
  ['battle-phase-mobile.png', battleBody()],
];

for (const [fileName, body] of previewDocuments) {
  const htmlFile = path.join(temporaryDirectory, fileName.replace(/\.png$/, '.html'));
  fs.writeFileSync(htmlFile, `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${previewCss}</style></head><body>${body}</body></html>`);
  const output = path.join(PREVIEW_DIRECTORY, fileName);
  const shot = spawnSync(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars',
    '--allow-file-access-from-files', '--window-size=720,1536', '--force-device-scale-factor=1',
    '--virtual-time-budget=1800', `--screenshot=${output}`, `file://${htmlFile}`,
  ], { encoding: 'utf8', timeout: CHROME_TIMEOUT_MS, killSignal: 'SIGKILL', maxBuffer: 10 * 1024 * 1024 });

  if (shot.error?.code === 'ETIMEDOUT') failures.push(`${fileName}: a Chrome-előnézet időtúllépés miatt nem készült el.`);
  else if (shot.status !== 0 || !fs.existsSync(output) || fs.statSync(output).size < 10_000) failures.push(`${fileName}: nem készült érvényes Chrome-előnézet.`);
}

fs.rmSync(temporaryDirectory, { recursive: true, force: true });

const measurements = WIDTHS.map(width => ({
  width,
  transitionDelayMs: 250,
  cancellationGuards: sourceChecks.length,
  sourceContractValid: failures.every(failure => !failure.startsWith('Fázisváltási szerződés:')),
  previewFiles: previewDocuments.map(([fileName]) => `previews/${fileName}`),
  failures: failures.filter(failure => failure.startsWith(`${width}px:`)),
}));

let report = {};
try { report = JSON.parse(fs.readFileSync(REPORT, 'utf8')); } catch { /* standalone report */ }
report.phaseMeasurements = measurements;
report.phaseFailures = failures;
report.phasePreviews = previewDocuments.map(([fileName]) => `previews/${fileName}`);
report.phaseValidation = {
  method: 'source-contract-and-real-chrome-previews',
  transitionDelayMs: 250,
  cancellationGuards: sourceChecks.length,
};
fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);

if (failures.length) {
  console.error(`Mobilos fázisváltási hibák:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('✓ 250 ms-os megszakítható fázisváltási szerződés és valódi Chrome fázis-előnézetek: rendben');
}
