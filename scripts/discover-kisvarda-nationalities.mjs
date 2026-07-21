import fs from 'node:fs';

const payload = JSON.parse(fs.readFileSync('data/players-reviewed.json', 'utf8'));
const players = Array.isArray(payload) ? payload : payload.players;
const clubIds = card => Array.isArray(card?.meta?.clubIds) && card.meta.clubIds.length
  ? card.meta.clubIds
  : [card?.meta?.clubId].filter(Boolean);
const rows = players
  .filter(card => clubIds(card).includes('kisvarda-master-good'))
  .map(card => ({
    id: card.id,
    name: card.name,
    birthDate: card.birthDate,
    nation: card.nation || null,
    position: card.position,
    sourceUrl: card.meta?.sourceUrl || card.meta?.birthDateSource || null,
  }));
const result = {
  clubId: 'kisvarda-master-good',
  playerCount: rows.length,
  missingNationCount: rows.filter(row => !row.nation).length,
  missingNation: rows.filter(row => !row.nation),
  existingNation: rows.filter(row => row.nation),
};
fs.writeFileSync('kisvarda-nationality-discovery.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
