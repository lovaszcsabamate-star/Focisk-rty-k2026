import fs from 'node:fs';

const payload = JSON.parse(fs.readFileSync('data/players-reviewed.json', 'utf8'));
const fields = ['nation', 'position', 'appearances', 'starts', 'squads', 'yellowCards', 'redCards', 'totalDismissals'];
const clubIds = card => Array.isArray(card?.meta?.clubIds) && card.meta.clubIds.length
  ? card.meta.clubIds
  : [card?.meta?.clubId].filter(Boolean);

const rows = payload.players
  .map(card => ({
    id: card.id,
    name: card.name,
    clubIds: clubIds(card),
    birthDate: card.birthDate ?? null,
    nation: card.nation ?? null,
    position: card.position ?? null,
    stats: card.stats ?? null,
    missing: fields.filter(field => {
      if (['nation', 'position'].includes(field)) return card[field] == null || card[field] === '';
      return card.stats?.[field] == null;
    }),
    meta: {
      mlszPlayerUrl: card.meta?.mlszPlayerUrl ?? card.meta?.officialPlayerUrl ?? null,
      clubNames: card.meta?.clubNames ?? null,
      clubOfficialStatsByClub: card.meta?.clubOfficialStatsByClub ?? null,
    },
  }))
  .filter(row => row.missing.length > 0);

const summary = Object.fromEntries(fields.map(field => [field, rows.filter(row => row.missing.includes(field)).length]));
fs.writeFileSync('final-missing-data-discovery.json', `${JSON.stringify({ generatedAt: new Date().toISOString(), summary, rows }, null, 2)}\n`);
console.log(JSON.stringify({ summary, rows: rows.length }));
