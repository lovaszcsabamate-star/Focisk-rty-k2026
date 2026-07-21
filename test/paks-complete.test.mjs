import assert from 'node:assert/strict';
import fs from 'node:fs';

const CLUB_ID = 'paksi-fc';
const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const enrichment = readJson('../data/club-official-enrichment-18-paks-completion.json');
const payload = readJson('../data/players-reviewed.json');

assert.equal(enrichment.batch.playerCount, 33);
assert.equal(enrichment.records.length, 33);
assert.equal(new Set(enrichment.records.map(record => record.name)).size, 33);
assert.ok(enrichment.records.every(record => typeof record.nation === 'string' && record.nation.includes('HUN')));

const offeredPositions = enrichment.records.filter(record => record.position);
assert.equal(offeredPositions.length, 4);
const positionByName = Object.fromEntries(offeredPositions.map(record => [record.name, record.position]));
assert.deepEqual(positionByName, {
  'DEBRECENI ÁKOS': 'Védő',
  'HARASZTI ZSOLT': 'Támadó',
  'LAPU ANDOR': 'Támadó',
  'TAMÁS OLIVÉR': 'Védő',
});
assert.equal(enrichment.records.find(record => record.name === 'TAMÁS OLIVÉR')?.nation, 'HUN / UKR');

const players = payload.players.filter(card => {
  const clubIds = Array.isArray(card?.meta?.clubIds) && card.meta.clubIds.length
    ? card.meta.clubIds
    : [card?.meta?.clubId].filter(Boolean);
  return clubIds.includes(CLUB_ID);
});
assert.equal(players.length, 33);
assert.ok(players.every(card => /^\d{4}-\d{2}-\d{2}$/.test(card.birthDate ?? '')));
assert.ok(players.every(card => typeof card.nation === 'string' && card.nation.includes('HUN')));
assert.ok(players.every(card => ['Kapus', 'Védő', 'Középpályás', 'Támadó'].includes(card.position)));
assert.ok(players.every(card => Number.isInteger(card.stats?.appearances) && card.stats.appearances >= 0));
assert.ok(players.every(card => Number.isInteger(card.stats?.squads) && card.stats.squads >= card.stats.appearances));

const reviewedByName = Object.fromEntries(players.map(card => [card.name, card]));
assert.equal(reviewedByName['TAMÁS OLIVÉR'].nation, 'HUN / UKR');
assert.equal(reviewedByName['DEBRECENI ÁKOS'].position, 'Védő');
assert.equal(reviewedByName['HARASZTI ZSOLT'].position, 'Támadó');
assert.equal(reviewedByName['LAPU ANDOR'].position, 'Támadó');
assert.equal(reviewedByName['TAMÁS OLIVÉR'].position, 'Védő');

const preservedMultiClubStats = {
  'ALAXAI ÁRON': 17,
  'BÉVÁRDI ZSOMBOR': 20,
  'OSVÁTH ATTILA': 30,
  'PETŐ MILÁN': 27,
};
for (const [name, appearances] of Object.entries(preservedMultiClubStats)) {
  assert.ok((reviewedByName[name]?.meta?.clubIds ?? []).length > 1, `${name}: többklubos jelölés hiányzik`);
  assert.equal(reviewedByName[name]?.stats?.appearances, appearances, `${name}: a meglévő szezonösszesítés megváltozott`);
}

const paksManualReview = (payload.enrichment?.manualReview ?? []).filter(item => item?.clubId === CLUB_ID);
assert.equal(paksManualReview.length, 0);
console.log('✓ Paks 33/33 születési dátum, nemzetiség, poszt és meglévő MLSZ-statisztika: rendben');
