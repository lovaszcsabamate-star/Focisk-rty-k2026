/** Render the exact in-round mobile selection layout in real headless Chrome. */

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
const HEIGHT = 820;

const chrome = [
  process.env.CHROME_BIN,
  'google-chrome-stable',
  'google-chrome',
  'chromium',
  'chromium-browser',
].filter(Boolean).find(command => spawnSync(command, ['--version'], { encoding: 'utf8' }).status === 0);

if (!chrome) throw new Error('A mobilos választási teszthez nem található Chrome vagy Chromium.');
if (!fs.existsSync(STANDALONE)) throw new Error('Hiányzik a generált Fociskartyak2026.html.');

const standalone = fs.readFileSync(STANDALONE, 'utf8');
const styleMatch = standalone.match(/<style>([\s\S]*?)<\/style>/i);
if (!styleMatch) throw new Error('A generált játékból nem olvasható ki a beágyazott CSS.');
const css = styleMatch[1].replace(/url\("data:[^"]+"\)/g, 'none');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fociskartyak-selection-'));
const failures = [];
const measurements = [];

const attemptMarks = (firstClass, firstSymbol) => Array.from({ length: 11 }, (_, index) =>
  `<span class="attempt ${index === 0 ? firstClass : 'attempt--empty'}">${index === 0 ? firstSymbol : '○'}</span>`
).join('');

const card = name => `
  <article class="card selectable card--direct-play card--choice">
    <div class="card__portrait" data-initials="VM"><span class="card__position">Középpályás</span></div>
    <div class="card__name">${name}</div>
    <div class="card__club">DVTK · 🇪🇸</div>
    <div class="card__stats">
      <div class="stat active"><span class="stat__label">🎂 Életkor</span><span class="stat__value">23 év</span></div>
      <div class="stat"><span class="stat__label">👕 Mérkőzések</span><span class="stat__value">27</span></div>
      <div class="stat"><span class="stat__label">▶ Kezdőként</span><span class="stat__value">25</span></div>
      <div class="stat"><span class="stat__label">⚽ Gólok</span><span class="stat__value">2</span></div>
      <div class="stat"><span class="stat__label">📋 Meccskeretben</span><span class="stat__value">30</span></div>
    </div>
  </article>`;

for (const width of WIDTHS) {
  const fixtureFileName = `selection-app-${width}.html`;
  const fixtureFile = path.join(temporaryDirectory, fixtureFileName);
  const fixture = `<!doctype html>
<html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>${css}</style></head><body>
<div id="pub" class="mode-penalties is-card-selection">
  <main id="table">
    <header id="hud">
      <div class="title">Fociskártyák 2026</div>
      <div class="score-strip" id="hud-scores">
        <div class="match-scoreboard match-scoreboard--penalties">
          <div class="match-scoreboard__competition">5. SZINT · OVR 87 · NB I KÁRTYAMECCS</div>
          <div class="match-team match-team--home"><span class="match-team__name">JÁTÉKOS</span></div>
          <div class="match-scoreboard__score"><strong class="match-scoreboard__number">1</strong><span>–</span><strong class="match-scoreboard__number">0</strong></div>
          <div class="match-team match-team--away"><span class="match-team__name">D. RAVEN</span></div>
          <div class="match-scoreboard__status">KATEGÓRIÁT VÁLASZT: GÉP</div>
        </div>
      </div>
      <div class="meta" id="hud-meta">Rendes párbajok: 1/5 · hátra 4</div>
      <div class="hud-settings" id="hud-settings"><button class="icon-toggle">☰</button></div>
    </header>
    <section class="zone" id="opponent-zone">
      <div class="pile" id="opponent-pile"></div>
      <div class="hand hand--opponent" id="opponent-hand"><div class="card card--back"></div><div class="card card--back"></div></div>
    </section>
    <section id="felt">
      <div id="penalty-board">
        <div class="attempt-row"><strong>JÁTÉKOS</strong><div class="attempt-marks">${attemptMarks('attempt--win', '⚽')}</div></div>
        <div class="attempt-row"><strong>GÉP</strong><div class="attempt-marks">${attemptMarks('attempt--loss', '✕')}</div></div>
      </div>
      <div class="game-steps"><span class="game-step is-complete">1. Kategória</span><span class="game-step is-active">2. Kártya</span><span class="game-step">3. Eredmény</span></div>
      <div id="prompt">A gép ezt választotta: <span class="highlight">Fiatalabb játékos</span><small class="ux-direction">— a fiatalabb nyer</small></div>
      <div id="duel">
        <div class="duel-slot"><div class="duel-slot__who">Játékos</div><div class="card card--empty"></div></div>
        <div class="versus">VS</div>
        <div class="duel-slot"><div class="duel-slot__who">Gép</div><div class="card card--back"></div></div>
      </div>
      <div id="verdict"></div><div id="attribute-picker"></div>
    </section>
    <section class="zone" id="player-zone">
      <div class="pile filled" id="player-pile">1<span class="pile__label">Használt lapok</span></div>
      <div class="hand hand--selection has-scroll-hint" id="player-hand">
        ${['Moshe', 'Vallejo Minguez', 'D’Encarnacao Duarte', 'Törőcsik Péter', 'Sevikyan Edgar'].map(card).join('')}
      </div>
    </section>
  </main>
  <aside id="banter"></aside>
</div>
</body></html>`;
  fs.writeFileSync(fixtureFile, fixture);

  /* Chrome headless enforces a minimum top-level window width on some runners.
     Measuring inside a fixed-width iframe gives the requested mobile viewport
     exactly and avoids the intermittent 500 px fallback seen in CI. */
  const harness = `<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;overflow:hidden;background:#111}
#app{display:block;width:${width}px;height:${HEIGHT}px;border:0;margin:0}
</style></head><body>
<iframe id="app" src="${fixtureFileName}"></iframe>
<script>
const frame=document.querySelector('#app');
frame.addEventListener('load',()=>setTimeout(()=>{
  const win=frame.contentWindow;
  const documentRoot=frame.contentDocument.documentElement;
  const body=frame.contentDocument.body;
  const q=selector=>frame.contentDocument.querySelector(selector).getBoundingClientRect();
  const viewport=win.innerWidth;
  const felt=q('#felt');
  const prompt=q('#prompt');
  const duel=q('#duel');
  const zone=q('#player-zone');
  const hand=q('#player-hand');
  const first=q('#player-hand .card');
  const choiceHeights=[...frame.contentDocument.querySelectorAll('#player-hand .card')].map(node=>node.getBoundingClientRect().height);
  const result={
    requestedWidth:${width},
    viewport,
    documentWidth:Math.max(documentRoot.scrollWidth,body.scrollWidth),
    opponentHidden:getComputedStyle(frame.contentDocument.querySelector('#opponent-zone')).display==='none',
    promptHeight:Math.round(prompt.height),
    promptBeforeDuel:prompt.bottom<=duel.top+1,
    duelInsideFelt:duel.left>=felt.left-1&&duel.right<=felt.right+1&&duel.bottom<=felt.bottom+1,
    zoneInsideViewport:zone.left>=-1&&zone.right<=viewport+1,
    handInsideViewport:hand.left>=-1&&hand.right<=viewport+1,
    firstCardVisible:first.left>=hand.left-1,
    feltBeforeZone:felt.bottom<=zone.top+2,
    maxChoiceHeight:Math.round(Math.max(...choiceHeights)),
    rects:{
      felt:{top:Math.round(felt.top),bottom:Math.round(felt.bottom),left:Math.round(felt.left),right:Math.round(felt.right)},
      prompt:{top:Math.round(prompt.top),bottom:Math.round(prompt.bottom)},
      duel:{top:Math.round(duel.top),bottom:Math.round(duel.bottom),left:Math.round(duel.left),right:Math.round(duel.right)},
      zone:{top:Math.round(zone.top),bottom:Math.round(zone.bottom),left:Math.round(zone.left),right:Math.round(zone.right)},
      hand:{left:Math.round(hand.left),right:Math.round(hand.right)},
      first:{left:Math.round(first.left),right:Math.round(first.right)}
    }
  };
  document.documentElement.setAttribute('data-selection-smoke',encodeURIComponent(JSON.stringify(result)));
},1200));
</script></body></html>`;

  const harnessFile = path.join(temporaryDirectory, `selection-harness-${width}.html`);
  fs.writeFileSync(harnessFile, harness);
  const run = spawnSync(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--allow-file-access-from-files', '--window-size=700,1000', '--force-device-scale-factor=1',
    '--virtual-time-budget=5000', '--dump-dom', `file://${harnessFile}`,
  ], { encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL', maxBuffer: 30 * 1024 * 1024 });

  const match = run.stdout.match(/data-selection-smoke="([^"]+)"/);
  if (run.status !== 0 || !match) {
    const message = `${width}px: a választási állapot nem mérhető.`;
    failures.push(message);
    measurements.push({ width, failure: message, status: run.status, stderr: run.stderr.slice(-2000), domTail: run.stdout.slice(-2000) });
    continue;
  }

  const result = JSON.parse(decodeURIComponent(match[1]));
  const checks = [
    [result.viewport === width, `a mért viewport ${result.viewport}px a kért ${width}px helyett`],
    [result.documentWidth <= result.viewport + 1, 'vízszintes dokumentum-kilógás'],
    [result.opponentHidden, 'a fölösleges ellenfél-lapsor látható maradt'],
    [result.promptHeight <= 62, `a kategóriaszöveg túl magas (${result.promptHeight}px)`],
    [result.promptBeforeDuel, 'a kategóriaszöveg ráfolyik a párbajra'],
    [result.duelInsideFelt, 'a félkész párbaj kilóg a játékmezőből'],
    [result.zoneInsideViewport, 'a játékos zónája kilóg a képernyőről'],
    [result.handInsideViewport, 'a kártyasor kilóg a képernyőről'],
    [result.firstCardVisible, 'az első választható kártya részben képernyőn kívül indul'],
    [result.feltBeforeZone, 'a játékmező és a kártyasor egymásra csúszik'],
    [result.maxChoiceHeight <= 245, `a választható kártyák túl magasak (${result.maxChoiceHeight}px)`],
  ];
  const widthFailures = checks.filter(([ok]) => !ok).map(([, message]) => `${width}px: ${message}.`);
  failures.push(...widthFailures);
  measurements.push({ width, ...result, failures: widthFailures });
  console.log(`✓ ${width}px választási nézet: prompt ${result.promptHeight}px, kártya max. ${result.maxChoiceHeight}px`);
}

fs.rmSync(temporaryDirectory, { recursive: true, force: true });
let report = {};
try { report = JSON.parse(fs.readFileSync(REPORT, 'utf8')); } catch { /* standalone report */ }
report.selectionMeasurements = measurements;
report.selectionFailures = failures;
fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);

if (failures.length) {
  console.error(`Mobilos kártyaválasztási hibák:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('✓ Valódi Chrome kártyaválasztási nézet: rendben');
}
