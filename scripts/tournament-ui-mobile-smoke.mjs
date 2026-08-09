/** Valódi headless Chrome smoke a Torna kupa-, csapatválasztó és center mobilnézeteire. */

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
    localStorage.removeItem('fociskartyak.tournament.v1');
    localStorage.removeItem('fociskartyak.tournament-pending-launch.v1');
    localStorage.removeItem('fociskartyak.tournament-lineup.v1');
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
  const isVisible=node=>Boolean(node&&win.getComputedStyle(node).display!=='none'&&win.getComputedStyle(node).visibility!=='hidden'&&(node.getBoundingClientRect?.().width||0)>0&&(node.getBoundingClientRect?.().height||0)>0);
  const root=doc.documentElement;
  const body=doc.body;
  const result={requestedWidth:${width},viewport:win.innerWidth,errors:[]};
  try {
    win.FociskartyakCupSelector?.show?.();
    await sleep(260);
    const cup=doc.querySelector('.tx-cup-selector-v3');
    const locations=[...doc.querySelectorAll('.tx-cup-locations button')];
    const cupStage=doc.querySelector('.tx-cup-stage');
    const leagueSeries=doc.querySelector('[data-series="hungarian-league"]');
    leagueSeries?.click();
    await sleep(120);
    const cupPrimary=doc.querySelector('.tx-cup-primary');
    result.cup={
      present:Boolean(cup),
      rect:rect(cup),
      stage:rect(cupStage),
      leagueSelected:Boolean(doc.querySelector('[data-series="hungarian-league"].is-selected')),
      primaryHeight:targetHeight(cupPrimary),
      locationHeights:locations.map(targetHeight),
      locationOverflow:locations.map(button=>button.scrollWidth>button.clientWidth+2),
      documentWidth:Math.max(root.scrollWidth,body.scrollWidth),
    };
    cupPrimary?.click();
    await sleep(260);
    let team=doc.querySelector('.tournament-experience-v2:not(.tx-cup-selector-v3)');
    const puskas=[...doc.querySelectorAll('[data-mini-team]')].find(button=>/Puskás Akadémia FC/i.test(button.getAttribute('aria-label')||''));
    puskas?.click();
    await sleep(220);
    team=doc.querySelector('.tournament-experience-v2:not(.tx-cup-selector-v3)');
    const hero=doc.querySelector('.tx-team-hero');
    const heroMark=hero?.querySelector('.tx-team-mark');
    const crest=heroMark?.querySelector('svg[data-club-short-label]');
    const arrows=[...doc.querySelectorAll('.tx-team-arrow')];
    const teamPrimary=doc.querySelector('.tx-actions__primary');
    const teamName=hero?.querySelector('h2');
    const quickWall=doc.querySelector('.tx-mini-teams');
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
      quickWallHidden:quickWall ? win.getComputedStyle(quickWall).display==='none' : true,
      documentWidth:Math.max(root.scrollWidth,body.scrollWidth),
    };

    teamPrimary?.click();
    await sleep(140);
    const start=doc.querySelector('[data-start]');
    result.summary={present:Boolean(start),startEnabled:Boolean(start&&!start.disabled)};
    start?.click();
    await sleep(180);
    doc.querySelector('[data-skip]')?.click();
    await sleep(60);
    doc.querySelector('[data-continue]')?.click();
    await sleep(360);

    const center=doc.querySelector('.tournament-center[data-experience-v2="true"]');
    const tableButton=center?.querySelector('[data-tab="table"]');
    tableButton?.click();
    await sleep(100);
    const tableContent=center?.querySelector('[data-content="table"]');
    const tableWrap=tableContent?.querySelector('.tournament-table-wrap');
    const row=tableContent?.querySelector('tbody tr');
    const cells=[...row?.querySelectorAll?.('td')??[]];
    const playButtons=[...center?.querySelectorAll?.('#tournament-play')??[]];
    result.center={
      present:Boolean(center),
      documentWidth:Math.max(root.scrollWidth,body.scrollWidth),
      tableTabPresent:Boolean(tableButton),
      tableVisible:Boolean(tableContent&&!tableContent.hidden),
      tableCellCount:cells.length,
      visibleCellCount:cells.filter(isVisible).length,
      pointsVisible:isVisible(cells[7]),
      tableOverflow:Boolean(tableWrap&&tableWrap.scrollWidth>tableWrap.clientWidth+2),
      playButtonCount:playButtons.length,
      playLabel:playButtons[0]?.textContent?.replace(/\\s+/g,' ').trim()||'',
    };
    result.errors=win.__tournamentUiSmokeErrors||[];
  } catch(error) {
    result.errors=[...(win.__tournamentUiSmokeErrors||[]),String(error?.stack||error)];
  }
  document.documentElement.setAttribute('data-tournament-ui-smoke',encodeURIComponent(JSON.stringify(result)));
},1250));
</script></body></html>`;
    const harnessFile = path.join(temporaryDirectory, `tournament-harness-${width}.html`);
    fs.writeFileSync(harnessFile, harness);

    const run = runChrome(chrome, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--allow-file-access-from-files', '--window-size=700,1000', '--force-device-scale-factor=1',
      '--virtual-time-budget=6000', '--dump-dom', `file://${harnessFile}`,
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
      [result.cup?.leagueSelected, 'a Magyar Bajnokság explicit kiválasztása sikertelen'],
      [result.cup?.documentWidth <= width + 1, `kupaválasztó vízszintes overflow: ${result.cup?.documentWidth}px`],
      [(result.cup?.primaryHeight ?? 0) >= 44, 'a kupa CTA 44px-nél kisebb'],
      [(result.cup?.locationHeights ?? []).every(value => value >= 44), 'helyszín touch target 44px-nél kisebb'],
      [!(result.cup?.locationOverflow ?? []).some(Boolean), 'helyszínfelirat levágódik'],
      [result.team?.present, 'a csapatválasztó nem jelent meg'],
      [result.team?.documentWidth <= width + 1, `csapatválasztó vízszintes overflow: ${result.team?.documentWidth}px`],
      [result.team?.name === 'Puskás Akadémia FC', `Puskás kiválasztás sikertelen: ${result.team?.name || 'nincs név'}`],
      [result.team?.crest, 'a generált klubpajzs nem jelent meg'],
      [result.team?.crestLabel === 'PAFC', `hibás Puskás klubjel: ${result.team?.crestLabel || 'nincs'}`],
      [result.team?.quickWallHidden, 'a másodlagos mini-klubfal látható maradt'],
      [(result.team?.arrowHeights ?? []).length === 2 && result.team.arrowHeights.every(value => value >= 44), 'csapatlapozó touch target 44px-nél kisebb'],
      [(result.team?.primaryHeight ?? 0) >= 44, 'a csapat CTA 44px-nél kisebb'],
      [result.summary?.present && result.summary?.startEnabled, 'a Magyar Bajnokság összefoglalója nem indítható'],
      [result.center?.present, 'a Torna központ nem jelent meg'],
      [result.center?.documentWidth <= width + 1, `Torna központ vízszintes overflow: ${result.center?.documentWidth}px`],
      [result.center?.tableTabPresent && result.center?.tableVisible, 'a Tabella nézet nem nyitható meg'],
      [result.center?.tableCellCount === 8, `a tabella nem tartalmazza mind a 8 oszlopot: ${result.center?.tableCellCount ?? 0}`],
      [result.center?.visibleCellCount === 8, `mobilon rejtett tabellaadat maradt: ${result.center?.visibleCellCount ?? 0}/8`],
      [result.center?.pointsVisible, 'a pontszám mobilon nem látható'],
      [!result.center?.tableOverflow, 'a mobil tabella belső vízszintes görgetést igényel'],
      [result.center?.playButtonCount === 1, `nem pontosan egy MÉRKŐZÉS CTA látható: ${result.center?.playButtonCount ?? 0}`],
      [/MÉRKŐZÉS/.test(result.center?.playLabel ?? ''), `hibás meccs CTA: ${result.center?.playLabel || 'nincs'}`],
      [(result.errors ?? []).length === 0, `runtime hiba: ${(result.errors ?? []).join(' | ')}`],
    ];
    for (const [ok, message] of checks) if (!ok) failures.push(`${width}px: ${message}`);
  }
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

fs.writeFileSync(REPORT, `${JSON.stringify({ widths: WIDTHS, measurements, failures }, null, 2)}\n`);
if (failures.length) throw new Error(`Torna UI mobil regresszió:\n- ${failures.join('\n- ')}`);
console.log(`✓ Torna teljes mobil flow: ${WIDTHS.join('/')} px, Magyar Bajnokság → PAFC → center, 8/8 tabellaadat, nincs overflow, egy MÉRKŐZÉS CTA.`);