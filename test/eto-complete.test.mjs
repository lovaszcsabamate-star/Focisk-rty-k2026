import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyClubEnrichmentPayload,
  prepareClubEnrichment,
} from '../js/data/club-enrichment.js';

const CLUB_ID = 'eto-fc';
const ENRICHMENT_FILE = 'club-official-enrichment-21-eto-completion.json';
const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const readText = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const clubIds = card => Array.isArray(card?.meta?.clubIds) && card.meta.clubIds.length
  ? card.meta.clubIds
  : [card?.meta?.clubId].filter(Boolean);

const base = readJson('../data/players.json');
const enrichment = readJson(`../data/${ENRICHMENT_FILE}`);

assert.equal(enrichment.schemaVersion, 1);
assert.equal(enrichment.season, '2025/26');
assert.equal(enrichment.batch.playerCount, 35);
assert.equal(enrichment.records.length, 35);
assert.equal(new Set(enrichment.records.map(record => record.name)).size, 35);
assert.equal(new Set(enrichment.records.map(record => record.sourceUrl)).size, 35);

const allowedPositions = new Set(['Kapus', 'Védő', 'Középpályás', 'Támadó']);
for (const record of enrichment.records) {
  assert.equal(record.clubId, CLUB_ID);
  assert.equal(record.confidence, 'high');
  assert.match(record.birthDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(record.nation, /^[A-Z]{3}( \/ [A-Z]{3})*$/);
  assert.ok(allowedPositions.has(record.position), `${record.name}: hibás poszt`);
  assert.match(record.sourceUrl, /^https:\/\/adatbank\.mlsz\.hu\/player\/\d+\.html$/);
}

const records = new Map(enrichment.records.map(record => [record.name, record]));
assert.deepEqual(
  Object.fromEntries(['nation', 'position'].map(field => [field, records.get('MASCOE LAWRENZO NATHANIEL')[field]])),
  { nation: 'CAN', position: 'Támadó' },
);
assert.equal(records.get('KULCSÁR MARTIN').position, 'Védő');
assert.equal(records.get('OURO SAMSINDIN').position, 'Középpályás');
assert.equal(records.get('SAHLI OUIJDI').nation, 'FRA / TUN');
assert.equal(records.get('SZARKA BULCSÚ JÁNOS').position, 'Középpályás');
assert.equal(records.get('Szép Márton').position, 'Támadó');
assert.equal(records.get('Gavric Zeljko').nation, 'SRB / BIH');
assert.equal(records.get('KRPIC MILJAN').nation, 'SRB / HUN');
assert.equal(records.get('ZIVKOVIC JOVAN').nation, 'AUT / SRB');

const prepared = prepareClubEnrichment(enrichment, {});
const enriched = applyClubEnrichmentPayload(base, prepared);
assert.equal(enriched.enrichment.matchedRecords, 35);
assert.equal(enriched.enrichment.unmatchedRecords, 0);
assert.equal(enriched.enrichment.conflictCount, 0);

const baseById = new Map(base.players.map(card => [card.id, card]));
const cards = enriched.players.filter(card => clubIds(card).includes(CLUB_ID));
assert.equal(cards.length, 35);
for (const card of cards) {
  assert.match(card.birthDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(card.nation, `${card.name}: hiányzó nemzetiség`);
  assert.ok(allowedPositions.has(card.position), `${card.name}: hibás végleges poszt`);
  assert.deepEqual(card.stats, baseById.get(card.id).stats, `${card.name}: a meglévő statisztika megváltozott`);
}

const kocsis = cards.find(card => card.name === 'KOCSIS BOTOND');
assert.deepEqual(clubIds(kocsis), ['eto-fc', 'kolorcity-kazincbarcika-sc']);

for (const source of ['../js/bootstrap.js', '../scripts/build-standalone.mjs', '../sw.js']) {
  const text = readText(source);
  assert.match(text, new RegExp(ENRICHMENT_FILE.replaceAll('.', '\\.')));
}
assert.match(readText('../sw.js'), /fociskartyak-2026-v28/);

const directory = readJson('../data/club-official-sources.json');
const club = directory.clubs.find(item => item.clubId === CLUB_ID);
assert.equal(club.status, 'complete-35-of-35-player-review');
assert.ok(club.recordFiles.includes(`data/${ENRICHMENT_FILE}`));

console.log('✓ ETO FC lezárva: 35/35 születési dátum, nemzetiség és poszt; a 35/35 meglévő statisztika változatlan');
