import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyClubEnrichmentPayload,
  prepareClubEnrichment,
} from '../js/data/club-enrichment.js';
import { applyOfficialStatPatches } from '../js/data/club-stat-patches.js';

const FILE = 'club-official-enrichment-23-final-missing-basic.json';
const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const readText = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clubIds = card => Array.isArray(card?.meta?.clubIds) && card.meta.clubIds.length
  ? card.meta.clubIds
  : [card?.meta?.clubId].filter(Boolean);
const enrichmentConflicts = card => Array.isArray(card?.meta?.enrichmentConflicts)
  ? card.meta.enrichmentConflicts
  : [];

const base = readJson('../data/players-reviewed.json');
const completion = readJson(`../data/${FILE}`);
const basicRecords = completion.records.filter(record => record.nation || record.position);
const heightRecords = completion.records.filter(record => finite(record.heightCm));

assert.equal(base.players.length, 440);
assert.equal(completion.batch.playerCount, completion.records.length);
assert.equal(completion.batch.heightRecordCount, heightRecords.length);
assert.equal(basicRecords.length, 7);
assert.equal(new Set(completion.records.map(record => `${record.sourceId}|${record.clubId}|${record.name}`)).size, completion.records.length);

for (const record of completion.records) {
  const hasBasicData = Boolean(record.nation || record.position);
  const hasHeight = finite(record.heightCm);
  assert.ok(hasBasicData || hasHeight, `${record.name}: nincs kiegészítendő adat`);
  if (hasBasicData) assert.equal(record.confidence, 'high');
  if (hasHeight) {
    assert.ok(record.heightCm >= completion.policy.heightRange.minimum, `${record.name}: túl alacsony magasság`);
    assert.ok(record.heightCm <= completion.policy.heightRange.maximum, `${record.name}: túl magas magasság`);
  }
  assert.equal('birthDate' in record, false, `${record.name}: a lezáró réteg dátumot tartalmaz`);
  assert.equal('stats' in record, false, `${record.name}: a lezáró réteg statisztikát tartalmaz`);
}

const prepared = prepareClubEnrichment(completion, {});
const enriched = applyClubEnrichmentPayload(base, prepared);
assert.equal(enriched.players.length, 440);
assert.ok(enriched.enrichment.matchedRecords >= basicRecords.length);
assert.equal(
  enriched.enrichment.matchedRecords + enriched.enrichment.unmatchedRecords,
  completion.records.length,
);
const baseById = new Map(base.players.map(card => [card.id, card]));
const newConflicts = enriched.players.flatMap(card =>
  enrichmentConflicts(card).slice(enrichmentConflicts(baseById.get(card.id)).length)
);
assert.equal(newConflicts.length, enriched.enrichment.conflictCount);
assert.ok(newConflicts.every(conflict => conflict.field === 'heightCm'));
assert.ok(
  enriched.players.filter(card => finite(card.stats?.heightCm)).length
    >= base.players.filter(card => finite(card.stats?.heightCm)).length,
);

const byName = new Map(enriched.players.map(card => [card.name, card]));
assert.equal(byName.get('ASZTALOS NOEL').nation, 'HUN');
assert.equal(byName.get('ASZTALOS NOEL').position, 'Középpályás');
assert.equal(byName.get('KOHUT MÁTÉ').nation, 'HUN');
assert.equal(byName.get('KOHUT MÁTÉ').position, 'Támadó');
assert.equal(byName.get('BEKE PÉTER').position, 'Támadó');
assert.equal(byName.get('GILBERT DANTAYE MICHAEL LEE').position, 'Középpályás');
assert.equal(byName.get('JOKIC RANKO').position, 'Védő');
assert.equal(byName.get('JOVANOV VANE').position, 'Védő');
assert.equal(byName.get('VARGA KEVIN').position, 'Középpályás');
assert.equal(enriched.players.filter(card => card.nation).length, 440);
assert.equal(enriched.players.filter(card => card.position).length, 440);

