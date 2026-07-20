import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyClubEnrichmentPayload,
  enrichmentNamesMatch,
  prepareClubEnrichment,
} from '../js/data/club-enrichment.js';
import { applyOfficialStatPatches } from '../js/data/club-stat-patches.js';

const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const basePayload = readJson('../data/players.json');
const directory = readJson('../data/club-official-sources.json');
const enrichmentFiles = [
  '../data/club-official-enrichment.json',
  '../data/club-official-enrichment-2.json',
  '../data/club-official-enrichment-3-paks-nyir.json',
  '../data/club-official-enrichment-4-ujpest.json',
  '../data/club-official-enrichment-5-other.json',
  '../data/club-official-enrichment-6-eto-puskas.json',
];
const correctionFiles = [
  '../data/club-official-corrections.json',
  '../data/club-official-corrections-2.json',
  '../data/club-official-corrections-3.json',
];
const statPatch = readJson('../data/club-official-stat-patches-kisvarda.json');
const rawParts = enrichmentFiles.map(readJson);
const correctionParts = correctionFiles.map(readJson);
const rawEnrichment = {
  ...rawParts[0],
  generatedAt: rawParts.at(-1)?.generatedAt ?? rawParts[0].generatedAt,
  sources: rawParts.flatMap(part => part.sources ?? []),
  records: rawParts.flatMap(part => part.records ?? []),
  clubDirectory: directory.clubs,
};
const corrections = {
  schemaVersion: 1,
  checkedAt: correctionParts.at(-1)?.checkedAt ?? null,
  addSources: correctionParts.flatMap(part => part.addSources ?? []),
  recordPatches: correctionParts.flatMap(part => part.recordPatches ?? []),
  excludeRecords: correctionParts.flatMap(part => part.excludeRecords ?? []),
  additions: correctionParts.flatMap(part => part.additions ?? []),
};
const enriched = applyClubEnrichmentPayload(
  basePayload,
  prepareClubEnrichment(rawEnrichment, corrections),
);
const patched = applyOfficialStatPatches(enriched, [statPatch]);

assert.equal(statPatch.rows.length, 30);
assert.equal(patched.players.length, 440);
assert.equal(patched.selection.registrationRecords, 464);
assert.deepEqual(patched.players.map(card => card.id), basePayload.players.map(card => card.id));
assert.equal(new Set(patched.players.map(card => card.id)).size, 440);
assert.equal(patched.officialStatPatches.records, 30);
assert.equal(patched.officialStatPatches.matchedRecords, 30);
assert.equal(patched.officialStatPatches.unmatchedRecords, 0);
assert.equal(patched.officialStatPatches.manualReview.length, 0);
assert.equal(patched.officialStatPatches.conflictCount, 0);
assert.equal(patched.officialStatPatches.multiClubMetadataOnly, 1);
assert.equal(patched.source.officialClubStatPatches.length, 1);
assert.equal(patched.source.officialClubStatPatches[0].clubId, 'kisvarda-master-good');

const find = name => patched.players.find(card =>
  card?.meta?.clubIds?.includes('kisvarda-master-good')
  && enrichmentNamesMatch(card.name, { name, aliases: statPatch.aliases?.[name] ?? [] })
);

const popovics = find('Popovics Ilija');
assert.ok(popovics);
assert.equal(popovics.name, 'POPOVICS ILLYA');
assert.equal(popovics.stats.appearances, 33);
assert.equal(popovics.stats.starts, 33);
assert.equal(popovics.stats.minutes, 3161);
assert.equal(popovics.stats.substituteAppearances, 0);
assert.equal(popovics.stats.yellowCards, 2);

const biro = find('Bíró Bence');
assert.ok(biro);
assert.equal(biro.stats.appearances, 31);
assert.equal(biro.stats.goals, 7);
assert.equal(biro.stats.assists, 4);

const mesanovic = find('Jasmin Mesanovic');
assert.ok(mesanovic);
assert.equal(mesanovic.stats.assists, 6);

for (const name of ['Ridwan Popoola', 'Molnár Gábor']) {
  const card = find(name);
  assert.ok(card);
  assert.equal(card.stats.redCards, 0);
  assert.equal(card.stats.secondYellowRedCards, 1);
  assert.equal(card.stats.totalDismissals, 1);
}

const mbock = find("Hianga’a Mbock");
assert.ok(mbock);
assert.equal(mbock.stats.appearances, 13);
assert.equal(mbock.stats.minutes, 864);

const solteszIstvan = find('Soltész István');
assert.ok(solteszIstvan);
assert.equal(solteszIstvan.name, 'SOLTÉSZ ISTVÁN ZOLTÁN');
assert.equal(solteszIstvan.stats.minutes, 107);

const conflictPayload = {
  players: [{
    id: 'conflict',
    name: 'TESZT ELEK',
    club: 'Kisvárda Master Good',
    clubs: ['Kisvárda Master Good'],
    stats: { appearances: 99, starts: null },
    meta: { clubId: 'kisvarda-master-good', clubIds: ['kisvarda-master-good'], registrationCount: 1 },
  }],
  selection: { registrationRecords: 1 },
  coverage: {},
};
const conflictPatch = {
  schemaVersion: 1,
  season: '2025/26',
  source: {
    id: 'test-source',
    clubId: 'kisvarda-master-good',
    name: 'Tesztforrás',
    url: 'https://example.com',
  },
  fields: ['name', 'appearances', 'starts'],
  rows: [['Teszt Elek', 10, 8]],
};
const conflictResult = applyOfficialStatPatches(conflictPayload, conflictPatch);
assert.equal(conflictResult.players[0].stats.appearances, 99);
assert.equal(conflictResult.players[0].stats.starts, 8);
assert.equal(conflictResult.officialStatPatches.conflictCount, 1);

const multiClubPayload = {
  players: [{
    id: 'multi',
    name: 'TESZT ELEK',
    club: 'Kisvárda Master Good / DVTK',
    clubs: ['Kisvárda Master Good', 'DVTK'],
    stats: { appearances: null, starts: null },
    meta: {
      clubIds: ['kisvarda-master-good', 'dvtk'],
      registrationCount: 2,
      statsScope: 'person-season-aggregate',
    },
  }],
  selection: { registrationRecords: 2 },
  coverage: {},
};
const multiResult = applyOfficialStatPatches(multiClubPayload, conflictPatch);
assert.equal(multiResult.players[0].stats.appearances, null);
assert.equal(multiResult.players[0].stats.starts, null);
assert.equal(multiResult.players[0].meta.clubOfficialStatsByClub['kisvarda-master-good'].appearances, 10);
assert.equal(multiResult.officialStatPatches.multiClubMetadataOnly, 1);

console.log('✓ Kisvárda hivatalos szezonstatisztika: 30 rekord, MLSZ-elsődleges és többklubos biztonság');
