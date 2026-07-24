/** Az egymásra épülő UI-, mobil- és accessibility-rétegek explicit betöltési pipeline-ja. */

import {
  beginUiEnhancementLayer,
  commitUiEnhancementLayer,
  rollbackUiEnhancementLayer,
} from '../ui.js';

export const UI_ENHANCEMENT_MODULES = Object.freeze([
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

export const UI_ENHANCEMENT_PRELOADED_FLAG = '__FOCISKARTYAK_UI_ENHANCEMENTS_PRELOADED__';

export class UiEnhancementPipelineError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'UiEnhancementPipelineError';
    this.code = code;
    this.moduleSpecifier = options.moduleSpecifier ?? null;
    this.stage = options.stage ?? null;
  }
}

const uiEnhancementDefaultImporter = specifier => import(specifier);
const uiEnhancementDefaultPreloaded = () => Boolean(globalThis[UI_ENHANCEMENT_PRELOADED_FLAG]);
const uiEnhancementDefaultMarkPreloaded = () => {
  globalThis[UI_ENHANCEMENT_PRELOADED_FLAG] = true;
};

export function createUiEnhancementPipeline({
  modules = UI_ENHANCEMENT_MODULES,
  importModule = uiEnhancementDefaultImporter,
  isPreloaded = uiEnhancementDefaultPreloaded,
  markPreloaded = uiEnhancementDefaultMarkPreloaded,
  beginLayer = beginUiEnhancementLayer,
  commitLayer = commitUiEnhancementLayer,
  rollbackLayer = rollbackUiEnhancementLayer,
} = {}) {
  if (!Array.isArray(modules) || modules.some(specifier => typeof specifier !== 'string' || !specifier.trim())) {
    throw new UiEnhancementPipelineError('INVALID_MODULE_LIST', 'Az UI enhancement modulok listája érvénytelen.');
  }
  if ([importModule, isPreloaded, markPreloaded, beginLayer, commitLayer, rollbackLayer]
    .some(adapter => typeof adapter !== 'function')) {
    throw new UiEnhancementPipelineError('INVALID_ADAPTER', 'Az UI enhancement pipeline adapterei kötelező függvények.');
  }

  const orderedModules = Object.freeze([...modules]);
  let installPromise = null;
  let installedCount = 0;

  const install = () => {
    if (isPreloaded()) return Promise.resolve(orderedModules);
    if (installPromise) return installPromise;

    installPromise = (async () => {
      while (installedCount < orderedModules.length) {
        const moduleSpecifier = orderedModules[installedCount];
        let stage = 'begin';
        let layerStarted = false;
        try {
          beginLayer(moduleSpecifier);
          layerStarted = true;
          stage = 'import';
          await importModule(moduleSpecifier);
          stage = 'commit';
          commitLayer(moduleSpecifier);
          layerStarted = false;
          installedCount += 1;
        } catch (cause) {
          if (layerStarted) rollbackLayer(moduleSpecifier);
          throw new UiEnhancementPipelineError(
            'MODULE_LOAD_FAILED',
            `Az UI enhancement modul nem telepíthető: ${moduleSpecifier}`,
            { cause, moduleSpecifier, stage },
          );
        }
      }
      markPreloaded();
      return orderedModules;
    })().catch(error => {
      installPromise = null;
      throw error;
    });

    return installPromise;
  };

  return Object.freeze({
    modules: orderedModules,
    install,
    isInstalled: () => isPreloaded(),
    installedCount: () => installedCount,
  });
}

const uiEnhancementDefaultPipeline = createUiEnhancementPipeline();

export const installUiEnhancementPipeline = () => uiEnhancementDefaultPipeline.install();
export const uiEnhancementPipeline = uiEnhancementDefaultPipeline;
