import { STORAGE_KEYS } from './app/configuration.js';
import { readStoredJson, removeStoredValue, writeStoredJson } from './services/storage-service.js';

(() => {
  const STORAGE_KEY = STORAGE_KEYS.visualSettings;
  const SIZING_BACKUP_KEY = STORAGE_KEYS.visualSizingBackup;
  const SIZING_FIELDS = Object.freeze([
    { key: 'selectionCardWidth', min: 150, max: 280 },
    { key: 'battleCardWidth', min: 220, max: 420 },
    { key: 'cardGap', min: 6, max: 36 },
    { key: 'battlefieldHeight', min: 320, max: 680 },
  ]);

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));

  const readJson = key => readStoredJson(key, null);
  const writeJson = (key, value) => writeStoredJson(key, value);

  function normaliseSizing(source = {}) {
    const sizing = {};
    for (const field of SIZING_FIELDS) {
      const value = Number(source[field.key]);
      if (!Number.isFinite(value)) continue;
      sizing[field.key] = clamp(value, field.min, field.max);
    }
    return sizing;
  }

  function restoreExplicitSizing() {
    const saved = readJson(SIZING_BACKUP_KEY);
    if (!saved) return;
    const sizing = normaliseSizing(saved);
    if (!Object.keys(sizing).length) return;
    const current = readJson(STORAGE_KEY) || {};
    writeJson(STORAGE_KEY, { ...current, ...sizing });
  }

  // This file is loaded before visual-system.js, so the last explicitly saved
  // dimensions are restored before the visual system reads its settings.
  restoreExplicitSizing();

  function collectSizing() {
    const current = readJson(STORAGE_KEY) || {};
    const sizing = {};
    for (const field of SIZING_FIELDS) {
      const input = document.querySelector(`#appearance-${field.key}`);
      const candidate = input instanceof HTMLInputElement ? Number(input.value) : Number(current[field.key]);
      if (!Number.isFinite(candidate)) continue;
      sizing[field.key] = clamp(candidate, field.min, field.max);
    }
    return sizing;
  }

  function setStatus(node, text, state = '') {
    if (!node) return;
    node.textContent = text;
    node.dataset.state = state;
  }

  function saveSizing(status) {
    const sizing = collectSizing();
    if (Object.keys(sizing).length !== SIZING_FIELDS.length) {
      setStatus(status, 'A méretezés nem menthető: hiányzó beállítás.', 'error');
      return;
    }

    const current = readJson(STORAGE_KEY) || {};
    const savedAt = new Date().toISOString();
    const mainSaved = writeJson(STORAGE_KEY, { ...current, ...sizing });
    const backupSaved = writeJson(SIZING_BACKUP_KEY, { version: 1, savedAt, ...sizing });

    if (!mainSaved || !backupSaved) {
      setStatus(status, 'A böngésző nem engedte a beállítások mentését.', 'error');
      return;
    }

    document.documentElement.dataset.visualSizingSaved = 'true';
    setStatus(status, '✓ Méretezés elmentve. Újraindítás után is megmarad.', 'saved');
  }

  function ensureSaveControls() {
    const dialog = document.querySelector('#appearance-dialog');
    const body = dialog?.querySelector('.appearance-dialog__body');
    const actions = dialog?.querySelector('.appearance-actions');
    if (!dialog || !body || !actions || dialog.querySelector('[data-save-sizing]')) return;

    const status = document.createElement('p');
    status.className = 'appearance-save-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'A módosítások előnézetben azonnal látszanak.';

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'primary appearance-save-button';
    save.dataset.saveSizing = 'true';
    save.textContent = '💾 Méretezés mentése';
    save.addEventListener('click', () => saveSizing(status));

    for (const field of SIZING_FIELDS) {
      const input = dialog.querySelector(`#appearance-${field.key}`);
      input?.addEventListener('input', () => {
        document.documentElement.dataset.visualSizingSaved = 'false';
        setStatus(status, 'Módosítva — a véglegesítéshez nyomd meg a „Méretezés mentése” gombot.', 'dirty');
      });
    }

    const reset = [...actions.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'Alapértékek');
    if (reset && reset.dataset.sizingResetWired !== 'true') {
      reset.dataset.sizingResetWired = 'true';
      reset.addEventListener('click', () => {
        removeStoredValue(SIZING_BACKUP_KEY);
      });
    }

    body.insertBefore(status, actions);
    actions.appendChild(save);
  }

  function initialise() {
    ensureSaveControls();
    const observer = new MutationObserver(ensureSaveControls);
    observer.observe(document.body, { childList: true, subtree: true });
    document.documentElement.dataset.sizingPersistence = 'ready';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialise, { once: true });
  } else {
    initialise();
  }
})();
