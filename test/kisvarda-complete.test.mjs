import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyClubEnrichmentPayload,
  enrichmentNamesMatch,
  prepareClubEnrichment,
} from '../js/data/club-enrichment.js';
import { applyOfficialStatPatches } from '../js/data/club-stat-patches.js';

const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const readText = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const basePayload = readJson('../data/players.json');
const directory = readJson('../data/club-official-sources.json');
const finalEnrichment = readJson('../data/club-official-enrichment-10-kisvarda-final8.json');
const finalStats = readJson('../data/club-official-stat-patches-kisvarda-final8.json');
const enrichmentFiles = [
  '../data/club-official-enrichment.json',
  '../data/club-official-enrichment-2.json',
  '../data/club-official-enrichment-3-paks-nyir.json',
  '../data/club-official-enrichment-4-ujpest.json',
  '../data/club-official-enrichment-5-other.json',
  '../data/club-official-enrichment-6-eto-puskas.json',
  '../data/club-official-enrichment-7-kisvarda-selected10.json',
  '../data/club-official-enrichment-8-kisvarda-selected10.json',
  '../data/club-official-enrichment-9-kisvarda-selected10.json',
  '../data/club-official-enrichment-10-kisvarda-final8.json',
];
const correctionFiles = [
  '../data/club-official-corrections.json',
  '../data/club-official-corrections-2.json',
  '../data/club-official-corrections-3.json',
  '../data/club-official-corrections-4-kisvarda-selected10-2.json',
];
const statPatchFiles = [
  '../data/club-official-stat-patches-kisvarda.json',
  '../data/club-official-stat-patches-kisvarda-selected10.json',
  '../data/club-official-stat-patches-kisvarda-selected10-2.json',
  '../data/club-official-stat-patches-kisvarda-selected10-3.json',
  '../data/club-official-stat-patches-kisvarda-final8.json',
];