const primaryFields = [
  'appearances',
  'starts',
  'squads',
  'yellowCards',
  'redCards',
  'totalDismissals',
];
const consensusFields = [...primaryFields, 'substituteAppearances'];
const consensusCandidates = enriched.players.filter(card => {
  const registeredClubs = clubIds(card);
  if (registeredClubs.length <= 1) return false;
  const rows = registeredClubs.map(clubId => card.meta?.clubOfficialStatsByClub?.[clubId]);
  if (rows.some(row => !row || typeof row !== 'object')) return false;
  return consensusFields.every(field => {
    const values = rows.map(row => row[field]);
    return values.every(finite) && values.every(value => value === values[0]);
  });
});
assert.equal(consensusCandidates.length, 17);
const candidateIds = new Set(consensusCandidates.map(card => card.id));
const consensusSeed = {
  ...enriched,
  players: enriched.players.map(card => {
    if (!candidateIds.has(card.id)) return card;
    const stats = { ...card.stats };
    for (const field of consensusFields) stats[field] = null;
    const meta = { ...card.meta };
    delete meta.officialStatConsensus;
    return { ...card, stats, meta };
  }),
};

const beforeStats = new Map(consensusSeed.players.map(card => [card.id, structuredClone(card.stats)]));
const finalPayload = applyOfficialStatPatches(consensusSeed, []);
assert.equal(finalPayload.players.length, 440);
assert.equal(finalPayload.officialStatPatches.consensusPromotedPlayers, 17);
assert.equal(finalPayload.officialStatPatches.consensusConflictCount, 0);

for (const field of primaryFields) {
  assert.equal(finalPayload.players.filter(card => finite(card.stats?.[field])).length, 440, `${field}: nem teljes a lefedettség`);
}
assert.equal(finalPayload.players.filter(card => finite(card.stats?.substituteAppearances)).length, 440);

const changedCards = finalPayload.players.filter(card =>
  primaryFields.some(field => card.stats?.[field] !== beforeStats.get(card.id)?.[field])
);
assert.equal(changedCards.length, 17);
assert.ok(changedCards.every(card => clubIds(card).length > 1));
assert.ok(changedCards.every(card => card.meta?.officialStatConsensus?.fieldsApplied?.length >= 7));

const finalByName = new Map(finalPayload.players.map(card => [card.name, card]));
assert.equal(finalByName.get('ACOLATSE ELTON-OFOI').stats.appearances, 24);
assert.equal(finalByName.get('ACOLATSE ELTON-OFOI').stats.starts, 20);
assert.equal(finalByName.get('COLLEY LAMIN').stats.redCards, 1);
assert.equal(finalByName.get('DALA MARTIN').stats.squads, 31);
assert.equal(finalByName.get('BODNÁR GERGŐ JÁNOS').stats.yellowCards, 5);
assert.equal(finalByName.get('KRAJCSOVICS ÁBEL GYÖRGY').stats.substituteAppearances, 18);

assert.equal(finalPayload.players.filter(card => finite(card.stats?.minutes)).length, 29);
assert.equal(finalPayload.players.filter(card => finite(card.stats?.assists)).length, 29);
assert.equal(finalPayload.players.filter(card => finite(card.stats?.secondYellowRedCards)).length, 37);

const databaseRegistry = readJson('../data/databases/registry.json');
const databaseEntry = databaseRegistry.databases.find(entry => entry.id === databaseRegistry.defaultDatabaseId);
const databaseManifest = readJson(`../${databaseEntry.manifest}`);
assert.ok(databaseManifest.files.enrichments.some(file => file.endsWith(FILE)));
assert.match(readText('../js/bootstrap.js'), /loadDatabase/);
assert.match(readText('../js/database/database-service.js'), /getRegisteredDefaultDatabase/);
assert.match(readText('../scripts/build-standalone.mjs'), /databaseManifestFile/);
assert.match(readText('../sw.js'), new RegExp(FILE.replaceAll('.', '\.')));
assert.match(readText('../sw.js'), /fociskartyak-2026-v30/);
assert.match(readText('../js/data/club-stat-patches.js'), /officialStatConsensus/);

console.log(`✓ Végső adatlezárás: ${completion.records.length} kiegészítés, teljes nemzetiség-, poszt-, mérkőzés-, kezdés-, keret- és lapadat`);
