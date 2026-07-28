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
  '../category-picker.js',
  '../player-profile.js',
  '../reliability-fixes.js',
  '../usability-fixes.js',
  '../focus-experience.js',
  '../visual-settings-persistence.js',
  '../visual-system.js',
  '../visual-hierarchy.js',
  '../gameplay-experience.js',
  '../legal-ui.js',
]);
assert.equal(UI_ENHANCEMENT_PRELOADED_FLAG, '__FOCISKARTYAK_UI_ENHANCEMENTS_PRELOADED__');

const loaded = [];
const layerEvents = [];
let preloaded = false;
let marked = 0;
const pipeline = createUiEnhancementPipeline({
  modules: ['first.js', 'second.js', 'third.js'],
  importModule: async specifier => { loaded.push(specifier); },
  isPreloaded: () => preloaded,
  markPreloaded: () => { preloaded = true; marked += 1; },
  beginLayer: specifier => { layerEvents.push(`begin:${specifier}`); },
  commitLayer: specifier => { layerEvents.push(`commit:${specifier}`); },
  rollbackLayer: specifier => { layerEvents.push(`rollback:${specifier}`); },
});

assert.equal(Object.isFrozen(pipeline), true);
assert.equal(Object.isFrozen(pipeline.modules), true);
assert.equal(pipeline.isInstalled(), false);
assert.equal(pipeline.installedCount(), 0);
const firstInstall = pipeline.install();
const secondInstall = pipeline.install();
assert.equal(firstInstall, secondInstall, 'a párhuzamos telepítési kérés ugyanazt a Promise-t kapja');
assert.deepEqual(await firstInstall, ['first.js', 'second.js', 'third.js']);
assert.deepEqual(loaded, ['first.js', 'second.js', 'third.js']);
assert.deepEqual(layerEvents, [
  'begin:first.js', 'commit:first.js',
  'begin:second.js', 'commit:second.js',
  'begin:third.js', 'commit:third.js',
]);
assert.equal(pipeline.installedCount(), 3);
assert.equal(marked, 1);
assert.equal(pipeline.isInstalled(), true);
assert.deepEqual(await pipeline.install(), ['first.js', 'second.js', 'third.js']);
assert.deepEqual(loaded, ['first.js', 'second.js', 'third.js'], 'a pipeline másodszor nem importálhat');

let attempts = 0;
const retryEvents = [];
const retryPipeline = createUiEnhancementPipeline({
  modules: ['broken.js'],
  importModule: async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('teszthiba');
  },
  isPreloaded: () => false,
  markPreloaded: () => {},
  beginLayer: specifier => { retryEvents.push(`begin:${specifier}`); },
  commitLayer: specifier => { retryEvents.push(`commit:${specifier}`); },
  rollbackLayer: specifier => { retryEvents.push(`rollback:${specifier}`); },
});
await assert.rejects(
  retryPipeline.install(),
  error => error instanceof UiEnhancementPipelineError
    && error.code === 'MODULE_LOAD_FAILED'
    && error.moduleSpecifier === 'broken.js'
    && error.stage === 'import',
);
assert.equal(retryPipeline.installedCount(), 0);
await retryPipeline.install();
assert.equal(attempts, 2, 'hiba után csak a sikertelen modul indul újra');
assert.equal(retryPipeline.installedCount(), 1);
assert.deepEqual(retryEvents, [
  'begin:broken.js', 'rollback:broken.js',
  'begin:broken.js', 'commit:broken.js',
]);

const preloadedEvents = [];
const preloadedPipeline = createUiEnhancementPipeline({
  modules: ['embedded.js'],
  importModule: async specifier => { preloadedEvents.push(`import:${specifier}`); },
  isPreloaded: () => true,
  markPreloaded: () => { preloadedEvents.push('mark'); },
  beginLayer: specifier => { preloadedEvents.push(`begin:${specifier}`); },
  commitLayer: specifier => { preloadedEvents.push(`commit:${specifier}`); },
  rollbackLayer: specifier => { preloadedEvents.push(`rollback:${specifier}`); },
});
assert.deepEqual(await preloadedPipeline.install(), ['embedded.js']);
assert.deepEqual(preloadedEvents, [], 'a standalone build saját rétegezése után a pipeline nem fut újra');

assert.throws(
  () => createUiEnhancementPipeline({ modules: [''] }),
  error => error instanceof UiEnhancementPipelineError && error.code === 'INVALID_MODULE_LIST',
);
assert.throws(
  () => createUiEnhancementPipeline({ importModule: null }),
  error => error instanceof UiEnhancementPipelineError && error.code === 'INVALID_ADAPTER',
);
assert.throws(
  () => createUiEnhancementPipeline({ beginLayer: null }),
  error => error instanceof UiEnhancementPipelineError && error.code === 'INVALID_ADAPTER',
);

