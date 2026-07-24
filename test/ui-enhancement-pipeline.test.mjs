import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  UI_ENHANCEMENT_MODULES,
  UI_ENHANCEMENT_PRELOADED_FLAG,
  UiEnhancementPipelineError,
  createUiEnhancementPipeline,
} from '../js/ui/ui-enhancement-pipeline.js';

const readSource = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

assert.deepEqual(UI_ENHANCEMENT_MODULES, [
  '../ux.js',
  '../ux-fixes.js',
  '../matchday.js',
  '../opponents.js',
  '../mobile-experience.js',
  '../player-profile.js',
  '../reliability-fixes.js',
  '../usability-fixes.js',
  '../focus-experience.js',
  '../visual-settings-persistence.js',
  '../visual-system.js',
  '../legal-ui.js',
]);
assert.equal(UI_ENHANCEMENT_PRELOADED_FLAG, '__FOCISKARTYAK_UI_ENHANCEMENTS_PRELOADED__');

const loaded = [];
let preloaded = false;
let marked = 0;
const pipeline = createUiEnhancementPipeline({
  modules: ['first.js', 'second.js', 'third.js'],
  importModule: async specifier => { loaded.push(specifier); },
  isPreloaded: () => preloaded,
  markPreloaded: () => { preloaded = true; marked += 1; },
});

assert.equal(Object.isFrozen(pipeline), true);
assert.equal(Object.isFrozen(pipeline.modules), true);
assert.equal(pipeline.isInstalled(), false);
const firstInstall = pipeline.install();
const secondInstall = pipeline.install();
assert.equal(firstInstall, secondInstall, 'a párhuzamos telepítési kérés ugyanazt a Promise-t kapja');
assert.deepEqual(await firstInstall, ['first.js', 'second.js', 'third.js']);
assert.deepEqual(loaded, ['first.js', 'second.js', 'third.js']);
assert.equal(marked, 1);
assert.equal(pipeline.isInstalled(), true);
assert.deepEqual(await pipeline.install(), ['first.js', 'second.js', 'third.js']);
assert.deepEqual(loaded, ['first.js', 'second.js', 'third.js'], 'a pipeline másodszor nem importálhat');

let attempts = 0;
const retryPipeline = createUiEnhancementPipeline({
  modules: ['broken.js'],
  importModule: async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('teszthiba');
  },
  isPreloaded: () => false,
  markPreloaded: () => {},
});
await assert.rejects(
  retryPipeline.install(),
  error => error instanceof UiEnhancementPipelineError
    && error.code === 'MODULE_LOAD_FAILED'
    && error.moduleSpecifier === 'broken.js',
);
await retryPipeline.install();
assert.equal(attempts, 2, 'hiba után újraindítható a pipeline');

assert.throws(
  () => createUiEnhancementPipeline({ modules: [''] }),
  error => error instanceof UiEnhancementPipelineError && error.code === 'INVALID_MODULE_LIST',
);
assert.throws(
  () => createUiEnhancementPipeline({ importModule: null }),
  error => error instanceof UiEnhancementPipelineError && error.code === 'INVALID_ADAPTER',
);

const pipelineSource = readSource('../js/ui/ui-enhancement-pipeline.js');
const bootstrapSource = readSource('../js/bootstrap.js');
const indexSource = readSource('../index.html');
const buildSource = readSource('../scripts/build-standalone.mjs');
const serviceWorkerSource = readSource('../sw.js');

assert.match(bootstrapSource, /\.\/ui\/ui-enhancement-pipeline\.js/);
assert.ok(
  bootstrapSource.indexOf('await installUiEnhancementPipeline()')
    < bootstrapSource.indexOf('await loadDatabase()'),
  'az UI enhancement pipeline az adatbetöltés és a Session előtt fut',
);
for (const file of [
  'ux.js', 'ux-fixes.js', 'matchday.js', 'opponents.js', 'player-profile.js',
  'reliability-fixes.js', 'usability-fixes.js', 'focus-experience.js',
  'visual-settings-persistence.js', 'visual-system.js', 'legal-ui.js',
]) {
  assert.doesNotMatch(indexSource, new RegExp(`<script type="module" src="js/${file.replaceAll('.', '\\.')}"></script>`));
}
assert.match(indexSource, /js\/branding\.js/);
assert.match(indexSource, /js\/pwa\.js/);
assert.match(indexSource, /js\/bootstrap\.js/);
assert.doesNotMatch(indexSource, /js\/ui\/ui-enhancement-pipeline\.js/, 'a pipeline-t a bootstrap importálja és várja meg');

assert.ok(
  buildSource.indexOf("'js/legal-ui.js'")
    < buildSource.indexOf("'js/ui/ui-enhancement-pipeline.js'"),
  'a standalone buildben a régi enhancement modulok előbb futnak le',
);
assert.ok(
  buildSource.indexOf("'js/ui/ui-enhancement-pipeline.js'")
    < buildSource.indexOf("'js/main.js'"),
  'a standalone pipeline marker a Session előtt szerepel',
);
assert.match(buildSource, /__FOCISKARTYAK_UI_ENHANCEMENTS_PRELOADED__/);
assert.match(serviceWorkerSource, /\.\/js\/ui\/ui-enhancement-pipeline\.js/);
assert.match(serviceWorkerSource, /fociskartyak-2026-v67/);
assert.match(pipelineSource, /for \(const moduleSpecifier of orderedModules\)/);
assert.doesNotMatch(pipelineSource, /UI\.prototype/);

console.log('✓ Explicit, idempotens és standalone-kompatibilis UI enhancement pipeline: rendben');
