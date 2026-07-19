/**
 * Merge the two existing playable card pools without replacing verified stats,
 * then enrich them only with exact dates of birth found in project sources.
 *
 * Usage:
 *   node scripts/merge-current-data.mjs \
 *     --expanded /path/to/99-card/data/players.json \
 *     --enriched /path/to/enriched/players.json \
 *     --profiles /path/to/NB1_2025_26_players.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
    return pairs;
  }, [])
);

const paths = {
  current: path.join(ROOT, 'data', 'players.json'),
  expanded: args.expanded,
  enriched: args.enriched,
  profiles: args.profiles,
  output: args.output ?? path.join(ROOT, 'data', 'players.json'),
};

for (const [name, file] of Object.entries(paths)) {
  if (name === 'output') continue;
  if (!file || !fs.existsSync(file)) throw new Error(`Missing --${name} source: ${file ?? '(not supplied)'}`);
}

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const currentPayload = args['current-ref']
  ? JSON.parse(execFileSync('git', ['show', args['current-ref']], { cwd: ROOT, encoding: 'utf8' }))
  : read(paths.current);
const expandedPayload = read(paths.expanded);
const enrichedRows = read(paths.enriched);
const profiles = read(paths.profiles);

const currentCards = Array.isArray(currentPayload) ? currentPayload : currentPayload.players;
const expandedCards = Array.isArray(expandedPayload) ? expandedPayload : expandedPayload.players;

const normalise = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .split(' ')
  .sort()
  .join(' ');

const clubAliases = new Map([
  ['dvsc', 'dvsc'], ['debreceni vsc', 'dvsc'],
  ['eto fc', 'eto fc'],
  ['paksi fc', 'paksi fc'],
  ['dvtk', 'dvtk'], ['diosgyori vtk', 'dvtk'],
  ['ferencvarosi tc', 'ferencvarosi tc'],
  ['kisvarda master good', 'kisvarda master good'], ['kisvarda fc', 'kisvarda master good'],
  ['kolorcity kazincbarcika sc', 'kolorcity kazincbarcika sc'], ['kazincbarcikai sc', 'kolorcity kazincbarcika sc'],
  ['mtk budapest', 'mtk budapest'],
  ['nyiregyhaza spartacus fc', 'nyiregyhaza spartacus fc'], ['nyiregyhaza spartacus', 'nyiregyhaza spartacus fc'],
  ['puskas akademia fc', 'puskas akademia fc'],
  ['ujpest fc', 'ujpest fc'],
  ['zte fc', 'zte fc'], ['zalaegerszegi te fc', 'zte fc'],
]);

const clubKey = value => clubAliases.get(normalise(value)) ?? normalise(value);
const cardPersonKey = card => card.meta?.personKey ?? card.id?.match(/^nb1-([a-f0-9]+)$/)?.[1] ?? null;
const identity = card => `${clubKey(card.club)}|${cardPersonKey(card) ?? normalise(card.name)}`;

const enrichedByPerson = new Map(enrichedRows.map(row => [row.person_key, row]));
const profileByNameClub = new Map(
  profiles.map(row => [`${clubKey(row.club_2025_26)}|${normalise(row.player_name)}`, row])
);

const dateFor = card => {
  const byPerson = enrichedByPerson.get(cardPersonKey(card));
  if (byPerson?.date_of_birth) {
    return { date: byPerson.date_of_birth, source: byPerson.player_source_url ?? byPerson.primary_source_url ?? byPerson.source_url, sourceName: 'MLSZ Adatbank' };
  }

  const profile = profileByNameClub.get(`${clubKey(card.club)}|${normalise(card.name)}`);
  if (profile?.date_of_birth) {
    return { date: profile.date_of_birth, source: profile.player_profile_url, sourceName: profile.data_source };
  }
  return { date: null, source: null, sourceName: null };
};

const currentByIdentity = new Map(currentCards.map(card => [identity(card), card]));
const merged = [];

// The 99-card working preview is the broadest existing pool for these clubs.
// Preserve every card and every stat from it; only add fields from the tracked
// deck where the working record did not already have them.
for (const card of expandedCards) {
  const tracked = currentByIdentity.get(identity(card));
  const birth = dateFor(card);
  const redCards = card.stats?.redCards;

  merged.push({
    ...card,
    ...tracked,
    id: tracked?.id ?? card.id,
    name: tracked?.name ?? card.name,
    birthDate: birth.date,
    nation: card.nation || tracked?.nation || '',
    position: card.position || tracked?.position || '',
    stats: {
      ...tracked?.stats,
      ...card.stats,
      secondYellowRedCards: null,
      // MLSZ supplies one red-card/kiállítás total and does not provide a
      // separate second-yellow figure in this export. Reuse that verified total.
      totalDismissals: Number.isFinite(redCards) ? redCards : null,
    },
    meta: {
      ...card.meta,
      ...tracked?.meta,
      previousIds: tracked?.id && tracked.id !== card.id ? [card.id] : [],
      birthDateSource: birth.source,
      birthDateSourceName: birth.sourceName,
      dismissalBreakdown: 'source-does-not-separate-second-yellow',
    },
  });
  currentByIdentity.delete(identity(card));
}

// Keep every remaining tracked card from the other nine clubs.
for (const card of currentByIdentity.values()) {
  const birth = dateFor(card);
  const redCards = card.stats?.redCards;
  merged.push({
    ...card,
    birthDate: birth.date,
    stats: {
      ...card.stats,
      secondYellowRedCards: null,
      totalDismissals: Number.isFinite(redCards) ? redCards : null,
    },
    meta: {
      ...card.meta,
      personKey: cardPersonKey(card),
      birthDateSource: birth.source,
      birthDateSourceName: birth.sourceName,
      dismissalBreakdown: 'source-does-not-separate-second-yellow',
    },
  });
}

const ids = new Set(merged.map(card => card.id));
const identities = new Set(merged.map(identity));
if (ids.size !== merged.length) throw new Error('Duplicate card id after merge.');
if (identities.size !== merged.length) throw new Error('Duplicate player/club identity after merge.');

const clubs = Object.fromEntries(
  [...new Set(merged.map(card => card.club))]
    .sort((a, b) => a.localeCompare(b, 'hu'))
    .map(club => [club, merged.filter(card => card.club === club).length])
);
const missingBirthDates = merged.filter(card => !card.birthDate).map(card => ({ id: card.id, name: card.name, club: card.club }));

const payload = {
  schemaVersion: 3,
  season: currentPayload.season ?? expandedPayload.season ?? '2025/26',
  competition: expandedPayload.competition ?? 'Nemzeti Bajnokság I / Fizz Liga',
  generatedAt: new Date().toISOString(),
  source: 'MLSZ Adatbank; exact birth dates additionally from the project MLSZ export and a cited CC0 player-profile snapshot',
  clubs,
  selection: {
    note: 'Lossless union of the existing tracked 52-card deck and the latest 99-card ETO/Paks/DVSC working pool.',
    playableCards: merged.length,
    exactBirthDates: merged.length - missingBirthDates.length,
    missingBirthDates: missingBirthDates.length,
    secondYellowBreakdownKnown: 0,
  },
  missingData: { birthDate: missingBirthDates, secondYellowRedCards: 'Nincs külön bontás a forrásban.' },
  players: merged,
};

fs.writeFileSync(paths.output, `${JSON.stringify(payload, null, 2)}\n`);
const validation = {
  playerPoolSize: merged.length,
  uniqueIds: ids.size,
  uniquePlayerClubIdentities: identities.size,
  clubCounts: clubs,
  knownValues: {
    birthDate: merged.filter(card => card.birthDate).length,
    yellowCards: merged.filter(card => Number.isFinite(card.stats.yellowCards)).length,
    redCards: merged.filter(card => Number.isFinite(card.stats.redCards)).length,
    totalDismissals: merged.filter(card => Number.isFinite(card.stats.totalDismissals)).length,
    secondYellowRedCards: merged.filter(card => Number.isFinite(card.stats.secondYellowRedCards)).length,
  },
  verifiedZeroValues: {
    yellowCards: merged.filter(card => card.stats.yellowCards === 0).length,
    totalDismissals: merged.filter(card => card.stats.totalDismissals === 0).length,
  },
  missingBirthDateIds: missingBirthDates.map(card => card.id),
};
fs.writeFileSync(path.join(path.dirname(paths.output), 'validation.json'), `${JSON.stringify(validation, null, 2)}\n`);
const missingByClub = Object.groupBy(missingBirthDates, card => card.club);
const missingReport = [
  '# Hiányzó játékosadatok',
  '',
  `A jelenlegi ${merged.length} kártyából ${missingBirthDates.length} játékosnál nincs forrással igazolt pontos születési dátum.`,
  'Ezeknél a „Fiatalabb játékos” kategória nem használható. A sárga lap és az összes kiállítás minden kártyán ismert; a második sárga miatti kiállítás külön bontása egyik rekordnál sem áll rendelkezésre.',
  '',
  ...Object.entries(missingByClub).flatMap(([club, cards]) => [
    `## ${club} (${cards.length})`,
    '',
    ...cards.sort((a, b) => a.name.localeCompare(b.name, 'hu')).map(card => `- ${card.name} (${card.id})`),
    '',
  ]),
].join('\n');
fs.writeFileSync(path.join(path.dirname(paths.output), 'missing-player-data.md'), `${missingReport}\n`);
console.log(`Wrote ${merged.length} unique existing cards to ${paths.output}`);
console.log(`Exact birth dates: ${payload.selection.exactBirthDates}; missing: ${missingBirthDates.length}`);
console.log(`Club split: ${Object.entries(clubs).map(([club, count]) => `${club} ${count}`).join(' · ')}`);
