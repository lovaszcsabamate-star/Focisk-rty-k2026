import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  applyClubEnrichmentPayload,
  enrichmentNamesMatch,
  normaliseEnrichmentText,
} from '../js/data/club-enrichment.js';

const payload = JSON.parse(fs.readFileSync(new URL('../data/players.json', import.meta.url), 'utf8'));
const enrichment = JSON.parse(fs.readFileSync(new URL('../data/club-official-enrichment.json', import.meta.url), 'utf8'));
const enriched = applyClubEnrichmentPayload(payload, enrichment);

assert.equal(enrichment.schemaVersion, 1);
assert.equal(enrichment.season, '2025/26');
assert.equal(enrichment.records.length, 86);
assert.equal(enriched.players.length, payload.players.length);
assert.deepEqual(enriched.players.map(card => card.id), payload.players.map(card => card.id));
assert.equal(new Set(enriched.players.map(card => card.id)).size, payload.players.length);
assert.ok(enriched.enrichment.matchedRecords >= 70, 'legalább 70 hivatalos klubrekordnak illeszkednie kell');
assert.ok(enriched.coverage.position > (payload.coverage.position ?? 0));
assert.ok(enriched.coverage.nation > (payload.coverage.nation ?? 0));
assert.ok(enriched.coverage.heightCm > (payload.coverage.heightCm ?? 0));
assert.ok(enriched.coverage.shirtNumber > (payload.coverage.shirtNumber ?? 0));

const find = (clubId, name) => enriched.players.find(card =>
  card?.meta?.clubIds?.includes(clubId) && enrichmentNamesMatch(card.name, { name })
);

const szatmari = find('dvtk', 'Szatmári Csaba');
assert.ok(szatmari, 'Szatmári Csaba rekord');
assert.equal(szatmari.position, 'Védő');
assert.equal(szatmari.nation, 'HUN');
assert.equal(szatmari.stats.heightCm, 198);
assert.equal(szatmari.stats.shirtNumber, 3);

const dibusz = find('ferencvarosi-tc', 'Dibusz Dénes');
assert.ok(dibusz, 'Dibusz Dénes rekord');
assert.equal(dibusz.position, 'Kapus');
assert.equal(dibusz.nation, 'HUN');
assert.equal(dibusz.stats.shirtNumber, 90);

const acolatse = find('dvtk', 'Acolatse Elton');
if (acolatse?.meta?.registrationCount > 1) {
  assert.equal(acolatse.stats.shirtNumber ?? null, null, 'többklubos kártyán nincs klubspecifikus mezszám');
}

const conflictPayload = {
  players: [{
    id: 'conflict', name: 'TESZT ELEK', club: 'DVTK', position: '', nation: '', birthDate: '2000-01-01',
    stats: { heightCm: null, shirtNumber: null },
    meta: { clubId: 'dvtk', clubIds: ['dvtk'], registrationCount: 1 },
  }],
};
const conflictEnrichment = {
  schemaVersion: 1,
  sources: [{ id: 'test', name: 'Tesztforrás', url: 'https://example.com', checkedAt: '2026-07-20' }],
  records: [{ sourceId: 'test', clubId: 'dvtk', name: 'Teszt Elek', birthDate: '1999-01-01', position: 'Védő' }],
};
const conflictResult = applyClubEnrichmentPayload(conflictPayload, conflictEnrichment);
assert.equal(conflictResult.players[0].birthDate, '2000-01-01', 'meglévő adat nem írható felül');
assert.equal(conflictResult.enrichment.conflictCount, 1);
assert.equal(normaliseEnrichmentText("O'Dowda, Callum"), 'O DOWDA CALLUM');

console.log(`✓ Kluboldali bővítés: ${enriched.enrichment.matchedRecords}/${enrichment.records.length} rekord illesztve`);
