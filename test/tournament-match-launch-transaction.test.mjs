import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStorageService } from '../js/services/storage-service.js';
import { createTournamentStorageService } from '../js/services/tournament-storage-service.js';
import {
  TOURNAMENT_CATEGORY,
  TOURNAMENT_FORMAT,
  TOURNAMENT_MATCH_MODE,
  createTournament,
  tournamentMatches,
} from '../js/tournament/tournament-domain.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(String(key)); }
}

const teams = ['eto', 'dvtk', 'paks', 'pafc'].map((id, index) => ({
  id,
  label: id === 'eto' ? 'ETO FC' : id === 'dvtk' ? 'DVTK' : id === 'paks' ? 'Paksi FC' : 'Puskás Akadémia FC',
  kind: 'club',
  selection: { kind: 'club', value: id },
  count: 30 + index,
}));

const initial = createTournament({
  name: 'Android real-device launch regression',
  category: TOURNAMENT_CATEGORY.HUNGARIAN,
  format: TOURNAMENT_FORMAT.LEAGUE,
  matchMode: TOURNAMENT_MATCH_MODE.CLASSIC,
  participants: teams,
  humanTeamId: 'eto',
  difficulty: 'medium',
  rng: () => 0,
});

const humanMatch = tournamentMatches(initial).find(match => [match.homeId, match.awayId].includes('eto'));
assert.ok(humanMatch, 'A teszttornának tartalmaznia kell ETO-mérkőzést.');

const storage = createStorageService(new MemoryStorage());
const tournaments = createTournamentStorageService({ storage });
assert.equal(tournaments.save(initial), true, 'A kiinduló torna menthető.');
assert.equal(tournaments.read()?.currentMatchId, null, 'A kiinduló tornának még nincs aktív meccse.');

const next = {
  ...initial,
  currentMatchId: humanMatch.id,
  currentMatchMode: TOURNAMENT_MATCH_MODE.CLASSIC,
  currentLineupIds: Array.from({ length: 11 }, (_, index) => `eto-player-${index + 1}`),
  lastLineupIds: Array.from({ length: 11 }, (_, index) => `eto-player-${index + 1}`),
  updatedAt: '2026-08-12T11:21:00.000Z',
};

assert.equal(tournaments.save(next), true, 'Az új torna-meccs pending snapshotja menthető.');
assert.equal(
  tournaments.read()?.currentMatchId,
  null,
  'A Quick Match staging előtt a fő Tournament snapshotnak szándékosan a korábbi állapotban kell maradnia.',
);
const pending = tournaments.readPendingLaunch();
assert.ok(pending, 'Az új meccshez pending launch tranzakciónak kell létrejönnie.');
assert.equal(pending.next.currentMatchId, humanMatch.id, 'A pending next snapshot az indítandó meccset tartalmazza.');
assert.equal(pending.next.currentLineupIds.length, 11, 'A pending snapshot őrzi a 11 kiválasztott játékost.');

assert.equal(tournaments.commitPendingLaunch(), true, 'A Quick Match staging sikeres végén a Tournament pending snapshot commitolható.');
assert.equal(tournaments.read()?.currentMatchId, humanMatch.id, 'Commit után az aktív Tournament snapshot az indított meccset tartalmazza.');
assert.equal(tournaments.readPendingLaunch(), null, 'Sikeres commit után nem maradhat pending Tournament launch.');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const runtimeSource = fs.readFileSync(path.join(HERE, '../js/tournament/tournament-flow-runtime.js'), 'utf8');
const launchStart = runtimeSource.indexOf('function launchPreparedMatch(');
const launchEnd = runtimeSource.indexOf('\nfunction launchRandomLineup(', launchStart);
assert.ok(launchStart >= 0 && launchEnd > launchStart, 'A launchPreparedMatch függvény megtalálható.');
const launchSource = runtimeSource.slice(launchStart, launchEnd);
const pendingSaveIndex = launchSource.indexOf('tournamentStorageService.save(next)');
const stageIndex = launchSource.indexOf('deckRuntime.stageQuickMatch({');
assert.ok(pendingSaveIndex >= 0, 'A meccsindítás először Tournament pending snapshotot ment.');
assert.ok(stageIndex > pendingSaveIndex, 'A Quick Match staging csak a Tournament pending mentés után indulhat.');
assert.equal(
  launchSource.includes('saveAndVerifyTournament({'),
  false,
  'A meccsindítás nem próbálhat pending Tournament snapshotot aktív állapotként visszaellenőrizni a staging előtt.',
);
assert.ok(
  launchSource.includes('rollbackPendingLaunch'),
  'Sikertelen vagy kivételt dobó staging esetén a pending Tournament launch rollbackje megmarad.',
);

console.log('✓ Tournament match launch transaction: valós storage pending → staging commit sorrend, 11/11 keret és rollback-szerződés rendben.');
