import assert from 'node:assert/strict';

import { APP_STORAGE_KEYS } from '../js/app/configuration.js';
import { createDeckSelectionStorageService } from '../js/services/deck-selection-storage-service.js';

const values = new Map([
  [APP_STORAGE_KEYS.savedMatch, '{"version":2,"mode":"classic"}'],
  [APP_STORAGE_KEYS.deckSelection, JSON.stringify({ kind: 'random', value: null })],
]);
let failSelectionWrite = true;
const storage = {
  readJson(key, fallback = null) {
    if (!values.has(key)) return fallback;
    try { return JSON.parse(values.get(key)); } catch { return fallback; }
  },
  readString(key, fallback = null) {
    return values.has(key) ? values.get(key) : fallback;
  },
  writeString(key, value) {
    values.set(key, String(value));
    return true;
  },
  writeJson(key, value) {
    if (key === APP_STORAGE_KEYS.deckSelection && failSelectionWrite) {
      failSelectionWrite = false;
      return false;
    }
    values.set(key, JSON.stringify(value));
    return true;
  },
  remove(key) {
    values.delete(key);
    return true;
  },
};

const service = createDeckSelectionStorageService({ storage });
const originalSave = values.get(APP_STORAGE_KEYS.savedMatch);
const failed = service.replace({ kind: 'club', value: 'Teszt FC' });
assert.equal(failed.saved, false);
assert.equal(
  values.get(APP_STORAGE_KEYS.savedMatch),
  originalSave,
  'sikertelen pakliválasztás után a korábbi mérkőzésmentésnek vissza kell állnia',
);

const succeeded = service.replace({ kind: 'club', value: 'Teszt FC' });
assert.equal(succeeded.saved, true);
assert.equal(values.has(APP_STORAGE_KEYS.savedMatch), false);
assert.deepEqual(JSON.parse(values.get(APP_STORAGE_KEYS.deckSelection)), {
  kind: 'club',
  value: 'Teszt FC',
});

console.log('✓ Pakliválasztás cseréje: sikertelen írásnál a korábbi mentés visszaáll');
