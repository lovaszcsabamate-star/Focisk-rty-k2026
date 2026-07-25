/** DOM-mentes Gyors meccs csapat-, ellenfél- és pakliépítési logika. */

import { AI, HUMAN, shuffle } from '../engine.js';
import {
  canonicalClubKey,
  canonicalNationKey,
  nationPresentation,
} from './deck-selection-domain.js';

export const MIN_QUICK_MATCH_TEAM_SIZE = 7;
export const DEFAULT_QUICK_MATCH_DECK_SIZE = 7;

export const QUICK_MATCH_CATEGORY = Object.freeze({
  HUNGARIAN_LEAGUE: 'hungarian-league',
  LEAGUE: 'league',
  NATIONAL: 'national',
});

export const QUICK_MATCH_CATEGORIES = Object.freeze([
  Object.freeze({ id: QUICK_MATCH_CATEGORY.HUNGARIAN_LEAGUE, label: 'Magyar bajnokság' }),
  Object.freeze({ id: QUICK_MATCH_CATEGORY.LEAGUE, label: 'Liga' }),
  Object.freeze({ id: QUICK_MATCH_CATEGORY.NATIONAL, label: 'Válogatott' }),
]);

const NATIONAL_TEAM_NAMES = Object.freeze({
  hungary: 'Magyarország',
  serbia: 'Szerbia',
  romania: 'Románia',
  slovakia: 'Szlovákia',
  slovenia: 'Szlovénia',
  croatia: 'Horvátország',
  ukraine: 'Ukrajna',
  austria: 'Ausztria',
  germany: 'Németország',
  'bosnia-herzegovina': 'Bosznia-Hercegovina',
  montenegro: 'Montenegró',
  'north-macedonia': 'Észak-Macedónia',
  albania: 'Albánia',
  kosovo: 'Koszovó',
  czechia: 'Csehország',
  poland: 'Lengyelország',
  netherlands: 'Hollandia',
  france: 'Franciaország',
  spain: 'Spanyolország',
  italy: 'Olaszország',
  portugal: 'Portugália',
  brazil: 'Brazília',
  argentina: 'Argentína',
});

const NATIONAL_ALPHA2 = Object.freeze({
  hungary: 'HU', serbia: 'RS', romania: 'RO', slovakia: 'SK', slovenia: 'SI',
  croatia: 'HR', ukraine: 'UA', austria: 'AT', germany: 'DE',
  'bosnia-herzegovina': 'BA', montenegro: 'ME', 'north-macedonia': 'MK',
  albania: 'AL', kosovo: 'XK', czechia: 'CZ', poland: 'PL',
  netherlands: 'NL', france: 'FR', spain: 'ES', italy: 'IT', portugal: 'PT',
  brazil: 'BR', argentina: 'AR', ghana: 'GH', nigeria: 'NG', senegal: 'SN',
  georgia: 'GE', algeria: 'DZ', armenia: 'AM', australia: 'AU', belgium: 'BE',
  bulgaria: 'BG', canada: 'CA', cameroon: 'CM', cyprus: 'CY', denmark: 'DK',
  england: 'GB', finland: 'FI', greece: 'GR', ireland: 'IE', israel: 'IL',
  japan: 'JP', latvia: 'LV', lithuania: 'LT', moldova: 'MD', norway: 'NO',
  sweden: 'SE', switzerland: 'CH', tunisia: 'TN', 'united-states': 'US',
});

const QUICK_MATCH_PLACEHOLDER_LOGO = 'src/assets/placeholders/club-badge.svg';
const quickMatchPlayers = players => (Array.isArray(players) ? players : []);
const quickMatchText = value => String(value ?? '').trim();
const quickMatchOwn = (value, key) => Object.prototype.hasOwnProperty.call(value ?? {}, key);

const quickMatchHash = value => [...String(value ?? '')]
  .reduce((hash, character) => ((hash * 31) + character.codePointAt(0)) >>> 0, 2166136261);

const quickMatchColours = value => {
  const hue = quickMatchHash(value) % 360;
  return {
    primaryColor: `hsl(${hue} 58% 34%)`,
    secondaryColor: `hsl(${(hue + 52) % 360} 70% 64%)`,
  };
};

const quickMatchInitials = name => {
  const words = quickMatchText(name)
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter(word => word && !['fc', 'tc', 'sc', 'se', 'kft'].includes(word.toLocaleLowerCase('hu-HU')));
  const initials = words.slice(0, 4).map(word => word[0]).join('').toLocaleUpperCase('hu-HU');
  return initials || quickMatchText(name).slice(0, 4).toLocaleUpperCase('hu-HU');
};

export const isValidQuickMatchPlayer = player => Boolean(
  player
  && typeof player === 'object'
  && quickMatchText(player.id)
  && quickMatchText(player.name)
  && quickMatchText(player.club),
);

