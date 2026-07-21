/** Validate the selection-to-battle transition and generate mobile phase previews. */

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
const WIDTHS = [320, 360, 390, 412, 480];
const HEIGHT = 900;

const chrome = [
  process.env.CHROME_BIN,
  'google-chrome-stable',
  'google-chrome',
  'chromium',
  'chromium-browser',
].filter(Boolean).find(command => spawnSync(command, ['--version'], { encoding: 'utf8' }).status === 0);

if (!chrome) throw new Error('A fázisváltási teszthez nem található Chrome vagy Chromium.');
if (!fs.existsSync(STANDALONE)) throw new Error('Hiányzik a generált Fociskartyak2026.html.');

const standalone = fs.readFileSync(STANDALONE, 'utf8');
const styleMatch = standalone.match(/<style>([\s\S]*?)<\/style>/i);
if (!styleMatch) throw new Error('A generált játékból nem olvasható ki a beágyazott CSS.');
const previewCss = styleMatch[1];
const testCss = previewCss.replace(/url\("data:[^"]+"\)/g, 'none');
const focusScript = fs.readFileSync(path.join(ROOT, 'js/focus-experience.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fociskartyak-phases-'));
const failures = [];
const measurements = [];

const card = (id, name, club = 'DVTK', { choice = false, selected = false } = {}) => `
  <article class="card selectable${choice || selected ? ' card--choice' : ''}${selected ? ' is-selected' : ''}" data-card-id="${id}">
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

const scoreboard = `
  <header id="hud">
    <div class="title">Fociskártyák 2026</div>
    <div class="score-strip" id="hud-scores">
      <div class="match-scoreboard match-scoreboard--penalties">
        <div class="match-scoreboard__competition">5. SZINT · OVR 87 · NB I KÁRTYAMECCS</div>
        <div class="match-team match-team--home"><span class="match-team__name">CSABI</span></div>
        <div class="match-scoreboard__score"><strong class="match-scoreboard__number">1</strong><span>–</span><strong class="match-scoreboard__number">0</strong></div>
        <div class="match-team match-team--away"><span class="match-team__name">D. RAVEN</span></div>
        <div class="match-scoreboard__status">KATEGÓRIÁT VÁLASZT: GÉP</div>
      </div>
    </div>
    <div class="meta" id="hud-meta">Rendes párbajok: 1/5 · hátra 4</div>
    <div class="hud-settings" id="hud-settings"><button class="icon-toggle">☰</button></div>
  </header>`;

const attemptMarks = Array.from({ length: 11 }, (_, index) =>
  `<span class="attempt ${index === 0 ? 'attempt--win' : 'attempt--empty'}">${index === 0 ? '⚽' : '○'}</span>`
).join('');

const selectionBody = ({ selected = false } = {}) => `
<div id="pub" class="mode-penalties is-card-selection">
  <main id="table">
    ${scoreboard}
    <section class="zone" id="opponent-zone">
      <div class="pile" id="opponent-pile"><span class="pile__label">Gép használt lapjai</span></div>
      <div class="hand hand--opponent" id="opponent-hand"><div class="card card--back"></div><div class="card card--back"></div></div>
    </section>
    <section id="felt">
      <div id="penalty-board">
        <div class="attempt-row"><strong>JÁTÉKOS</strong><div class="attempt-marks">${attemptMarks}</div></div>
        <div class="attempt-row"><strong>GÉP</strong><div class="attempt-marks">${attemptMarks}</div></div>
      </div>
      <div class="game-steps"><span class="game-step is-complete">1. Kategória</span><span class="game-step is-active">2. Kártya</span><span class="game-step">3. Eredmény</span></div>
      <div id="prompt">A gép ezt választotta: <span class="highlight">Idősebb játékos</span><small class="ux-direction">— a nagyobb érték nyer</small></div>
      <div id="duel">
        <div class="duel-slot"><div class="duel-slot__who">CSABI</div><div class="card card--empty"></div></div>
        <div class="versus">VS</div>
        <div class="duel-slot"><div class="duel-slot__who">GÉP</div><div class="card card--back"></div></div>
      </div>
      <div id="verdict"></div><div id="attribute-picker"></div>
    </section>
    <section class="zone" id="player-zone">
      <div class="pile filled" id="player-pile">1<span class="pile__label">Használt lapok</span></div>
      <div class="hand hand--selection" id="player-hand">
        ${card('bence', 'Lukács Bence', 'DVTK', { choice: true })}
        ${card('csoka', 'Csóka Dániel', 'ZTE FC', { choice: true, selected })}
        ${card('nagy', 'Nagy Barnabás', 'Ferencváros', { choice: true })}
        ${card('torocsik', 'Törőcsik Péter', 'Újpest FC', { choice: true })}
      </div>
    </section>
  </main>
  <aside id="banter"></aside>
</div>`;

const battleBody = () => `
<div id="pub" class="mode-penalties is-battle-active is-duel-focus">
  <main id="table">
    ${scoreboard}
    <section class="zone" id="opponent-zone"><div class="pile" id="opponent-pile"></div><div class="hand" id="opponent-hand"></div></section>
    <section id="felt">
      <div id="penalty-board"></div>
      <div class="game-steps"><span class="game-step is-complete">1. Kategória</span><span class="game-step is-complete">2. Kártya</span><span class="game-step is-active">3. Eredmény</span></div>
      <div id="prompt">IDŐSEBB JÁTÉKOS <small class="ux-direction">— a nagyobb érték nyer</small></div>
      <div id="duel">
        <div class="duel-slot winner"><div class="duel-slot__who">CSABI</div>${card('csoka', 'Csóka Dániel', 'ZTE FC')}</div>
        <div class="versus">VS</div>
        <div class="duel-slot loser"><div class="duel-slot__who">GÉP</div>${card('nagy', 'Nagy Barnabás', 'Ferencváros')}</div>
      </div>
      <div id="verdict" class="win">A TIÉD A KÖR<small>🎂 Idősebb játékos: 26 év – 24 év</small></div>
      <div id="attribute-picker"><button class="btn next-round-button">Következő párbaj</button></div>
    </section>
    <section class="zone" id="player-zone"><div class="pile" id="player-pile"></div><div class="hand" id="player-hand"></div></section>
  </main>
  <aside id="banter"></aside>
</div>`;

const inspectorCardJs = JSON.stringify(card('csoka', 'Csóka Dániel', 'ZTE FC'));
const humanBattleCardJs = JSON.stringify(card('csoka', 'Csóka Dániel', 'ZTE FC'));
const aiBattleCardJs = JSON.stringify(card('nagy', 'Nagy Barnabás', 'Ferencváros'));

for (const width of WIDTHS) {
  const fixtureFileName = `phase-app-${width}.html`;
  const fixtureFile = path.join(temporaryDirectory, fixtureFileName);
  const fixture = `<!doctype html>
<html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>${testCss}</style></head><body>
${selectionBody()}
<script>${focusScript}</script>
<script>
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
(async()=>{
  await sleep(120);
  const pub=document.querySelector('#pub');
  const hand=document.querySelector('#player-hand');
  const chosen=hand.querySelector('[data-card-id="csoka"]');
  const selectionWidth=chosen.getBoundingClientRect().width;
  chosen.dispatchEvent(new Event('pointerdown',{bubbles:true}));
  await sleep(30);
  const selected=chosen.classList.contains('is-selected');
  const selectedOutline=parseFloat(getComputedStyle(chosen).outlineWidth)||0;

  const inspector=document.createElement('div');
  inspector.id='inspector';
  inspector.innerHTML='<div class="inspector__shell"><div class="inspector__centre">'+${inspectorCardJs}+'<div class="inspector__actions"><button class="btn" id="commit-card">Kijátszom ezt a lapot</button><button class="btn btn--ghost">Vissza</button></div></div></div>';
  document.body.appendChild(inspector);
  let committed=0;
  inspector.querySelector('#commit-card').addEventListener('click',()=>{
    committed+=1;
    document.querySelector('#duel').innerHTML='<div class="duel-slot"><div class="duel-slot__who">CSABI</div>'+${humanBattleCardJs}+'</div><div class="versus">VS</div><div class="duel-slot"><div class="duel-slot__who">GÉP</div>'+${aiBattleCardJs}+'</div>';
    [...hand.querySelectorAll('.card')].forEach(node=>node.classList.add('card--dim'));
    inspector.remove();
  });
  inspector.querySelector('#commit-card').click();
  await sleep(120);
  const transitionActive=pub.classList.contains('is-battle-transition');
  const transitionDelayed=committed===0;
  const inspectorTransitioning=inspector.classList.contains('is-battle-transition');
  await sleep(280);

  const cards=[...document.querySelectorAll('#duel .duel-slot .card')];
  const first=cards[0].getBoundingClientRect();
  const second=cards[1].getBoundingClientRect();
  const versus=document.querySelector('#duel .versus').getBoundingClientRect();
  const root=document.documentElement;
  const body=document.body;
  const result={
    requestedWidth:${width},
    viewport:innerWidth,
    documentWidth:Math.max(root.scrollWidth,body.scrollWidth),
    selected,
    selectedOutline,
    selectionWidth:Math.round(selectionWidth),
    transitionActive,
    transitionDelayed,
    inspectorTransitioning,
    committed,
    battleActive:pub.classList.contains('is-battle-active'),
    duelFocus:pub.classList.contains('is-duel-focus'),
    playerZoneHidden:getComputedStyle(document.querySelector('#player-zone')).display==='none',
    opponentZoneHidden:getComputedStyle(document.querySelector('#opponent-zone')).display==='none',
    headerVisible:document.querySelector('#hud').getBoundingClientRect().height>0,
    titleVisible:getComputedStyle(document.querySelector('#hud .title')).display!=='none',
    promptVisible:document.querySelector('#prompt').getBoundingClientRect().height>0,
    first:{left:Math.round(first.left),right:Math.round(first.right),width:Math.round(first.width),height:Math.round(first.height)},
    second:{left:Math.round(second.left),right:Math.round(second.right),width:Math.round(second.width),height:Math.round(second.height)},
    versus:{left:Math.round(versus.left),right:Math.round(versus.right)},
  };
  document.documentElement.setAttribute('data-phase-smoke',encodeURIComponent(JSON.stringify(result)));
})();
</script></body></html>`;
  fs.writeFileSync(fixtureFile, fixture);

  const harness = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;overflow:hidden;background:#111}#app{display:block;width:${width}px;height:${HEIGHT}px;border:0;margin:0}
</style></head><body><iframe id="app" src="${fixtureFileName}"></iframe><script>
const frame=document.querySelector('#app');frame.addEventListener('load',()=>setTimeout(()=>{const value=frame.contentDocument.documentElement.getAttribute('data-phase-smoke');if(value)document.documentElement.setAttribute('data-phase-smoke',value)},1150));
</script></body></html>`;
  const harnessFile = path.join(temporaryDirectory, `phase-harness-${width}.html`);
  fs.writeFileSync(harnessFile, harness);

  const run = spawnSync(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--allow-file-access-from-files', '--window-size=700,1000', '--force-device-scale-factor=1',
    '--virtual-time-budget=5500', '--dump-dom', `file://${harnessFile}`,
  ], { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });

  const match = run.stdout.match(/data-phase-smoke="([^"]+)"/);
  if (run.status !== 0 || !match) {
    const message = `${width}px: a fázisváltás nem mérhető.`;
    failures.push(message);
    measurements.push({ width, failure: message, status: run.status, stderr: run.stderr.slice(-2500), domTail: run.stdout.slice(-2500) });
    continue;
  }

  const result = JSON.parse(decodeURIComponent(match[1]));
  const checks = [
    [result.viewport === width, `a mért viewport ${result.viewport}px a kért ${width}px helyett`],
    [result.documentWidth <= result.viewport + 1, 'vízszintes dokumentum-kilógás'],
    [result.selected && result.selectedOutline >= 2, 'a kiválasztott kártya nem kapott arany kiemelést'],
    [result.transitionActive && result.transitionDelayed && result.inspectorTransitioning, 'a 250 ms-os átmenet nem előzi meg a kijátszást'],
    [result.committed === 1, `a kártya ${result.committed} alkalommal került kijátszásra`],
    [result.battleActive && result.duelFocus, 'nem aktiválódott a csatafázis'],
    [result.playerZoneHidden && result.opponentZoneHidden, 'a kézben maradt lapok vagy paklik láthatók maradtak'],
    [result.headerVisible && result.titleVisible && result.promptVisible, 'a fejléc vagy a kategórianév eltűnt'],
    [Math.abs(result.first.width - result.second.width) <= 1, `eltérő kártyaszélesség (${result.first.width}/${result.second.width})`],
    [Math.abs(result.first.height - result.second.height) <= 1, `eltérő kártyamagasság (${result.first.height}/${result.second.height})`],
    [result.first.width > result.selectionWidth, `a csatakártya nem nagyobb a választási kártyánál (${result.first.width}/${result.selectionWidth})`],
    [result.first.right <= result.versus.left + 1 && result.second.left >= result.versus.right - 1, 'a csatakártyák átfedik a VS oszlopot'],
  ];
  const widthFailures = checks.filter(([ok]) => !ok).map(([, message]) => `${width}px: ${message}.`);
  failures.push(...widthFailures);
  measurements.push({ width, ...result, failures: widthFailures });
  console.log(`✓ ${width}px fázisváltás: választás ${result.selectionWidth}px, csata ${result.first.width}×${result.first.height}px`);
}

fs.mkdirSync(PREVIEW_DIRECTORY, { recursive: true });
const previewDocuments = [
  ['selection-phase-mobile.png', selectionBody({ selected: true })],
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
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (shot.status !== 0 || !fs.existsSync(output)) failures.push(`Nem készült el a(z) ${fileName} előnézet.`);
}

fs.rmSync(temporaryDirectory, { recursive: true, force: true });
let report = {};
try { report = JSON.parse(fs.readFileSync(REPORT, 'utf8')); } catch { /* standalone report */ }
report.phaseMeasurements = measurements;
report.phaseFailures = failures;
report.phasePreviews = previewDocuments.map(([fileName]) => `previews/${fileName}`);
fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);

if (failures.length) {
  console.error(`Mobilos fázisváltási hibák:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('✓ Választási és csatafázis, animált átmenet és 720×1536 előnézetek: rendben');
}
