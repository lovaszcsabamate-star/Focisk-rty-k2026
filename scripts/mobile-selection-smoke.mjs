/** Exercise the in-round mobile card-selection state in real headless Chrome. */

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

const original = fs.readFileSync(STANDALONE, 'utf8');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fociskartyak-selection-'));
const failures = [];
const measurements = [];

for (const width of WIDTHS) {
  const appFileName = `selection-app-${width}.html`;
  const appFile = path.join(temporaryDirectory, appFileName);
  fs.writeFileSync(appFile, original.replace(
    '<body>',
    '<body><script>try{localStorage.setItem("fociskartyak:onboarding-complete","true")}catch{}</script>',
  ));

  const harness = `<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;overflow:hidden;background:#111}
#app{display:block;width:${width}px;height:${HEIGHT}px;border:0;margin:0}
</style></head><body>
<iframe id="app" src="${appFileName}"></iframe>
<script>
const frame=document.querySelector('#app');
const card=(name,active=false)=>'<article class="card selectable card--direct-play card--choice"><div class="card__portrait" data-initials="VM"><span class="card__position">Középpályás</span></div><div class="card__name">'+name+'</div><div class="card__club">DVTK · 🇪🇸</div><div class="card__stats"><div class="stat'+(active?' active':'')+'"><span class="stat__label">🎂 Életkor</span><span class="stat__value">23 év</span></div><div class="stat"><span class="stat__label">👕 Mérkőzések</span><span class="stat__value">27</span></div><div class="stat"><span class="stat__label">▶ Kezdőként</span><span class="stat__value">25</span></div><div class="stat"><span class="stat__label">⚽ Gólok</span><span class="stat__value">2</span></div><div class="stat"><span class="stat__label">📋 Meccskeretben</span><span class="stat__value">30</span></div></div></article>';
frame.addEventListener('load',()=>setTimeout(()=>{
  const d=frame.contentDocument;
  d.querySelector('#app-loading').hidden=true;
  d.querySelector('#overlay').hidden=true;
  const pub=d.querySelector('#pub');
  pub.className='mode-penalties is-card-selection';
  d.querySelector('#hud-scores').innerHTML='<div class="match-scoreboard match-scoreboard--penalties"><div class="match-scoreboard__competition">5. SZINT · OVR 87 · NB I KÁRTYAMECCS</div><div class="match-team match-team--home"><span class="match-team__name">JÁTÉKOS</span></div><div class="match-scoreboard__score"><strong class="match-scoreboard__number">1</strong><span>–</span><strong class="match-scoreboard__number">0</strong></div><div class="match-team match-team--away"><span class="match-team__name">D. RAVEN</span></div><div class="match-scoreboard__status">KATEGÓRIÁT VÁLASZT: GÉP</div></div>';
  d.querySelector('#hud-meta').textContent='Rendes párbajok: 1/5 · hátra 4';
  d.querySelector('#opponent-hand').innerHTML='<div class="card card--back"></div><div class="card card--back"></div><div class="card card--back"></div>';
  d.querySelector('#penalty-board').hidden=false;
  d.querySelector('#penalty-board').innerHTML='<div class="attempt-row"><strong>JÁTÉKOS</strong><div class="attempt-marks">'+Array.from({length:11},(_,i)=>'<span class="attempt '+(i===0?'attempt--win':'attempt--empty')+'">'+(i===0?'⚽':'○')+'</span>').join('')+'</div></div><div class="attempt-row"><strong>GÉP</strong><div class="attempt-marks">'+Array.from({length:11},(_,i)=>'<span class="attempt '+(i===0?'attempt--loss':'attempt--empty')+'">'+(i===0?'✕':'○')+'</span>').join('')+'</div></div>';
  const steps=d.createElement('div');steps.className='game-steps';steps.innerHTML='<span class="game-step is-complete">1. Kategória</span><span class="game-step is-active">2. Kártya</span><span class="game-step">3. Eredmény</span>';d.querySelector('#felt').insertBefore(steps,d.querySelector('#prompt'));
  d.querySelector('#prompt').innerHTML='A gép ezt választotta: <span class="highlight">Fiatalabb játékos</span><small class="ux-direction">— a fiatalabb nyer</small>';
  d.querySelector('#duel').innerHTML='<div class="duel-slot"><div class="duel-slot__who">Játékos</div><div class="card card--empty"></div></div><div class="versus">VS</div><div class="duel-slot"><div class="duel-slot__who">Gép</div><div class="card card--back"></div></div>';
  d.querySelector('#player-pile').classList.add('filled');d.querySelector('#player-pile').append(' 1');
  d.querySelector('#player-hand').className='hand hand--selection has-scroll-hint';
  d.querySelector('#player-hand').innerHTML=[card('Moshe',true),card('Vallejo Minguez',true),card("D’Encarnacao Duarte",true),card('Törőcsik Péter',true),card('Sevikyan Edgar',true)].join('');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const q=s=>d.querySelector(s).getBoundingClientRect();
    const viewport=frame.contentWindow.innerWidth;
    const felt=q('#felt'),prompt=q('#prompt'),duel=q('#duel'),zone=q('#player-zone'),hand=q('#player-hand');
    const first=q('#player-hand .card');
    const choiceHeights=[...d.querySelectorAll('#player-hand .card')].map(node=>node.getBoundingClientRect().height);
    const result={
      viewport,
      documentWidth:Math.max(d.documentElement.scrollWidth,d.body.scrollWidth),
      opponentHidden:getComputedStyle(d.querySelector('#opponent-zone')).display==='none',
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
        first:{left:Math.round(first.left),right:Math.round(first.right)},
      },
    };
    document.documentElement.setAttribute('data-selection-smoke',encodeURIComponent(JSON.stringify(result)));
  }));
},1500));
</script></body></html>`;

  const harnessFile = path.join(temporaryDirectory, `selection-harness-${width}.html`);
  fs.writeFileSync(harnessFile, harness);
  const run = spawnSync(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--allow-file-access-from-files', '--window-size=600,1000', '--force-device-scale-factor=1',
    '--virtual-time-budget=5000', '--dump-dom', `file://${harnessFile}`,
  ], { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });

  const match = run.stdout.match(/data-selection-smoke="([^"]+)"/);
  if (run.status !== 0 || !match) {
    const message = `${width}px: a választási állapot nem mérhető.`;
    failures.push(message);
    measurements.push({ width, failure: message, status: run.status, stderr: run.stderr.slice(-2000) });
    continue;
  }

  const result = JSON.parse(decodeURIComponent(match[1]));
  const checks = [
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
  const widthFailures = checks.filter(([ok]) => !ok).map(([,message]) => `${width}px: ${message}.`);
  failures.push(...widthFailures);
  measurements.push({ width, ...result, failures: widthFailures });
  console.log(`✓ ${width}px választási nézet: prompt ${result.promptHeight}px, kártya max. ${result.maxChoiceHeight}px`);
}

fs.rmSync(temporaryDirectory, { recursive: true, force: true });
let report = {};
try { report = JSON.parse(fs.readFileSync(REPORT, 'utf8')); } catch { /* standalone selection report */ }
report.selectionMeasurements = measurements;
report.selectionFailures = failures;
fs.writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);

if (failures.length) {
  console.error(`Mobilos kártyaválasztási hibák:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('✓ Valódi Chrome kártyaválasztási nézet: rendben');
}