const uniqueQuickMatchPlayers = players => {
  const seen = new Set();
  return quickMatchPlayers(players).filter(player => {
    if (!isValidQuickMatchPlayer(player) || seen.has(player.id)) return false;
    seen.add(player.id);
    return true;
  });
};

/** Egy kettős vagy eltérően formázott nemzetiségből minden érvényes országkulcsot felold. */
export function quickMatchNationKeys(value) {
  const raw = quickMatchText(value);
  if (!raw) return [];
  const parts = raw.split(/\s*\/\s*|\s*,\s*|\s*;\s*|\s*\|\s*/).filter(Boolean);
  const keys = parts.map(canonicalNationKey).filter(Boolean);
  return [...new Set(keys)];
}

const createClubTeam = ({ key, label, playerIds, competitionId, competitionName }) => ({
  id: `club:${key}`,
  name: label,
  shortName: quickMatchInitials(label),
  type: 'club',
  teamCategory: QUICK_MATCH_CATEGORY.HUNGARIAN_LEAGUE,
  competitionId,
  competitionName,
  countryCode: 'HU',
  logoPath: QUICK_MATCH_PLACEHOLDER_LOGO,
  ...quickMatchColours(key),
  playerIds,
});

const createNationalTeam = ({ key, playerIds }) => {
  const presentation = nationPresentation(key);
  const name = NATIONAL_TEAM_NAMES[key] ?? presentation.label;
  return {
    id: `national:${key}`,
    name,
    shortName: (NATIONAL_ALPHA2[key] ?? quickMatchInitials(name)).toLocaleUpperCase('hu-HU'),
    type: 'national',
    teamCategory: QUICK_MATCH_CATEGORY.NATIONAL,
    competitionId: 'national-teams',
    competitionName: `${presentation.label} válogatott`,
    countryCode: NATIONAL_ALPHA2[key] ?? null,
    flag: presentation.flag,
    logoPath: null,
    ...quickMatchColours(`national-${key}`),
    playerIds,
  };
};

export function buildQuickMatchTeams(players, {
  competitionId = 'hungary-nb1-2025-26',
  competitionName = 'Magyar bajnokság',
  minimum = MIN_QUICK_MATCH_TEAM_SIZE,
} = {}) {
  const pool = uniqueQuickMatchPlayers(players);
  const clubs = new Map();
  const nations = new Map();

  for (const player of pool) {
    const clubKey = canonicalClubKey(player.club);
    if (clubKey) {
      const club = clubs.get(clubKey) ?? { key: clubKey, label: quickMatchText(player.club), playerIds: [] };
      club.playerIds.push(player.id);
      clubs.set(clubKey, club);
    }

    for (const nationKey of quickMatchNationKeys(player.nation)) {
      const nation = nations.get(nationKey) ?? { key: nationKey, playerIds: [] };
      nation.playerIds.push(player.id);
      nations.set(nationKey, nation);
    }
  }

  const clubTeams = [...clubs.values()]
    .filter(team => team.playerIds.length >= minimum)
    .map(team => createClubTeam({ ...team, competitionId, competitionName }))
    .sort((left, right) => left.name.localeCompare(right.name, 'hu-HU'));

  const nationalTeams = [...nations.values()]
    .filter(team => team.playerIds.length >= minimum)
    .map(createNationalTeam)
    .sort((left, right) => right.playerIds.length - left.playerIds.length
      || left.name.localeCompare(right.name, 'hu-HU'));

  return Object.freeze({
    minimum,
    teams: Object.freeze([...clubTeams, ...nationalTeams].map(team => Object.freeze({
      ...team,
      playerIds: Object.freeze([...new Set(team.playerIds)]),
    }))),
    byCategory: Object.freeze({
      [QUICK_MATCH_CATEGORY.HUNGARIAN_LEAGUE]: Object.freeze(clubTeams),
      [QUICK_MATCH_CATEGORY.LEAGUE]: Object.freeze([]),
      [QUICK_MATCH_CATEGORY.NATIONAL]: Object.freeze(nationalTeams),
    }),
  });
}

export const quickMatchTeamsForCategory = (catalog, category) => (
  Array.isArray(catalog?.byCategory?.[category]) ? catalog.byCategory[category] : []
);

export function resolveQuickMatchTeam(catalog, teamId) {
  return quickMatchPlayers(catalog?.teams).find(team => team.id === teamId) ?? null;
}

export function resolveQuickMatchTeamPlayers(team, players) {
  if (!team || !Array.isArray(team.playerIds)) return [];
  const index = new Map(uniqueQuickMatchPlayers(players).map(player => [player.id, player]));
  const seen = new Set();
  return team.playerIds.flatMap(id => {
    if (seen.has(id) || !index.has(id)) return [];
    seen.add(id);
    return [index.get(id)];
  });
}

