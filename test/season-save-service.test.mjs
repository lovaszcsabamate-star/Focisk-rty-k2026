import assert from 'node:assert/strict';
import fs from 'node:fs';

import { APP_STORAGE_KEYS } from '../js/app/configuration.js';
import { Game } from '../js/engine.js';
import {
  createSeasonSaveService,
  savedMatchMatchesSeason,
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
assert.equal(service.read().seasonId, '2025-26');
assert.equal(savedMatchMatchesSeason(raw, context), true);

const wrongSeasonService = createSeasonSaveService({
  storage,
  getContext: () => ({
    databaseId: 'hungary-nb1-2026-27',
    competitionId: 'hungary-nb1',
    seasonId: '2026-27',
  }),
});
assert.equal(wrongSeasonService.read(), null);
assert.match(wrongSeasonService.inspect().errors.join('\n'), /aktív szezon 2026-27/);

const legacy = createSavedMatchSnapshot(savePayload, () => new Date('2026-07-28T12:00:00.000Z'));
memory.set(APP_STORAGE_KEYS.savedMatch, JSON.stringify(legacy));
assert.equal(service.read()?.mode, 'classic', 'A régi, szezonmező nélküli 2025/26-os mentés folytatható marad.');
assert.equal(wrongSeasonService.read(), null, 'A régi, jelöletlen mentés más szezonban nem folytatható.');

assert.equal(service.clear(), true);
assert.equal(memory.has(APP_STORAGE_KEYS.savedMatch), false);

console.log('✓ Szezonhoz kötött mentés: v2 kompatibilitás, adatbázis- és szezonazonosító, valamint keresztidényes védelem rendben');
