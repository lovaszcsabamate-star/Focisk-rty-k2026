import assert from 'node:assert/strict';
import fs from 'node:fs';

const CLUB_ID = 'zte-fc';
const payload = JSON.parse(fs.readFileSync(new URL('../data/players-reviewed.json', import.meta.url), 'utf8'));
const players = payload.players.filter(card => {
  const clubIds = Array.isArray(card?.meta?.clubIds) && card.meta.clubIds.length
    ? card.meta.clubIds
    : [card?.meta?.clubId].filter(Boolean);
  return clubIds.includes(CLUB_ID);
});

const snapshot = players
  .map(card => ({
    id: card.id,
    name: card.name,
    birthDate: card.birthDate ?? null,
    nation: card.nation ?? null,
    position: card.position ?? null,
    stats: card.stats ?? null,
    clubIds: Array.isArray(card?.meta?.clubIds) ? card.meta.clubIds : [card?.meta?.clubId].filter(Boolean),
    sourceUrl: card?.meta?.sourceUrl ?? null,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'hu-HU'));

assert.equal(snapshot.length, 43, `A projektben ${snapshot.length} ZTE-rekord található 43 helyett.`);
fs.writeFileSync(new URL('../zte-discovery.json', import.meta.url), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log('✓ ZTE pontos 43-as projektlista artifactként elkészült');