export function chooseQuickMatchOpponent(selectedTeam, candidates, {
  lastOpponentIds = [],
  rng = Math.random,
  minimum = MIN_QUICK_MATCH_TEAM_SIZE,
} = {}) {
  if (!selectedTeam) return null;
  const eligible = quickMatchPlayers(candidates).filter(team => (
    team?.id !== selectedTeam.id
    && team?.teamCategory === selectedTeam.teamCategory
    && team?.competitionId === selectedTeam.competitionId
    && Array.isArray(team?.playerIds)
    && team.playerIds.length >= minimum
  ));
  if (!eligible.length) return null;

  const recent = new Set(quickMatchPlayers(lastOpponentIds));
  const fresh = eligible.filter(team => !recent.has(team.id));
  const pool = fresh.length ? fresh : eligible;
  const sample = Number(rng());
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor((Number.isFinite(sample) ? sample : 0) * pool.length)));
  return pool[index];
}

export function buildQuickMatchDecks(selectedTeam, opponentTeam, players, {
  deckSize = DEFAULT_QUICK_MATCH_DECK_SIZE,
  minimum = MIN_QUICK_MATCH_TEAM_SIZE,
  rng = Math.random,
} = {}) {
  if (!selectedTeam || !opponentTeam || selectedTeam.id === opponentTeam.id) {
    throw new Error('A Gyors meccshez két különböző csapat szükséges.');
  }
  const humanPlayers = resolveQuickMatchTeamPlayers(selectedTeam, players);
  const aiPlayers = resolveQuickMatchTeamPlayers(opponentTeam, players);
  if (humanPlayers.length < minimum || aiPlayers.length < minimum) {
    throw new Error(`Mindkét csapatnak legalább ${minimum} érvényes játékoskártyával kell rendelkeznie.`);
  }

  const requested = Number.isInteger(deckSize) && deckSize > 0 ? deckSize : DEFAULT_QUICK_MATCH_DECK_SIZE;
  const matchDeckSize = Math.min(humanPlayers.length, aiPlayers.length, requested);
  if (matchDeckSize < minimum) {
    throw new Error(`A Gyors meccs paklimérete nem lehet kisebb ${minimum} lapnál.`);
  }

  const teamDecks = {
    [HUMAN]: shuffle(humanPlayers, rng).slice(0, matchDeckSize),
    [AI]: shuffle(aiPlayers, rng).slice(0, matchDeckSize),
  };
  return Object.freeze({
    matchDeckSize,
    teamDecks: Object.freeze({
      [HUMAN]: Object.freeze(teamDecks[HUMAN]),
      [AI]: Object.freeze(teamDecks[AI]),
    }),
    players: Object.freeze([...teamDecks[HUMAN], ...teamDecks[AI]]),
  });
}

export function createQuickMatchConfig({
  playerTeam,
  opponentTeam,
  deckSize = DEFAULT_QUICK_MATCH_DECK_SIZE,
  enabledComparisonCategories = [],
} = {}) {
  if (!playerTeam || !opponentTeam || playerTeam.id === opponentTeam.id) {
    throw new Error('Érvényes, különböző Gyors meccs csapatok szükségesek.');
  }
  return Object.freeze({
    mode: 'quick-match',
    playerTeamId: playerTeam.id,
    opponentTeamId: opponentTeam.id,
    teamCategory: playerTeam.teamCategory,
    deckSize,
    enabledComparisonCategories: Object.freeze([...new Set(enabledComparisonCategories)]),
  });
}

export function normaliseQuickMatchState(value, catalog) {
  const categoryIds = new Set(QUICK_MATCH_CATEGORIES.map(category => category.id));
  const category = categoryIds.has(value?.category)
    ? value.category
    : QUICK_MATCH_CATEGORY.HUNGARIAN_LEAGUE;
  const selectedTeam = resolveQuickMatchTeam(catalog, value?.selectedTeamId);
  const opponentTeam = resolveQuickMatchTeam(catalog, value?.opponentTeamId);
  const selectionValid = selectedTeam?.teamCategory === category;
  const opponentValid = selectionValid
    && opponentTeam?.teamCategory === category
    && opponentTeam?.competitionId === selectedTeam.competitionId
    && opponentTeam.id !== selectedTeam.id;
  return {
    category,
    selectedTeamId: selectionValid ? selectedTeam.id : null,
    opponentTeamId: opponentValid ? opponentTeam.id : null,
    lastOpponentIds: quickMatchPlayers(value?.lastOpponentIds)
      .filter(id => typeof id === 'string' && quickMatchOwn(Object.fromEntries(catalog.teams.map(team => [team.id, true])), id))
      .slice(-4),
  };
}