const pipelineSource = readSource('../js/ui/ui-enhancement-pipeline.js');
const categoryPickerSource = readSource('../js/category-picker.js');
const categoryPickerCss = readSource('../css/category-picker.css');
const hierarchySource = readSource('../js/visual-hierarchy.js');
const hierarchyCss = readSource('../css/visual-hierarchy.css');
const gameplaySource = readSource('../js/gameplay-experience.js');
const uiSource = readSource('../js/ui.js');
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
  'ux.js', 'ux-fixes.js', 'matchday.js', 'opponents.js', 'category-picker.js', 'player-profile.js',
  'reliability-fixes.js', 'usability-fixes.js', 'focus-experience.js', 'gameplay-experience.js',
  'visual-settings-persistence.js', 'visual-system.js', 'visual-hierarchy.js', 'legal-ui.js',
]) {
  assert.doesNotMatch(indexSource, new RegExp(`<script type="module" src="js/${file.replaceAll('.', '\\.')}\"></script>`));
}
assert.match(indexSource, /css\/visual-hierarchy\.css/);
assert.match(indexSource, /css\/category-picker\.css/);
assert.match(indexSource, /js\/branding\.js/);
assert.match(indexSource, /js\/pwa\.js/);
assert.match(indexSource, /js\/bootstrap\.js/);
assert.doesNotMatch(indexSource, /js\/ui\/ui-enhancement-pipeline\.js/, 'a pipeline-t a bootstrap importálja és várja meg');

assert.ok(
  buildSource.indexOf("'js/mobile-experience.js'")
    < buildSource.indexOf("'js/category-picker.js'"),
  'a kategóriaválasztó a mobilos kategóriagombokra épül',
);
assert.ok(
  buildSource.indexOf("'js/category-picker.js'")
    < buildSource.indexOf("'js/player-profile.js'"),
  'a kategóriaválasztó még a további kártyarétegek előtt települ',
);
assert.ok(
  buildSource.indexOf("'js/visual-system.js'")
    < buildSource.indexOf("'js/visual-hierarchy.js'"),
  'a vizuális hierarchia az alap vizuális rendszerre épül',
);
assert.ok(
  buildSource.indexOf("'js/visual-hierarchy.js'")
    < buildSource.indexOf("'js/gameplay-experience.js'"),
  'a játékélmény réteg a végleges fázishierarchiára épül',
);
assert.ok(
  buildSource.indexOf("'js/gameplay-experience.js'")
    < buildSource.indexOf("'js/legal-ui.js'"),
  'a jogi felület a játékélmény réteg után marad',
);
assert.ok(
  buildSource.indexOf("'js/legal-ui.js'")
    < buildSource.indexOf("'js/ui/ui-enhancement-pipeline.js'"),
  'a standalone buildben a rétegezett enhancement modulok előbb futnak le',
);
assert.ok(
  buildSource.indexOf("'js/ui/ui-enhancement-pipeline.js'")
    < buildSource.indexOf("'js/main.js'"),
  'a standalone pipeline marker a Session előtt szerepel',
);
assert.match(buildSource, /const uiEnhancementFiles = new Set/);
assert.match(buildSource, /beginUiEnhancementLayer\(\$\{layerName\}\)/);
assert.match(buildSource, /commitUiEnhancementLayer\(\$\{layerName\}\)/);
assert.match(buildSource, /__FOCISKARTYAK_UI_ENHANCEMENTS_PRELOADED__/);
assert.match(serviceWorkerSource, /\.\/js\/visual-hierarchy\.js/);
assert.match(serviceWorkerSource, /\.\/js\/category-picker\.js/);
assert.match(serviceWorkerSource, /\.\/js\/gameplay-experience\.js/);
assert.match(serviceWorkerSource, /const PWA_CACHE = 'fociskartyak-2026-v\d+';/);
assert.match(pipelineSource, /beginLayer\(moduleSpecifier\)/);
assert.match(pipelineSource, /commitLayer\(moduleSpecifier\)/);
assert.match(pipelineSource, /rollbackLayer\(moduleSpecifier\)/);
assert.doesNotMatch(pipelineSource, /UI\.prototype/);
assert.match(uiSource, /class UIBase/);
assert.match(uiSource, /export let UI = UIBase/);
assert.match(uiSource, /class extends ParentUI/);

assert.match(categoryPickerSource, /category-grid/);
assert.match(categoryPickerSource, /minden regisztrált összehasonlítási kategória/i);
assert.match(categoryPickerSource, /kategória látható/);
assert.match(categoryPickerSource, /aria-pressed/);
assert.match(categoryPickerCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(categoryPickerCss, /touch-action: pan-y/);
assert.doesNotMatch(categoryPickerCss, /grid-auto-columns:\s*min\(/);

assert.match(hierarchySource, /match-context/);
assert.match(hierarchySource, /next-action-panel/);
assert.match(hierarchySource, /bindContinueActionProxy/);
assert.match(hierarchySource, /dataset\.continueProxy/);
assert.match(hierarchySource, /Koppints erre a panelre/);
assert.match(hierarchyCss, /\.match-context/);
assert.match(hierarchyCss, /\.next-action-panel/);
assert.match(hierarchyCss, /#attribute-picker \.next-round-button/);

assert.match(gameplaySource, /Automatikus továbblépés/);
assert.match(gameplaySource, /Napi kihívás/);
assert.match(gameplaySource, /Meccsösszefoglaló/);
assert.match(gameplaySource, /Új ellenfél/);
assert.match(gameplaySource, /Hajszálon múlt/);
assert.match(gameplaySource, /győzelem sorban/);
assert.match(gameplaySource, /megismert játékos/);
assert.match(gameplaySource, /experience-category-history/);
assert.match(gameplaySource, /gameplayExperienceMaybeScheduleAutoAdvance/);
assert.match(gameplaySource, /navigator\.vibrate/);

console.log('✓ Stabil kategóriaválasztás, kattintható folytatás és teljes játékélmény-csomag: rendben');
