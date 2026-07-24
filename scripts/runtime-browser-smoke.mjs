/** Start both game modes in real headless Chrome and detect runtime/UI errors. */

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
  { id: 'classic', button: '#start-btn', expectedClass: null, minimumCards: 5 },
  { id: 'penalties', button: '#penalties-btn', expectedClass: 'mode-penalties', minimumCards: 11 },
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
  /* Deterministic human first turn so the inspector can be tested as a real
     playable-card selector in both game modes. */
  Math.random = () => 0.1;
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
    const url = String(value || '');
    if (url.startsWith('http://') || url.startsWith('https://')) window.__runtimeSmoke.remoteRequests.push(url);
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
      const win = frame.contentWindow;
      const titleText = doc.querySelector('#penalties-btn')?.textContent || '';
      doc.querySelector('${mode.button}')?.click();

      setTimeout(() => {
        /* Penalty mode has a short intro overlay; classic mode simply ignores this. */
        doc.querySelector('#kickoff-btn')?.click();

        setTimeout(() => {
          const category = doc.querySelector('#attribute-picker .attr-btn:not(:disabled)');
          category?.click();

          setTimeout(() => {
            const smoke = win.__runtimeSmoke || { errors: ['hiányzó instrumentáció'], remoteRequests: [], consoleErrors: [] };
            const pub = doc.querySelector('#pub');
            const scoreText = doc.querySelector('#hud-scores')?.textContent || '';
            const visibleCards = [...doc.querySelectorAll('#player-hand .card, #duel .card')].filter(card => card.getBoundingClientRect().width > 0).length;
            const expectedClass = ${JSON.stringify(mode.expectedClass)};
            const handCard = doc.querySelector('#player-hand .card');
            const handRect = handCard?.getBoundingClientRect();
            const pileInspectorCount = doc.querySelectorAll('#player-pile .pile__inspect').length;
            const cardInspectorCount = doc.querySelectorAll('#player-hand .card__inspect').length;
            const pileInspector = doc.querySelector('#player-pile .pile__inspect');
            const handCardsBeforeInspector = [...doc.querySelectorAll('#player-hand .card')].map(card => ({
              id: card.dataset.cardId || '',
              classes: card.className,
              role: card.getAttribute('role'),
              ariaDisabled: card.getAttribute('aria-disabled'),
            }));
            pileInspector?.click();

            setTimeout(() => {
              const inspectorBefore = doc.querySelector('#inspector');
              const backdropBefore = doc.querySelector('#inspector-stable-backdrop');
              const firstInspectedId = inspectorBefore?.querySelector('.card--large')?.dataset.cardId || '';
              const largeBefore = inspectorBefore?.querySelector('.card--large');
              const largeCardPlayable = Boolean(largeBefore?.classList.contains('inspector__playable-card'));
              const playButtonBefore = inspectorBefore?.querySelector('.inspector__actions .btn:not(.btn--ghost)');
              const matchingHandBefore = [...doc.querySelectorAll('#player-hand .card')]
                .find(card => card.dataset.cardId === firstInspectedId);
              inspectorBefore?.querySelector('.inspector__nav:last-child')?.click();

              setTimeout(() => {
                const inspectorAfter = doc.querySelector('#inspector');
                const backdropAfter = doc.querySelector('#inspector-stable-backdrop');
                const nextInspectedId = inspectorAfter?.querySelector('.card--large')?.dataset.cardId || '';
                const largeAfter = inspectorAfter?.querySelector('.card--large');
                const matchingHandAfter = [...doc.querySelectorAll('#player-hand .card')]
                  .find(card => card.dataset.cardId === nextInspectedId);
                const playButtonAfter = inspectorAfter?.querySelector('.inspector__actions .btn:not(.btn--ghost)');
                const backdropPersisted = Boolean(
                  backdropBefore
                  && backdropBefore === backdropAfter
                  && backdropAfter.isConnected
                  && backdropAfter.classList.contains('is-visible')
                );
                inspectorAfter?.querySelector('.card--large.inspector__playable-card')?.click();

                setTimeout(() => {
                  const humanDuelCard = doc.querySelector('#duel .duel-slot:first-child .card');
                  const battleStartedFromLargeCard = Boolean(
                    pub?.classList.contains('is-battle-active')
                    || (humanDuelCard
                      && !humanDuelCard.classList.contains('card--empty')
                      && !humanDuelCard.classList.contains('card--back'))
                  );
                  const result = {
                    mode: '${mode.id}',
                    titleLocalised: /Büntetőpárbaj/.test(titleText),
                    loadingHidden: Boolean(doc.querySelector('#app-loading')?.hidden),
                    loadingError: Boolean(doc.querySelector('.app-loading__error')),
                    overlayHidden: Boolean(doc.querySelector('#overlay')?.hidden),
                    modeClassPresent: expectedClass ? Boolean(pub?.classList.contains(expectedClass)) : true,
                    visibleCards,
                    minimumCards: ${mode.minimumCards},
                    savedNameVisible: /Csabi/i.test(scoreText),
                    handCardWidth: Math.round(handRect?.width || 0),
                    handCardHeight: Math.round(handRect?.height || 0),
                    singlePileInspector: pileInspectorCount === 1,
                    pileInspectorCount,
                    noCardInspectors: cardInspectorCount === 0,
                    cardInspectorCount,
                    inspectorOpened: Boolean(inspectorBefore),
                    backdropOpened: Boolean(backdropBefore?.classList.contains('is-visible')),
                    backdropPersisted,
                    inspectorCardChanged: Boolean(firstInspectedId && nextInspectedId && firstInspectedId !== nextInspectedId),
                    largeCardPlayable,
                    battleStartedFromLargeCard,
                    inspectorDiagnostics: {
                      handCardsBeforeInspector,
                      firstInspectedId,
                      nextInspectedId,
                      largeBeforeClasses: largeBefore?.className || '',
                      largeAfterClasses: largeAfter?.className || '',
                      largeBeforeBound: largeBefore?.dataset.inspectorPlayBound || '',
                      largeAfterBound: largeAfter?.dataset.inspectorPlayBound || '',
                      playButtonBefore: playButtonBefore ? { disabled: playButtonBefore.disabled, text: playButtonBefore.textContent } : null,
                      playButtonAfter: playButtonAfter ? { disabled: playButtonAfter.disabled, text: playButtonAfter.textContent } : null,
                      matchingHandBeforeClasses: matchingHandBefore?.className || '',
                      matchingHandAfterClasses: matchingHandAfter?.className || '',
                    },
                    errors: smoke.errors,
                    consoleErrors: smoke.consoleErrors,
                    remoteRequests: smoke.remoteRequests,
                  };
                  document.documentElement.setAttribute('data-runtime-smoke', encodeURIComponent(JSON.stringify(result)));
                }, 1050);
              }, 360);
            }, 220);
          }, 700);
        }, 850);
      }, 280);
    }, 1300));
  </script></body></html>`;

  const harnessFile = path.join(temporaryDirectory, `harness-${mode.id}.html`);
  fs.writeFileSync(harnessFile, harness);
  const run = spawnSync(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--allow-file-access-from-files', '--window-size=1300,940', '--force-device-scale-factor=1',
    '--virtual-time-budget=9000', '--dump-dom', `file://${harnessFile}`,
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
  if (!result.overlayHidden) modeFailures.push('a kezdőmenü nem zárult be');
  if (!result.modeClassPresent) modeFailures.push('a kiválasztott játékmód osztálya nem aktív');
  if (result.visibleCards < result.minimumCards) modeFailures.push(`csak ${result.visibleCards} kártya jelent meg a várt ${result.minimumCards} helyett`);
  if (!result.savedNameVisible) modeFailures.push('a mentett játékosnév nem jelent meg az eredményjelzőn');
  if (!result.singlePileInspector) modeFailures.push(`nem pontosan egy kézszintű nagyító jelent meg (${result.pileInspectorCount})`);
  if (!result.noCardInspectors) modeFailures.push(`kártyánkénti nagyítók maradtak (${result.cardInspectorCount})`);
  if (!result.inspectorOpened || !result.backdropOpened) modeFailures.push('a nagyított kártyanézet vagy a sötét háttér nem nyílt meg');
  if (!result.backdropPersisted) modeFailures.push('lapozáskor megszakadt vagy kicserélődött a sötét háttér');
  if (!result.inspectorCardChanged) modeFailures.push('a nagyított kártyalapozás nem váltott lapot');
  if (!result.largeCardPlayable) modeFailures.push('a nagyított, kijátszható lap nem kapott interaktív állapotot');
  if (!result.battleStartedFromLargeCard) modeFailures.push('a nagyított lap koppintása nem indította el a párbajt');
  if (result.errors.length) modeFailures.push(`nem kezelt hibák: ${result.errors.join(' | ')}`);
  if (result.consoleErrors.length) modeFailures.push(`console.error: ${result.consoleErrors.join(' | ')}`);
  if (result.remoteRequests.length) modeFailures.push(`külső hálózati kérések: ${result.remoteRequests.join(', ')}`);
  failures.push(...modeFailures.map(message => `${mode.id}: ${message}.`));
  results.push({ ...result, failures: modeFailures });
  console.log(`✓ ${mode.id}: egy nagyító, stabil háttér, lapozás és nagyított lapról indított párbaj`);
}

if (results.length === MODES.length && results.every(result => !result.failure)) {
  const [classic, penalties] = results;
  if (Math.abs(classic.handCardWidth - penalties.handCardWidth) > 1
    || Math.abs(classic.handCardHeight - penalties.handCardHeight) > 1) {
    failures.push(`A Klasszikus és Büntetőpárbaj kézkártyái eltérő méretűek: ${classic.handCardWidth}×${classic.handCardHeight} és ${penalties.handCardWidth}×${penalties.handCardHeight}.`);
  }
}

fs.rmSync(temporaryDirectory, { recursive: true, force: true });
fs.writeFileSync(REPORT, `${JSON.stringify({ chrome, results, failures }, null, 2)}\n`);

if (failures.length) {
  console.error(`Futásidejű böngészőhibák:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('✓ Klasszikus és Büntetőpárbaj böngészős kártya-UX teszt: rendben');
}
