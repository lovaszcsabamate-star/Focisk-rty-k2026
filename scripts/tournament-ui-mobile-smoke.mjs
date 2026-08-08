/** Valódi headless Chrome smoke a Torna kupa- és csapatválasztó mobilnézeteire. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeChromeFailure, findChrome, runChrome } from './lib/chrome-smoke-runner.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const STANDALONE = path.join(ROOT, 'Fociskartyak2026.html');
const REPORT = path.join(ROOT, 'tournament-ui-mobile-report.json');
const WIDTHS = [320, 360, 390, 412, 480];
const HEIGHT = 900;

const chrome = findChrome();
if (!chrome) throw new Error('A Torna mobilteszthez nem található Chrome vagy Chromium.');
if (!fs.existsSync(STANDALONE)) throw new Error('Hiányzik a Fociskartyak2026.html. Futtasd előbb az npm run build parancsot.');

const source = fs.readFileSync(STANDALONE, 'utf8');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fociskartyak-tournament-ui-'));
const failures = [];
const measurements = [];

const instrumentation = `<script>
(() => {
  try {
    localStorage.setItem('fociskartyak:onboarding-complete', 'true');
    localStorage.setItem('fociskartyak:player-name:v1', 'Csabi');
    localStorage.removeItem('fociskartyak:tournament-draft:v2');
  } catch {}
  window.__tournamentUiSmokeErrors = [];
  window.addEventListener('error', event => window.__tournamentUiSmokeErrors.push(String(event.error?.stack || event.message || 'window error')));
  window.addEventListener('unhandledrejection', event => window.__tournamentUiSmokeErrors.push(String(event.reason?.stack || event.reason || 'unhandled rejection')));
})();
</script>`;

try {
  for (const width of WIDTHS) {
    const appFileName = `tournament-app-${width}.html`;
    const appFile = path.join(temporaryDirectory, appFileName);
    fs.writeFileSync(appFile, source.replace('<body>', `<body>${instrumentation}`));

    const harness = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;overflow:hidden;background:#111}#app{display:block;width:${width}px;height:${HEIGHT}px;border:0;margin:0}
</style></head><body><iframe id="app" src="${appFileName}"></iframe><script>
const frame=document.querySelector('#app');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
frame.addEventListener('load',()=>setTimeout(async()=>{
  const doc=frame.contentDocument;
  const win=frame.contentWindow;
  const rect=node=>{const r=node?.getBoundingClientRect?.();return r?{left:Math.round(r.left),right:Math.round(r.right),top:Math.round(r.top),bottom:Math.round(r.bottom),width:Math.round(r.width),height:Math.round(r.height)}:null};
  const targetHeight=node=>Math.round(node?.getBoundingClientRect?.().height||0);
  const root=doc.documentElement;
  const body=doc.body;
  const result={requestedWidth:${width},viewport:win.innerWidth,errors:[]};
  try {
    win.FociskartyakCupSelector?.show?.();
    await sleep(320);
    const cup=doc.querySelector('.tx-cup-selector-v3');
    const locations=[...doc.querySelectorAll('.tx-cup-locations button')];
    const cupPrimary=doc.querySelector('.tx-cup-primary');
    const cupStage=doc.querySelector('.tx-cup-stage');
    result.cup={
      present:Boolean(cup),
      rect:rect(cup),
      stage:rect(cupStage),
      primaryHeight:targetHeight(cupPrimary),
      locationHeights:locations.map(targetHeight),
      locationOverflow:locations.map(button=>button.scrollWidth>button.clientWidth+2),
      documentWidth:Math.max(root.scrollWidth,body.scrollWidth),
    };
    cupPrimary?.click();
    await sleep(360);
    let team=doc.querySelector('.tournament-experience-v2:not(.tx-cup-selector-v3)');
    const puskas=[...doc.querySelectorAll('[data-mini-team]')].find(button=>/Puskás Akadémia FC/i.test(button.getAttribute('aria-label')||''));
    puskas?.click();
    await sleep(360);
    team=doc.querySelector('.tournament-experience-v2:not(.tx-cup-selector-v3)');
    const hero=doc.querySelector('.tx-team-hero');
    const heroMark=hero?.querySelector('.tx-team-mark');
    const crest=heroMark?.querySelector('svg[data-club-short-label]');
    const arrows=[...doc.querySelectorAll('.tx-team-arrow')];
    const teamPrimary=doc.querySelector('.tx-actions__primary');
    const teamName=hero?.querySelector('h2');
    result.team={
      present:Boolean(team),
      rect:rect(team),
      hero:rect(hero),
      name:teamName?.textContent?.trim()||'',
      nameRect:rect(teamName),
      crest:Boolean(crest),
      crestLabel:crest?.getAttribute('data-club-short-label')||'',
      markRect:rect(heroMark),
      arrowHeights:arrows.map(targetHeight),
      primaryHeight:targetHeight(teamPrimary),
      documentWidth:Math.max(root.scrollWidth,body.scrollWidth),
    };
    result.errors=win.__tournamentUiSmokeErrors||[];
  } catch(error) {
    result.errors=[...(win.__tournamentUiSmokeErrors||[]),String(error?.stack||error)];
  }
  document.documentElement.setAttribute('data-tournament-ui-smoke',encodeURIComponent(JSON.stringify(result)));
},1500));
</script></body></html>`;
    const harnessFile = path.join(temporaryDirectory, `tournament-harness-${width}.html`);
    fs.writeFileSync(harnessFile, harness);

    const run = runChrome(chrome, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--allow-file-access-from-files', '--window-size=700,1000', '--force-device-scale-factor=1',
      '--virtual-time-budget=6500', '--dump-dom', `file://${harnessFile}`,
    ], { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });

    const match = run.stdout.match(/data-tournament-ui-smoke="([^"]+)"/);
    if (!run.ok || !match) {
      const reason = !run.ok ? describeChromeFailure(run) : 'nem érkezett Torna UI mérési eredmény';
      failures.push(`${width}px: ${reason}`);
      measurements.push({ width, failure: reason, stderr: run.stderr.slice(-2000), domTail: run.stdout.slice(-2000) });
      continue;
    }

    const result = JSON.parse(decodeURIComponent(match[1]));
    measurements.push(result);
    const checks = [
      [result.viewport === width, `viewport ${result.viewport}px a kért ${width}px helyett`],
      [result.cup?.present, 'a kupaválasztó nem jelent meg'],
      [result.cup?.documentWidth <= width + 1, `kupaválasztó vízszintes overflow: ${result.cup?.documentWidth}px`],
      [(result.cup?.primaryHeight ?? 0) >= 44, 'a kupa CTA 44px-nél kisebb'],
      [(result.cup?.locationHeights ?? []).every(value => value >= 44), 'helyszín touch target 44px-nél kisebb'],
      [!(result.cup?.locationOverflow ?? []).some(Boolean), 'helyszínfelirat levágódik'],
      [result.team?.present, 'a csapatválasztó nem jelent meg'],
      [result.team?.documentWidth <= width + 1, `csapatválasztó vízszintes overflow: ${result.team?.documentWidth}px`],
      [result.team?.name === 'Puskás Akadémia FC', `Puskás kiválasztás sikertelen: ${result.team?.name || 'nincs név'}`],
      [result.team?.crest, 'a generált klubpajzs nem jelent meg'],
      [result.team?.crestLabel === 'PAFC', `hibás Puskás klubjel: ${result.team?.crestLabel || 'nincs'}`],
      [(result.team?.arrowHeights ?? []).length === 2 && result.team.arrowHeights.every(value => value >= 44), 'csapatlapozó touch target 44px-nél kisebb'],
      [(result.team?.primaryHeight ?? 0) >= 44, 'a csapat CTA 44px-nél kisebb'],
      [(result.errors ?? []).length === 0, `runtime hiba: ${(result.errors ?? []).join(' | ')}`],
    ];
    for (const [ok, message] of checks) if (!ok) failures.push(`${width}px: ${message}`);
  }
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

fs.writeFileSync(REPORT, `${JSON.stringify({ widths: WIDTHS, measurements, failures }, null, 2)}\n`);
if (failures.length) throw new Error(`Torna UI mobil regresszió:\n- ${failures.join('\n- ')}`);
console.log(`✓ Torna kupa/csapat UI: ${WIDTHS.join('/')} px, PAFC generált címer, nincs overflow, touch target >=44 px.`);
