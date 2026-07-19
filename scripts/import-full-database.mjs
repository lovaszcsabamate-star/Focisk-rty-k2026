/**
 * Import the complete 2025/26 NB I person-season database into the game.
 *
 * One card is emitted per unique person. A player registered at two clubs is
 * represented once, with both clubs and the safely aggregated season totals.
 * Existing verified values are retained whenever the complete source has an
 * explicit null. Unknown values remain null; only goals are complete for all
 * 440 players and therefore required by the game.
 *
 * Usage:
 *   node scripts/import-full-database.mjs --source-dir /path/to/extracted-dataset
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
    return pairs;
  }, [])
);

const sourceDir = args['source-dir'];
if (!sourceDir) throw new Error('Hiányzik a --source-dir kapcsoló.');

const paths = {
  people: path.join(sourceDir, 'player_season_totals.json'),
  registrations: path.join(sourceDir, 'players.json'),
  meta: path.join(sourceDir, 'meta.json'),
  sourceValidation: path.join(sourceDir, 'validation-report.json'),
  current: args.current ?? path.join(ROOT, 'data', 'players.json'),
  output: args.output ?? path.join(ROOT, 'data', 'players.json'),
};

for (const [name, file] of Object.entries(paths)) {
  if (name === 'sourceValidation' || name === 'output') continue;
  if (!fs.existsSync(file)) throw new Error(`Hiányzó ${name} fájl: ${file}`);
}

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const people = read(paths.people);
const registrations = read(paths.registrations);
const sourceMeta = read(paths.meta);
const sourceValidation = fs.existsSync(paths.sourceValidation) ? read(paths.sourceValidation) : null;
const currentPayload = read(paths.current);
const currentCards = Array.isArray(currentPayload) ? currentPayload : currentPayload.players;

if (!Array.isArray(people) || !Array.isArray(registrations) || !Array.isArray(currentCards)) {
  throw new Error('A forrás- vagy célfájl játékoslistája hibás.');
}

const finite = value => typeof value === 'number' && Number.isFinite(value);
const known = (preferred, fallback = null) => finite(preferred) ? preferred : (finite(fallback) ? fallback : null);
const personKeyOf = card => card.meta?.personKey ?? card.id?.match(/^nb1-([a-f0-9]+)$/)?.[1] ?? null;
const currentByPerson = new Map(currentCards.map(card => [personKeyOf(card), card]).filter(([key]) => key));
const duplicatePersonKeys = people.length - new Set(people.map(person => person.person_key)).size;
const countOf = value => Array.isArray(value) ? value.length : (finite(value) ? value : null);
const validIsoDate = value => {
  if (value == null) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};

if (duplicatePersonKeys) throw new Error(`${duplicatePersonKeys} duplikált person_key a személyszintű forrásban.`);
if (sourceMeta.unique_person_count !== people.length) {
  throw new Error(`A meta ${sourceMeta.unique_person_count} személyt ígér, de ${people.length} érkezett.`);
}
if (sourceMeta.player_registration_count !== registrations.length) {
  throw new Error(`A meta ${sourceMeta.player_registration_count} regisztrációt ígér, de ${registrations.length} érkezett.`);
}
if (sourceValidation) {
  const sourceProblems = [
    ...(sourceValidation.duplicate_registration_ids ?? []),
    ...(sourceValidation.unknown_club_ids ?? []),
  ];
  if (sourceProblems.length || countOf(sourceValidation.missing_person_keys) !== 0) {
    throw new Error('A forrás validációs jelentése azonosító- vagy klubhibát jelez.');
  }
}

const cards = people.map(person => {
  const existing = currentByPerson.get(person.person_key);
  const clubs = [...new Set(person.club_names ?? [])];
  const clubIds = [...new Set(person.club_ids ?? [])];
  if (!person.person_key || !person.display_name || clubs.length === 0) {
    throw new Error(`Hiányos személyrekord: ${person.person_key ?? '(nincs kulcs)'}`);
  }
  if (!finite(person.goals)) {
    throw new Error(`Hiányzó személyszintű gólösszeg: ${person.display_name}`);
  }

  const redCards = known(person.red_cards, existing?.stats?.redCards);
  const totalDismissals = finite(person.red_cards)
    ? person.red_cards
    : known(existing?.stats?.totalDismissals, redCards);
  const birthDate = person.date_of_birth ?? existing?.birthDate ?? null;
  if (!validIsoDate(birthDate)) throw new Error(`Hibás születési dátum: ${person.display_name} (${birthDate})`);
  const retainedFromPreviousDeck = existing?.meta?.retainedFromPreviousDeck === true
    || Boolean(existing?.meta?.checkedAt)
    || (!finite(person.appearances) && finite(existing?.stats?.appearances));

  return {
    id: existing?.id ?? `nb1-${person.person_key}`,
    name: existing?.name ?? person.display_name,
    club: clubs.join(' / '),
    clubs,
    nation: existing?.nation ?? '',
    position: existing?.position ?? '',
    birthDate,
    stats: {
      age: known(person.age_at_season_end, existing?.stats?.age),
      appearances: known(person.appearances, existing?.stats?.appearances),
      starts: known(person.starts, existing?.stats?.starts),
      goals: person.goals,
      squads: known(person.matchday_squad_count, existing?.stats?.squads),
      yellowCards: known(person.yellow_cards, existing?.stats?.yellowCards),
      redCards,
      secondYellowRedCards: known(existing?.stats?.secondYellowRedCards),
      totalDismissals,
      overallScore: known(person.overall_game_score, existing?.stats?.overallScore),
    },
    meta: {
      ...existing?.meta,
      personKey: person.person_key,
      clubIds,
      registrationCount: person.registration_count,
      statsScope: person.registration_count > 1 ? 'person-season-aggregate' : 'club-season',
      sourceUrl: person.player_source_url ?? existing?.meta?.sourceUrl ?? null,
      sourceDataset: sourceMeta.dataset_id,
      sourceDatasetVersion: sourceMeta.version,
      sourceDataStatus: person.data_status ?? null,
      sourceDataConfidence: person.data_confidence ?? null,
      sourceNotes: person.data_notes ?? null,
      retainedFromPreviousDeck,
      dismissalBreakdown: redCards == null ? 'unknown' : 'source-does-not-separate-second-yellow',
    },
  };
}).sort((a, b) => a.club.localeCompare(b.club, 'hu') || a.name.localeCompare(b.name, 'hu'));

const ids = new Set(cards.map(card => card.id));
if (ids.size !== cards.length) throw new Error('Duplikált kártyaazonosító az import után.');

const attributes = {
  birthDate: card => typeof card.birthDate === 'string',
  appearances: card => finite(card.stats.appearances),
  starts: card => finite(card.stats.starts),
  goals: card => finite(card.stats.goals),
  squads: card => finite(card.stats.squads),
  yellowCards: card => finite(card.stats.yellowCards),
  redCards: card => finite(card.stats.redCards),
  totalDismissals: card => finite(card.stats.totalDismissals),
  overallScore: card => finite(card.stats.overallScore),
};
const knownValues = Object.fromEntries(
  Object.entries(attributes).map(([field, predicate]) => [field, cards.filter(predicate).length])
);
const missingValueIds = Object.fromEntries(
  Object.entries(attributes).map(([field, predicate]) => [field, cards.filter(card => !predicate(card)).map(card => card.id)])
);
const clubMembershipCounts = Object.fromEntries(
  [...new Set(cards.flatMap(card => card.clubs))]
    .sort((a, b) => a.localeCompare(b, 'hu'))
    .map(club => [club, cards.filter(card => card.clubs.includes(club)).length])
);
const multiClubPlayers = cards.filter(card => card.clubs.length > 1);
const retainedCards = cards.filter(card => card.meta.retainedFromPreviousDeck).length;

const payload = {
  schemaVersion: 4,
  season: sourceMeta.season,
  competition: sourceMeta.competition,
  generatedAt: new Date().toISOString(),
  source: {
    datasetId: sourceMeta.dataset_id,
    version: sourceMeta.version,
    generatedAt: sourceMeta.generated_at,
    primary: 'MLSZ Adatbank',
    note: sourceMeta.legal_notice,
  },
  clubs: clubMembershipCounts,
  selection: {
    note: 'A teljes adatbázis személyenként egy kártyát tartalmaz; a klubváltók szezonösszesítése egyetlen, többklubos kártyán marad.',
    playableCards: cards.length,
    uniquePlayers: cards.length,
    registrationRecords: registrations.length,
    multiClubPlayers: multiClubPlayers.length,
    completeGoalTotals: knownValues.goals,
    exactBirthDates: knownValues.birthDate,
    retainedExistingCards: retainedCards,
  },
  coverage: knownValues,
  missingData: {
    note: 'Az ismeretlen értékek nullként maradnak, és az adott kategóriában nem játszhatók.',
    detailedPlayerPagesCompletedForClubs: sourceMeta.completed_clubs,
  },
  players: cards,
};

const validation = {
  schemaVersion: payload.schemaVersion,
  sourceDataset: sourceMeta.dataset_id,
  sourceDatasetVersion: sourceMeta.version,
  playerPoolSize: cards.length,
  uniqueIds: ids.size,
  uniquePersonKeys: new Set(cards.map(card => card.meta.personKey)).size,
  registrationRecords: registrations.length,
  multiClubPlayers: multiClubPlayers.length,
  clubMembershipCounts,
  knownValues,
  missingValues: Object.fromEntries(Object.entries(knownValues).map(([field, count]) => [field, cards.length - count])),
  verifiedZeroValues: {
    goals: cards.filter(card => card.stats.goals === 0).length,
    yellowCards: cards.filter(card => card.stats.yellowCards === 0).length,
    totalDismissals: cards.filter(card => card.stats.totalDismissals === 0).length,
  },
  missingValueIds,
  sourceValidationSummary: sourceValidation ? {
    valid: sourceValidation.json_validation === 'OK'
      && sourceValidation.sqlite_validation === 'OK'
      && sourceValidation.zip_integrity === 'OK',
    duplicateRegistrationIds: countOf(sourceValidation.duplicate_registration_ids),
    missingPersonKeys: countOf(sourceValidation.missing_person_keys),
    unknownClubIds: countOf(sourceValidation.unknown_club_ids),
  } : null,
};

const reportRows = Object.entries(knownValues)
  .map(([field, count]) => `| ${field} | ${count} | ${cards.length - count} |`);
const missingReport = [
  '# Adatlefedettség és hiányzó játékosadatok',
  '',
  `A játék ${cards.length} egyedi játékost tartalmaz a forrás ${registrations.length} játékos–klub regisztrációjából.`,
  `A ${multiClubPlayers.length} klubváltó személyenként egy, több klubot feltüntető kártyát kapott.`,
  '',
  '| Mező | Ismert | Ismeretlen |',
  '|---|---:|---:|',
  ...reportRows,
  '',
  'A gólérték mind a 440 játékosnál végleges személy–szezon összesítés. A többi hiányzó mező nem nulla: a forrásban még nincs feldolgozott részletes játékosoldal, ezért `null` marad.',
  '',
  'A hiányzó rekordazonosítók mezőnként a `validation.json` `missingValueIds` részében találhatók.',
  '',
  '## Forráskorlátok',
  '',
  ...(sourceMeta.known_limitations ?? []).map(item => `- ${item}`),
  '',
].join('\n');

fs.mkdirSync(path.dirname(paths.output), { recursive: true });
fs.writeFileSync(paths.output, `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync(path.join(path.dirname(paths.output), 'validation.json'), `${JSON.stringify(validation, null, 2)}\n`);
fs.writeFileSync(path.join(path.dirname(paths.output), 'missing-player-data.md'), missingReport);

console.log(`Elkészült: ${cards.length} egyedi játékos, ${registrations.length} klubregisztráció.`);
console.log(`Megőrzött korábbi kártyák: ${retainedCards}; klubváltók: ${multiClubPlayers.length}.`);
console.log(`Lefedettség: ${Object.entries(knownValues).map(([field, count]) => `${field} ${count}/${cards.length}`).join(' · ')}`);
