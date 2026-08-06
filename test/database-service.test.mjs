import assert from 'node:assert/strict';

import {
  createDatabaseService,
} from '../js/database/database-service.js';

const database = Object.freeze({
  schemaVersion: 1,
  id: 'test-league-2025-26',
  name: 'Tesztliga 2025/26',
  competition: 'Tesztliga',
  country: 'Magyarország',
  season: '2025/26',
  version: '1.0.0',
  minimumPlayers: 2,
  supportedModes: ['classic', 'penalties'],
  supportedDeckSelections: ['random', 'club', 'nation'],
  normalization: { playerModelVersion: 1 },
  files: {
    normalizedPlayers: 'normalized.json',
    players: 'legacy.json',
    clubDirectory: 'clubs.json',
    enrichments: [],
    corrections: [],
    statPatches: [],
  },
});

const makePlayer = index => {
  const firstClub = index < 7;
  const hungarian = index < 11;
  const partialOptionalData = index === 0;
  return {
    id: `player-${index + 1}`,
    name: `Teszt Játékos ${index + 1}`,
    displayName: `Játékos ${index + 1}`,
    club: firstClub ? 'Klub A' : 'Klub B',
    clubName: firstClub ? 'Klub A' : 'Klub B',
    clubId: firstClub ? 'club-a' : 'club-b',
    nation: hungarian ? 'HUN' : 'SRB',
    nationality: hungarian ? 'HUN' : 'SRB',
    nationalityCode: hungarian ? 'HUN' : 'SRB',
    position: partialOptionalData ? '' : (index % 4 === 0 ? 'Kapus' : 'Középpályás'),
    birthDate: partialOptionalData ? null : `199${index % 10}-01-01`,
    dateOfBirth: partialOptionalData ? null : `199${index % 10}-01-01`,
    stats: {
      appearances: partialOptionalData ? null : 10 + index,
      starts: partialOptionalData ? null : 5 + index,
      goals: partialOptionalData ? null : index,
      squads: partialOptionalData ? null : 12 + index,
      yellowCards: partialOptionalData ? null : index % 4,
      redCards: partialOptionalData ? null : 0,
      totalDismissals: partialOptionalData ? null : 0,
    },
  };
};

const players = Array.from({ length: 12 }, (_, index) => makePlayer(index));
const normalizedPayload = {
  schemaVersion: 1,
  databaseId: database.id,
  season: database.season,
  competition: database.competition,
  playerModel: { version: 1, validation: { errorCount: 0 } },
  players,
};
const legacyPayload = {
  schemaVersion: 1,
  season: database.season,
  competition: database.competition,
  players,
};
const clubDirectory = {
  schemaVersion: 1,
  clubs: [
    { clubId: 'club-a', clubName: 'Klub A', officialUrl: 'https://example.test/a' },
    { clubId: 'club-b', clubName: 'Klub B', officialUrl: 'https://example.test/b' },
  ],
};

const registryDependencies = {
  listDatabases: async () => [database],
  findDatabase: async id => (id === database.id ? database : null),
  findDefaultDatabase: async () => database,
};

const fetchCounts = new Map();
const fetchJson = async url => {
  fetchCounts.set(url, (fetchCounts.get(url) ?? 0) + 1);
  if (url === 'normalized.json') return normalizedPayload;
  if (url === 'legacy.json') return legacyPayload;
  if (url === 'clubs.json') return clubDirectory;
  throw new Error(`Ismeretlen tesztfájl: ${url}`);
};

const service = createDatabaseService({
  ...registryDependencies,
  fetchJson,
  logger: { warn() {} },
});

const databases = await service.getAvailableDatabases();
assert.equal(databases.length, 1);
assert.equal(databases[0].id, database.id);
assert.equal((await service.getDatabaseById(database.id)).name, database.name);
assert.equal(await service.getDatabaseById('missing'), null);

const firstLoad = await service.loadDatabase();
const secondLoad = await service.loadDatabase(database.id);
assert.strictEqual(firstLoad, secondLoad, 'Az adatbázisnak csak egyszer kell betöltődnie.');
assert.equal(firstLoad.source, 'normalized');
assert.equal(firstLoad.players.length, 12);
assert.equal(firstLoad.playablePlayers.length, 12, 'az opcionális statisztika hiánya nem zárhat ki valós játékost');
assert.equal(firstLoad.playablePlayers[0].goals, null);
assert.equal(firstLoad.playablePlayers[0].dateOfBirth, null);
assert.equal(firstLoad.playablePayload.selection.incompleteButPlayableCards, 1);
assert.equal(firstLoad.playablePayload.selection.excludedUnplayableCards, 0);
assert.equal(firstLoad.validation.summary.valid, true);
assert.equal(fetchCounts.get('normalized.json'), 1);
assert.equal(fetchCounts.get('clubs.json'), 1);

assert.equal((await service.getAllPlayers(database.id)).length, 12);
assert.equal((await service.getAllPlayers(database.id, { playable: true })).length, 12);
assert.equal((await service.getAllClubs(database.id)).length, 2);
assert.equal((await service.getPlayersByClub(database.id, 'club-a')).length, 7);
assert.equal((await service.getPlayersByClub(database.id, 'Klub B')).length, 5);
assert.equal((await service.getPlayersByNationality(database.id, 'HUN')).length, 11);
assert.equal((await service.getPlayersByNationality(database.id, 'SRB')).length, 1);

const eligibleNationalities = await service.getEligibleNationalities(database.id, 11);
assert.deepEqual(eligibleNationalities, [{ code: 'HUN', name: 'HUN', count: 11 }]);
const eligibleTeams = await service.getEligibleTeams(database.id, 5);
assert.deepEqual(eligibleTeams.map(team => [team.id, team.count]), [
  ['club-a', 7],
  ['club-b', 5],
]);

const statistics = await service.getDatabaseStatistics(database.id);
assert.equal(statistics.playerCount, 12);
assert.equal(statistics.playablePlayerCount, 12);
assert.equal(statistics.excludedPlayerCount, 0);
assert.equal(statistics.clubCount, 2);
assert.equal(statistics.nationalityCount, 2);
assert.equal(statistics.source, 'normalized');
assert.equal((await service.normalizeDatabase(database.id)).players.length, 12);
assert.equal((await service.validateDatabase(database.id)).summary.valid, true);

service.clearCache(database.id);
await service.loadDatabase(database.id);
assert.equal(fetchCounts.get('normalized.json'), 2);
assert.equal(fetchCounts.get('clubs.json'), 2);

const warnings = [];
const fallbackService = createDatabaseService({
  ...registryDependencies,
  fetchJson: async url => {
    if (url === 'normalized.json') throw new Error('szándékos sérülés');
    if (url === 'legacy.json') return legacyPayload;
    if (url === 'clubs.json') return clubDirectory;
    throw new Error(`Ismeretlen tesztfájl: ${url}`);
  },
  logger: { warn: message => warnings.push(message) },
});
const fallback = await fallbackService.loadDatabase(database.id);
assert.equal(fallback.source, 'legacy-fallback');
assert.equal(fallback.players.length, 12);
assert.equal(fallback.playablePlayers.length, 12);
assert.equal(warnings.some(message => /Visszaállás a régi forrásrétegekre/.test(message)), true);

await assert.rejects(
  () => service.loadDatabase('missing'),
  /Ismeretlen vagy letiltott adatbázis/,
);

console.log('✓ Központi adatbázis-szolgáltatás: cache, fallback, részleges opcionális adatok, klub- és nemzetiségi szűrés, validáció és statisztika rendben');
