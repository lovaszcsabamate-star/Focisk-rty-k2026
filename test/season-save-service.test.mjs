import assert from 'node:assert/strict';
import fs from 'node:fs';

import { APP_STORAGE_KEYS } from '../js/app/configuration.js';
import { Game } from '../js/engine.js';
import {
  createSeasonSaveService,
  savedMatchMatchesSeason,
  SEASON_SAVE_STATUS,
} from '../js/services/season-save-service.js';
import { createSavedMatchSnapshot } from '../js/services/save-service.js';
import { createStorageService } from '../js/services/storage-service.js';

const payload = JSON.parse(fs.readFileSync(
  new URL('../data/databases/hungary-nb1-2025-26/players.normalized.json', import.meta.url),
  'utf8',
));
const players = payload.players;
const rng = () => 0.314159;
const context = Object.freeze({
  databaseId: 'hungary-nb1-2025-26',
  competitionId: 'hungary-nb1',
  seasonId: '2025-26',
});

const memory = new Map();
const storage = createStorageService({
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
});
const service = createSeasonSaveService({
  storage,
  now: () => new Date('2026-07-28T12:00:00.000Z'),
  getContext: () => context,
});

const game = new Game({ players, rng });
const savePayload = {
  game,
  mode: 'classic',
  difficulty: 'medium',
  pendingAttribute: null,
  awaitingChooserCard: false,
  uxStats: { rounds: 0 },
};

assert.equal(service.write(savePayload), true);
const raw = JSON.parse(memory.get(APP_STORAGE_KEYS.savedMatch));
assert.equal(raw.version, 2, 'A meglévő játékmenet-mentési séma nem változhat.');
assert.equal(raw.databaseId, context.databaseId);
assert.equal(raw.competitionId, context.competitionId);
assert.equal(raw.seasonId, context.seasonId);
assert.ok(
  raw.game.players.every(card => Object.keys(card).length === 1 && typeof card.id === 'string'),
  'a Klasszikus mentés állandó játékoslistája csak kártyahivatkozásokat tartalmazhat',
);
assert.equal(service.read().seasonId, '2025-26');
assert.equal(service.inspect().code, SEASON_SAVE_STATUS.OK);
assert.equal(service.inspect().hasStoredValue, true);
assert.equal(savedMatchMatchesSeason(raw, context), true);

const quotaMemory = new Map();
const quotaStorage = createStorageService({
  getItem: key => quotaMemory.has(key) ? quotaMemory.get(key) : null,
  setItem: (key, value) => {
    const text = String(value);
    if (text.length > 300_000) throw new Error('QuotaExceededError');
    quotaMemory.set(key, text);
  },
  removeItem: key => quotaMemory.delete(key),
});
const quotaService = createSeasonSaveService({
  storage: quotaStorage,
  now: () => new Date('2026-07-28T12:00:00.000Z'),
  getContext: () => context,
});
assert.equal(
  quotaService.write(savePayload),
  true,
  'a normalizált Klasszikus mentésnek a mobil WebView szűkebb tárhelykeretébe is bele kell férnie',
);
assert.ok(
  quotaMemory.get(APP_STORAGE_KEYS.savedMatch).length < 300_000,
  'a teljes játékoskártyák nem ismétlődhetnek a mentés állandó játékoslistájában',
);

const wrongSeasonService = createSeasonSaveService({
  storage,
  getContext: () => ({
    databaseId: 'hungary-nb1-2025-26',
    competitionId: 'hungary-nb1',
    seasonId: '2026-27',
  }),
});
assert.equal(wrongSeasonService.read(), null);
assert.equal(wrongSeasonService.inspect().code, SEASON_SAVE_STATUS.SEASON_MISMATCH);
assert.equal(wrongSeasonService.inspect().hasStoredValue, true);
assert.match(wrongSeasonService.inspect().errors.join('\n'), /aktív szezon 2026-27/);
assert.equal(memory.has(APP_STORAGE_KEYS.savedMatch), true, 'Az inkompatibilis mentés nem törlődhet automatikusan.');

const wrongDatabaseService = createSeasonSaveService({
  storage,
  getContext: () => ({
    databaseId: 'hungary-nb2-2025-26',
    competitionId: 'hungary-nb2',
    seasonId: '2025-26',
  }),
});
assert.equal(wrongDatabaseService.inspect().code, SEASON_SAVE_STATUS.DATABASE_MISMATCH);
assert.equal(memory.has(APP_STORAGE_KEYS.savedMatch), true, 'A másik adatbázishoz tartozó mentés sem törlődhet automatikusan.');

memory.set(APP_STORAGE_KEYS.savedMatch, '{hibás-json');
const invalidJson = service.inspect();
assert.equal(invalidJson.ok, false);
assert.equal(invalidJson.code, SEASON_SAVE_STATUS.INVALID_JSON);
assert.equal(invalidJson.hasStoredValue, true);
assert.equal(service.read(), null);
assert.equal(memory.has(APP_STORAGE_KEYS.savedMatch), true, 'A sérült JSON csak felhasználói döntésre törölhető.');

memory.set(APP_STORAGE_KEYS.savedMatch, JSON.stringify({ ...raw, version: 999 }));
const unsupported = service.inspect();
assert.equal(unsupported.ok, false);
assert.equal(unsupported.code, SEASON_SAVE_STATUS.UNSUPPORTED_VERSION);
assert.equal(memory.has(APP_STORAGE_KEYS.savedMatch), true);

const legacy = createSavedMatchSnapshot(savePayload, () => new Date('2026-07-28T12:00:00.000Z'));
memory.set(APP_STORAGE_KEYS.savedMatch, JSON.stringify(legacy));
assert.equal(service.read()?.mode, 'classic', 'A régi, szezonmező nélküli 2025/26-os mentés folytatható marad.');
assert.equal(wrongSeasonService.read(), null, 'A régi, jelöletlen mentés más szezonban nem folytatható.');

assert.equal(service.clear(), true);
assert.equal(memory.has(APP_STORAGE_KEYS.savedMatch), false);
const empty = service.inspect();
assert.equal(empty.ok, true);
assert.equal(empty.code, SEASON_SAVE_STATUS.NO_SAVE);
assert.equal(empty.hasStoredValue, false);

console.log('✓ Szezonhoz kötött mentés: v2 kompatibilitás, diagnosztika, adatbázis- és szezonvédelem, valamint nem destruktív hibakezelés rendben');
