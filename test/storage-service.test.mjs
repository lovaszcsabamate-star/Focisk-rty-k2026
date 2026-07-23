import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  APP_CONFIGURATION,
  BOOLEAN_SETTING_KEYS,
  DEFAULT_EXPERIENCE_SETTINGS,
  SAVED_MATCH_VERSION,
  STORAGE_KEYS,
  STORAGE_SCHEMA_VERSION,
  settingStorageKey,
} from '../js/app/configuration.js';
import { createStorageService } from '../js/services/storage-service.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

assert.equal(STORAGE_SCHEMA_VERSION, 1);
assert.equal(SAVED_MATCH_VERSION, 2);
assert.equal(APP_CONFIGURATION.storageKeys, STORAGE_KEYS);
assert.equal(APP_CONFIGURATION.booleanSettingKeys, BOOLEAN_SETTING_KEYS);
assert.equal(APP_CONFIGURATION.defaultExperienceSettings, DEFAULT_EXPERIENCE_SETTINGS);
assert.equal(settingStorageKey('sounds'), STORAGE_KEYS.sounds ?? BOOLEAN_SETTING_KEYS.sounds);
assert.equal(settingStorageKey('custom'), 'fociskartyak:custom');
assert.equal(new Set(Object.values(STORAGE_KEYS)).size, Object.keys(STORAGE_KEYS).length);
assert.equal(new Set(Object.values(BOOLEAN_SETTING_KEYS)).size, Object.keys(BOOLEAN_SETTING_KEYS).length);

const memory = new MemoryStorage();
const storage = createStorageService(memory);
assert.equal(storage.available, true);
assert.equal(storage.readString('missing', 'fallback'), 'fallback');
assert.equal(storage.writeString('text', 42), true);
assert.equal(storage.readString('text'), '42');
assert.equal(storage.writeJson('json', { ok: true, count: 3 }), true);
assert.deepEqual(storage.readJson('json'), { ok: true, count: 3 });
memory.setItem('broken-json', '{');
assert.deepEqual(storage.readJson('broken-json', { safe: true }), { safe: true });
assert.equal(storage.writeBoolean('flag', true), true);
assert.equal(storage.readBoolean('flag', false), true);
memory.setItem('flag', 'invalid');
assert.equal(storage.readBoolean('flag', false), false);
assert.equal(storage.remove('text'), true);
assert.equal(storage.readString('text'), null);

const unavailable = createStorageService(null);
assert.equal(unavailable.available, false);
assert.equal(unavailable.readString('x', 'safe'), 'safe');
assert.equal(unavailable.writeString('x', 'y'), false);
assert.equal(unavailable.writeJson('x', {}), false);
assert.equal(unavailable.remove('x'), false);

const throwing = createStorageService({
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
  removeItem() { throw new Error('blocked'); },
});
assert.equal(throwing.readString('x', 'safe'), 'safe');
assert.equal(throwing.readJson('x', null), null);
assert.equal(throwing.writeString('x', 'y'), false);
assert.equal(throwing.remove('x'), false);

const consumers = [
  'js/deck-selection.js',
  'js/mobile-experience.js',
  'js/reliability-fixes.js',
  'js/player-profile.js',
  'js/opponents.js',
  'js/visual-settings-persistence.js',
  'js/visual-system.js',
];
const hardcodedKeys = [...Object.values(STORAGE_KEYS), ...Object.values(BOOLEAN_SETTING_KEYS)];
for (const file of consumers) {
  const source = fs.readFileSync(file, 'utf8');
  assert.match(source, /configuration\.js|storage-service\.js/, `${file}: központi modul importja hiányzik`);
  for (const key of hardcodedKeys) {
    assert.equal(source.includes(`'${key}'`) || source.includes(`"${key}"`), false, `${file}: beégetett storage-kulcs: ${key}`);
  }
}

const build = fs.readFileSync('scripts/build-standalone.mjs', 'utf8');
assert.ok(build.indexOf("'js/app/configuration.js'") < build.indexOf("'js/services/storage-service.js'"));
assert.ok(build.indexOf("'js/services/storage-service.js'") < build.indexOf("'js/deck-selection.js'"));
const sw = fs.readFileSync('sw.js', 'utf8');
assert.match(sw, /\.\/js\/app\/configuration\.js/);
assert.match(sw, /\.\/js\/services\/storage-service\.js/);

console.log('✓ Központi konfiguráció és biztonságos storage-szolgáltatás: rendben');
