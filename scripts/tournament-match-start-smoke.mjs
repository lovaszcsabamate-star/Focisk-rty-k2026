/** Valós Chrome smoke: Torna → keret → 11/11 → MECCS INDÍTÁSA → staging/navigáció. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeChromeFailure, findChrome, runChrome } from './lib/chrome-smoke-runner.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const STANDALONE = path.join(ROOT, 'Fociskartyak2026.html');
const REPORT = path.join(ROOT, 'tournament-match-start-smoke-report.json');
const WIDTH = 390;
const HEIGHT = 900;

const chrome = findChrome();
if (!chrome) throw new Error('A Torna meccsindítási smoke teszthez nem található Chrome vagy Chromium.');
if (!fs.existsSync(STANDALONE)) throw new Error('Hiányzik a Fociskartyak2026.html. Futtasd előbb az npm run build parancsot.');

const source = fs.readFileSync(STANDALONE, 'utf8');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fociskartyak-tournament-match-start-'));

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
  window.__tournamentMatchStartErrors = [];
  window.addEventListener('error', event => window.__tournamentMatchStartErrors.push(String(event.error?.stack || event.message || 'window error')));
  window.addEventListener('unhandledrejection', event => window.__tournamentMatchStartErrors.push(String(event.reason?.stack || event.reason || 'unhandled rejection')));
})();
</script>`;

try {
  const appFileName = 'tournament-match-start-app.html';
  const appFile = path.join(temporaryDirectory, appFileName);
  fs.writeFileSync(appFile, source.replace('<body>', `<body>${instrumentation}`));

  const harness = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;overflow:hidden;background:#111}#app{display:block;width:${WIDTH}px;height:${HEIGHT}px;border:0;margin:0}
</style></head><body><iframe id="app" src="${appFileName}"></iframe><script>
const frame=document.querySelector('#app');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let phase='boot';
const result={width:${WIDTH},alerts:[],errors:[],lineupPresent:false,selectedCount:0,startPresent:false,startEnabled:false,navigated:false,launchMarker:false,currentMatchId:'',url:''};
const finish=()=>document.documentElement.setAttribute('data-tournament-match-start-smoke',encodeURIComponent(JSON.stringify(result)));
const failLater=message=>{result.errors.push(message);phase='done';finish();};
frame.addEventListener('load',()=>{
  const win=frame.contentWindow;
  const doc=frame.contentDocument;
  if(phase==='await-navigation'){
    phase='done';
    result.url=String(win.location.href||'');
    result.launchMarker=/[?&]tournamentMatchLaunch=/.test(result.url);
    result.navigated=result.launchMarker;
    try{result.currentMatchId=String(win.FociskartyakTournament?.read?.()?.currentMatchId||'');}catch{}
    result.errors.push(...(win.__tournamentMatchStartErrors||[]));
    finish();
    return;
  }
  if(phase!=='boot')return;
  phase='flow';
  setTimeout(async()=>{
    try{
      win.alert=message=>result.alerts.push(String(message));
      win.confirm=()=>true;
      win.FociskartyakCupSelector?.show?.();
      await sleep(260);
      doc.querySelector('[data-series="hungarian-league"]')?.click();
      await sleep(100);
      doc.querySelector('.tx-cup-primary')?.click();
      await sleep(260);

      const eto=[...doc.querySelectorAll('[data-mini-team]')].find(button=>/ETO FC/i.test(button.getAttribute('aria-label')||''));
      eto?.click();
      await sleep(180);
      doc.querySelector('.tx-actions__primary')?.click();
      await sleep(140);
      const tournamentStart=doc.querySelector('[data-start]');
      if(!tournamentStart||tournamentStart.disabled)throw new Error('A Magyar Bajnokság ETO FC-vel nem indítható.');
      tournamentStart.click();
      await sleep(180);
      doc.querySelector('[data-skip]')?.click();
      await sleep(60);
      doc.querySelector('[data-continue]')?.click();
      await sleep(360);

      const center=doc.querySelector('.tournament-center[data-experience-v2="true"]');
      if(!center)throw new Error('A Torna központ nem jelent meg.');
      const introTrigger=center.querySelector('.tournament-match-intro-trigger');
      const nativePlay=center.querySelector('#tournament-play');
      (introTrigger||nativePlay)?.click();
      await sleep(180);

      const intro=doc.querySelector('.tournament-match-intro');
      if(intro){
        const proceed=[...intro.querySelectorAll('button')].find(button=>/Keret összeállítása/i.test(button.textContent||''));
        if(!proceed)throw new Error('A mérkőzésfelvezetésből nem érhető el a keret összeállítása.');
        proceed.click();
        await sleep(220);
      }

      const lineup=doc.querySelector('.tournament-lineup');
      result.lineupPresent=Boolean(lineup);
      if(!lineup)throw new Error('A Torna keretválasztó nem jelent meg.');
      const checked=[...lineup.querySelectorAll('[data-player-id]:checked')];
      const start=lineup.querySelector('#lineup-start');
      result.selectedCount=checked.length;
      result.startPresent=Boolean(start);
      result.startEnabled=Boolean(start&&!start.disabled);
      if(checked.length!==11)throw new Error('A keret nem 11/11 játékossal indul: '+checked.length+'/11.');
      if(!start||start.disabled)throw new Error('A MECCS INDÍTÁSA gomb nem aktív 11/11 keretnél.');

      phase='await-navigation';
      start.click();
      setTimeout(()=>{
        if(phase!=='await-navigation')return;
        phase='done';
        result.url=String(frame.contentWindow?.location?.href||'');
        result.errors.push(...(frame.contentWindow?.__tournamentMatchStartErrors||[]));
        result.errors.push('A MECCS INDÍTÁSA után nem történt Tournament staging/navigáció.');
        finish();
      },1400);
    }catch(error){
      result.errors.push(...(win.__tournamentMatchStartErrors||[]),String(error?.stack||error));
      phase='done';
      finish();
    }
  },1250);
});
</script></body></html>`;
  const harnessFile = path.join(temporaryDirectory, 'tournament-match-start-harness.html');
  fs.writeFileSync(harnessFile, harness);

  const run = runChrome(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--allow-file-access-from-files', '--window-size=700,1000', '--force-device-scale-factor=1',
    '--virtual-time-budget=9000', '--dump-dom', `file://${harnessFile}`,
  ], { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });

  const match = run.stdout.match(/data-tournament-match-start-smoke="([^"]+)"/);
  if(!run.ok||!match){
    const reason=!run.ok?describeChromeFailure(run):'nem érkezett meccsindítási smoke eredmény';
    fs.writeFileSync(REPORT, `${JSON.stringify({failure:reason,stderr:run.stderr.slice(-3000),domTail:run.stdout.slice(-3000)},null,2)}\n`);
    throw new Error(`Torna meccsindítási Chrome smoke: ${reason}`);
  }

  const result=JSON.parse(decodeURIComponent(match[1]));
  fs.writeFileSync(REPORT, `${JSON.stringify(result,null,2)}\n`);
  const failures=[];
  if(!result.lineupPresent)failures.push('a keretválasztó nem jelent meg');
  if(result.selectedCount!==11)failures.push(`nem 11/11 a keret (${result.selectedCount}/11)`);
  if(!result.startPresent||!result.startEnabled)failures.push('a MECCS INDÍTÁSA gomb nem aktív');
  if(result.alerts.length)failures.push(`blokkoló alert: ${result.alerts.join(' | ')}`);
  if(result.errors.length)failures.push(`runtime hiba: ${result.errors.join(' | ')}`);
  if(!result.navigated||!result.launchMarker)failures.push(`nem történt Tournament launch navigáció (${result.url||'nincs URL'})`);
  if(failures.length)throw new Error(`Torna meccsindítási regresszió:\n- ${failures.join('\n- ')}`);

  console.log(`✓ Valós Torna meccsindítás: ${WIDTH}px, ETO FC, 11/11 keret, nincs alert, Tournament staging és navigáció rendben.`);
} finally {
  fs.rmSync(temporaryDirectory,{recursive:true,force:true});
}
