import assert from 'node:assert/strict';

import {
  attachSeasonContextToPayload,
  attachSeasonContextToSnapshot,
} from '../js/database/season-service.js';

const database = Object.freeze({
  id: 'hungary-nb1-2025-26',
  name: 'Magyar NB I 2025/26',
  competitionId: 'hungary-nb1',
  competition: 'Fizz Liga (NB I)',
  seasonId: '2025-26',
  season: '2025/26',
  seasonMeta: Object.freeze({
    id: '2025-26', label: '2025/26', startYear: 2025, endYear: 2026, status: 'current', sortOrder: 20252026,
  }),
});

const source = {
  players: [
    { id: 'player-1', name: 'Első Játékos', clubName: 'Klub A' },
    { id: 'player-2', name: 'Második Játékos', clubName: 'Klub B', season: '2025/26' },
  ],
};

const payload = attachSeasonContextToPayload(source, database);
assert.equal(payload.databaseId, database.id);
assert.equal(payload.competitionId, database.competitionId);
assert.equal(payload.seasonId, database.seasonId);
assert.equal(payload.season, database.season);
assert.equal(payload.players[0].id, 'player-1', 'A forrás-játékosazonosító nem változhat meg.');
assert.equal(payload.players[0].cardId, '2025-26:player-1');
assert.equal(payload.players[1].cardId, '2025-26:player-2');
assert.equal(payload.players.every(player => player.databaseId === database.id), true);
assert.equal(payload.players.every(player => player.competitionId === database.competitionId), true);
assert.equal(payload.players.every(player => player.seasonId === database.seasonId), true);

const snapshot = attachSeasonContextToSnapshot({
  database,
  payload: source,
  playablePayload: { players: [source.players[0]] },
  players: source.players,
  playablePlayers: [source.players[0]],
  statistics: { playerCount: 2 },
});
assert.equal(snapshot.players[0].cardId, '2025-26:player-1');
assert.equal(snapshot.playablePlayers[0].cardId, '2025-26:player-1');
assert.equal(snapshot.statistics.seasonId, '2025-26');
assert.equal(snapshot.statistics.competitionId, 'hungary-nb1');
assert.equal(snapshot.statistics.seasonMeta.status, 'current');

const future = attachSeasonContextToPayload(source, {
  ...database,
  id: 'hungary-nb1-2026-27',
  seasonId: '2026-27',
  season: '2026/27',
});
assert.equal(future.players[0].id, payload.players[0].id);
assert.notEqual(future.players[0].cardId, payload.players[0].cardId);
assert.equal(future.players[0].cardId, '2026-27:player-1');

console.log('✓ Szezonközpontú adatbetöltés: a forrásazonosító stabil, a kártya- és statisztikai kontextus szezononként elkülönül');