const enrichmentParts = enrichmentFiles.map(readJson);
const correctionParts = correctionFiles.map(readJson);
const statPatchParts = statPatchFiles.map(readJson);
const rawEnrichment = {
  ...enrichmentParts[0],
  generatedAt: enrichmentParts.at(-1)?.generatedAt ?? enrichmentParts[0].generatedAt,
  sources: enrichmentParts.flatMap(part => part.sources ?? []),
  records: enrichmentParts.flatMap(part => part.records ?? []),
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
const patched = applyOfficialStatPatches(enriched, statPatchParts);

assert.equal(finalEnrichment.batch.playerCount, 8);
assert.equal(finalEnrichment.batch.playerIds.length, 8);
assert.equal(new Set(finalEnrichment.batch.playerIds).size, 8);
assert.equal(finalStats.batch.playerCount, 8);
assert.equal(finalStats.rows.length, 8);
assert.equal(patched.players.length, 440);
assert.equal(new Set(patched.players.map(player => player.id)).size, 440);
assert.equal(new Set(patched.players.map(player => player.meta?.personKey)).size, 440);
assert.equal(patched.enrichment.unmatchedRecords, 0);
assert.equal(patched.enrichment.conflictCount, 0);
assert.equal(patched.officialStatPatches.unmatchedRecords, 0);
assert.equal(patched.officialStatPatches.conflictCount, 0);

const kisvarda = patched.players.filter(player =>
  player.meta?.clubIds?.includes('kisvarda-master-good')
);
assert.equal(kisvarda.length, 38, 'A Kisvárda adatbázisának 38 játékost kell tartalmaznia');

for (const player of kisvarda) {
  assert.match(player.birthDate, /^\d{4}-\d{2}-\d{2}$/, `${player.name}: hiányzó pontos születési dátum`);
  assert.ok(player.position && player.position !== 'Nincs adat', `${player.name}: hiányzó poszt`);
  for (const field of [
    'appearances',
    'starts',
    'substituteAppearances',
    'squads',
    'goals',
    'yellowCards',
    'redCards',
    'secondYellowRedCards',
    'totalDismissals',
  ]) {
    assert.equal(Number.isFinite(player.stats?.[field]), true, `${player.name}: hiányzó vagy hibás ${field}`);
    assert.ok(player.stats[field] >= 0, `${player.name}: negatív ${field}`);
  }
  assert.equal(
    player.stats.starts + player.stats.substituteAppearances,
    player.stats.appearances,
    `${player.name}: a kezdés/csere bontás nem adja ki a pályára lépéseket`,
  );
  assert.ok(player.stats.squads >= player.stats.appearances, `${player.name}: a kerettagság kisebb a pályára lépésnél`);
  assert.ok(player.meta?.clubOfficialSources?.length > 0, `${player.name}: hiányzó klubforrás`);
  assert.ok(player.meta?.officialStatSources?.length > 0, `${player.name}: hiányzó MLSZ-statisztikai forrás`);
}

const expected = {
  'nb1-082b9edbee8d': { birthDate: '2005-08-28', position: 'Támadó', nation: 'NGR', appearances: 4, starts: 0, substitutes: 4, squads: 7 },
  'nb1-a8d4793a3acf': { birthDate: '2002-11-04', position: 'Támadó', appearances: 1, starts: 0, substitutes: 1, squads: 2 },
  'nb1-6c24b3629e1e': { birthDate: '1995-04-05', position: 'Kapus', appearances: 0, starts: 0, substitutes: 0, squads: 4 },
  'nb1-9e00c5f876e9': { birthDate: '2008-11-28', position: 'Középpályás', appearances: 0, starts: 0, substitutes: 0, squads: 2 },
  'nb1-7012de8d22c6': { birthDate: '2005-10-29', position: 'Támadó', appearances: 17, starts: 4, substitutes: 13, squads: 27 },
  'nb1-2c1a69d9470c': { birthDate: '2006-10-01', position: 'Támadó', appearances: 13, starts: 4, substitutes: 9, squads: 17 },
  'nb1-29c1a2d27f64': { birthDate: '2004-06-11', position: 'Védő', nation: 'ESP / HUN', appearances: 0, starts: 0, substitutes: 0, squads: 5 },
  'nb1-1ba2fbff76ce': { birthDate: '2008-01-11', position: 'Középpályás', appearances: 0, starts: 0, substitutes: 0, squads: 4 },
};

for (const [id, values] of Object.entries(expected)) {
  const player = patched.players.find(item => item.id === id);
  assert.ok(player, `Hiányzik a lezáró nyolcas játékosa: ${id}`);
  assert.equal(player.birthDate, values.birthDate);
  assert.equal(player.position, values.position);
  if ('nation' in values) assert.equal(player.nation, values.nation);
  assert.equal(player.stats.appearances, values.appearances);
  assert.equal(player.stats.starts, values.starts);
  assert.equal(player.stats.substituteAppearances, values.substitutes);
  assert.equal(player.stats.squads, values.squads);
  assert.ok(player.meta.clubOfficialSources.some(source => source.checkedAt === '2026-07-20'));
  assert.ok(player.meta.officialStatSources.some(source =>
    source.sourceId === 'mlsz-fizz-liga-kisvarda-final8-2025-26'
  ));
}

for (const record of finalEnrichment.records) {
  assert.ok(finalEnrichment.batch.playerIds.some(id => {
    const player = basePayload.players.find(item => item.id === id);
    return player && enrichmentNamesMatch(player.name, record);
  }), `A lezáró nyolcason kívüli rekord került a csomagba: ${record.name}`);
  assert.equal(record.checkedAt, '2026-07-20');
  assert.equal(record.season, '2025/26');
  assert.equal(record.confidence, 'high');
  assert.match(record.sourceUrl, /^https:\/\//);
}

const kisvardaDirectory = directory.clubs.find(club => club.clubId === 'kisvarda-master-good');
assert.equal(kisvardaDirectory.status, 'complete-38-of-38-player-review');
assert.ok(kisvardaDirectory.recordFiles.includes('data/club-official-enrichment-10-kisvarda-final8.json'));
assert.ok(kisvardaDirectory.recordFiles.includes('data/club-official-stat-patches-kisvarda-final8.json'));

for (const file of [
  'club-official-enrichment-10-kisvarda-final8.json',
  'club-official-stat-patches-kisvarda-final8.json',
]) {
  for (const source of ['../js/bootstrap.js', '../scripts/build-standalone.mjs', '../sw.js']) {
    assert.match(readText(source), new RegExp(file.replaceAll('.', '\\.')));
  }
}

console.log('✓ Kisvárda lezárva: 38/38 játékos forrásolt születési dátuma, posztja és Fizz Liga-kerettagsága rendben');
