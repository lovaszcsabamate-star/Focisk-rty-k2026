/** DOM- és tárolásfüggetlen Gyors meccs csapat- és párosítási logika. */

import { federationPresentation } from '../data/federations.js';
import {
  MIN_FILTERED_DECK_SIZE,
  applyDeckSelectionToPayload,
  canonicalClubKey,
  canonicalFederationKey,
  canonicalNationKey,
  nationPresentation,
  resolveDeckSelection,
} from './deck-selection-domain.js';
import {
  getPlayableFederationTeams,
  getPlayableNationalTeams,
  isPlayablePlayer,
} from './federation-domain.js';

export const QUICK_MATCH_NATION_MINIMUM = 11;
export const QUICK_MATCH_FEDERATION_MINIMUM = 11;
export const QUICK_MATCH_LEAGUE_MINIMUM = 11;

export const QUICK_MATCH_CATEGORY = Object.freeze({
  HUNGARIAN: 'hungarian',
  LEAGUE: 'league',
  NATIONAL: 'national',
  FEDERATION: 'federation',
});

export const QUICK_MATCH_SELECTION_STEP = Object.freeze({
  PLAYER_TEAM: 'player-team',
  OPPONENT: 'opponent',
});

const QUICK_MATCH_SELECTION_KINDS = new Set(['club', 'league', 'nation', 'federation']);
const quickMatchPlayers = players => (Array.isArray(players) ? players.filter(isPlayablePlayer) : []);
const quickMatchText = value => String(value ?? '').trim();
const quickMatchFold = value => quickMatchText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU')
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export const canonicalLeagueKey = value => quickMatchFold(value).replace(/\s+/g, '-');

export const quickMatchCategoryToKind = category => {
  if (category === QUICK_MATCH_CATEGORY.LEAGUE) return 'league';
  if (category === QUICK_MATCH_CATEGORY.NATIONAL) return 'nation';
  if (category === QUICK_MATCH_CATEGORY.FEDERATION) return 'federation';
  return 'club';
};

export const quickMatchKindToCategory = kind => {
  if (kind === 'league') return QUICK_MATCH_CATEGORY.LEAGUE;
  if (kind === 'nation') return QUICK_MATCH_CATEGORY.NATIONAL;
  if (kind === 'federation') return QUICK_MATCH_CATEGORY.FEDERATION;
  return QUICK_MATCH_CATEGORY.HUNGARIAN;
};

export const quickMatchMinimumForKind = kind => {
  if (kind === 'nation') return QUICK_MATCH_NATION_MINIMUM;
  if (kind === 'federation') return QUICK_MATCH_FEDERATION_MINIMUM;
  if (kind === 'league') return QUICK_MATCH_LEAGUE_MINIMUM;
  return MIN_FILTERED_DECK_SIZE;
};

export function normaliseQuickMatchSelection(selection) {
  if (!selection || typeof selection !== 'object') return null;
  const kind = QUICK_MATCH_SELECTION_KINDS.has(selection.kind) ? selection.kind : null;
  const value = quickMatchText(selection.value);
  return kind && value ? { kind, value } : null;
}

export function quickMatchSelectionKey(selection) {
  const normalised = normaliseQuickMatchSelection(selection);
  if (!normalised) return '';
  if (normalised.kind === 'club') return canonicalClubKey(normalised.value);
  if (normalised.kind === 'nation') return canonicalNationKey(normalised.value);
  if (normalised.kind === 'federation') return canonicalFederationKey(normalised.value);
  return canonicalLeagueKey(normalised.value);
}

export function quickMatchSelectionEquals(left, right) {
  const a = normaliseQuickMatchSelection(left);
  const b = normaliseQuickMatchSelection(right);
  return Boolean(a && b && a.kind === b.kind && quickMatchSelectionKey(a) === quickMatchSelectionKey(b));
}

export function resolveQuickMatchSelection(players, selection) {
  const pool = quickMatchPlayers(players);
  const normalised = normaliseQuickMatchSelection(selection);
  if (!normalised) return [];
  if (normalised.kind !== 'league') return resolveDeckSelection(pool, normalised);
  const key = quickMatchSelectionKey(normalised);
  return pool.filter(player => canonicalLeagueKey(player?.competition ?? player?.meta?.competition) === key);
}

const quickMatchGroup = (players, keyFor, labelFor) => {
  const groups = new Map();
  for (const player of quickMatchPlayers(players)) {
    const key = keyFor(player);
    if (!key) continue;
    const current = groups.get(key) ?? { key, label: labelFor(player), count: 0 };
    current.count += 1;
    groups.set(key, current);
  }
  return [...groups.values()];
};

const quickMatchEntry = ({
  kind,
  key,
  label,
  count,
  flag = '',
  badge = null,
  colors = null,
  subtitle,
  value = null,
  federationCode = null,
  countryCode = null,
}) => Object.freeze({
  id: `${kind}:${key}`,
  kind,
  key,
  label,
  count,
  flag,
  badge,
  colors,
  subtitle,
  federationCode,
  countryCode,
  minimum: quickMatchMinimumForKind(kind),
  usable: count >= quickMatchMinimumForKind(kind),
  selection: Object.freeze({ kind, value: value ?? (kind === 'nation' || kind === 'federation' ? key : label) }),
});

export function buildQuickMatchCatalog(players) {
  const pool = quickMatchPlayers(players);
  const clubs = quickMatchGroup(
    pool,
    player => canonicalClubKey(player?.clubName ?? player?.club),
    player => quickMatchText(player?.clubName ?? player?.club),
  )
    .filter(entry => entry.count >= MIN_FILTERED_DECK_SIZE)
    .sort((a, b) => a.label.localeCompare(b.label, 'hu-HU'))
    .map(entry => quickMatchEntry({
      ...entry,
      kind: 'club',
      subtitle: 'Klubcsapat',
    }));

  const leagues = quickMatchGroup(
    pool,
    player => canonicalLeagueKey(player?.competition ?? player?.meta?.competition),
    player => quickMatchText(player?.competition ?? player?.meta?.competition),
  )
    .filter(entry => entry.count >= QUICK_MATCH_LEAGUE_MINIMUM)
    .sort((a, b) => a.label.localeCompare(b.label, 'hu-HU'))
    .map(entry => quickMatchEntry({
      ...entry,
      kind: 'league',
      subtitle: 'Liga',
    }));

  const nations = getPlayableNationalTeams(pool, QUICK_MATCH_NATION_MINIMUM)
    .map(team => quickMatchEntry({
      kind: 'nation',
      key: canonicalNationKey(team.countryCode),
      value: team.countryCode,
      label: team.label,
      count: team.count,
      flag: team.flag,
      subtitle: 'Válogatott',
      federationCode: team.federationCode,
      countryCode: team.countryCode,
    }));

  const federations = getPlayableFederationTeams(pool, QUICK_MATCH_FEDERATION_MINIMUM)
    .map(team => quickMatchEntry({
      kind: 'federation',
      key: team.federationCode,
      value: team.federationCode,
      label: team.label,
      count: team.count,
      badge: team.badge,
      colors: team.colors,
      subtitle: 'Föderációs csapat',
      federationCode: team.federationCode,
    }));

  return Object.freeze({
    total: pool.length,
    [QUICK_MATCH_CATEGORY.HUNGARIAN]: Object.freeze(clubs),
    [QUICK_MATCH_CATEGORY.LEAGUE]: Object.freeze(leagues),
    [QUICK_MATCH_CATEGORY.NATIONAL]: Object.freeze(nations),
    [QUICK_MATCH_CATEGORY.FEDERATION]: Object.freeze(federations),
  });
}

export const quickMatchEntriesForCategory = (catalog, category) => (
  Array.isArray(catalog?.[category]) ? catalog[category] : []
);

export function quickMatchEntryFromId(catalog, teamId) {
  const id = quickMatchText(teamId);
  for (const category of Object.values(QUICK_MATCH_CATEGORY)) {
    const entry = quickMatchEntriesForCategory(catalog, category).find(item => item.id === id);
    if (entry) return entry;
  }
  return null;
}

export function quickMatchEntryFromSelection(catalog, selection) {
  const normalised = normaliseQuickMatchSelection(selection);
  if (!normalised) return null;
  const category = quickMatchKindToCategory(normalised.kind);
  const key = quickMatchSelectionKey(normalised);
  return quickMatchEntriesForCategory(catalog, category).find(entry => entry.key === key) ?? null;
}

export function quickMatchSelectionsCompatible(left, right) {
  const a = normaliseQuickMatchSelection(left);
  const b = normaliseQuickMatchSelection(right);
  if (!a || !b) return false;
  if (a.kind === 'club' || b.kind === 'club') return a.kind === 'club' && b.kind === 'club';
  if (a.kind === 'league' || b.kind === 'league') return a.kind === 'league' && b.kind === 'league';
  return ['nation', 'federation'].includes(a.kind) && ['nation', 'federation'].includes(b.kind);
}

export function quickMatchOpponentEntries(catalog, playerEntryOrSelection) {
  const playerEntry = playerEntryOrSelection?.id
    ? playerEntryOrSelection
    : quickMatchEntryFromSelection(catalog, playerEntryOrSelection);
  if (!playerEntry) return [];
  if (playerEntry.kind === 'club') return quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.HUNGARIAN);
  if (playerEntry.kind === 'league') return quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.LEAGUE);
  return [
    ...quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.NATIONAL),
    ...quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.FEDERATION),
  ];
}

export function chooseQuickMatchOpponent(entries, playerTeamId, {
  rng = Math.random,
  avoidTeamIds = [],
} = {}) {
  const candidates = (Array.isArray(entries) ? entries : [])
    .filter(entry => entry.usable && entry.id !== playerTeamId);
  if (!candidates.length) return null;
  const avoided = new Set(avoidTeamIds);
  const fresh = candidates.filter(entry => !avoided.has(entry.id));
  const pool = fresh.length ? fresh : candidates;
  const randomValue = Math.min(.999999999, Math.max(0, Number(rng()) || 0));
  return pool[Math.floor(randomValue * pool.length)] ?? pool[0];
}

export function validateQuickMatchPairing(players, playerSelection, opponentSelection) {
  const player = normaliseQuickMatchSelection(playerSelection);
  const opponent = normaliseQuickMatchSelection(opponentSelection);
  if (!player) return { valid: false, code: 'NO_PLAYER_TEAM', message: 'Válassz egy használható csapatot.' };
  const playerCards = resolveQuickMatchSelection(players, player);
  if (playerCards.length < quickMatchMinimumForKind(player.kind)) {
    return { valid: false, code: 'PLAYER_TEAM_UNAVAILABLE', message: 'Ebben a kategóriában jelenleg nincs elegendő játékoskártyával rendelkező csapat.' };
  }
  if (!opponent) return { valid: false, code: 'NO_OPPONENT', message: 'A kiválasztott csapathoz nincs használható ellenfél.' };
  if (quickMatchSelectionEquals(player, opponent)) {
    return { valid: false, code: 'INVALID_OPPONENT', message: 'Az ellenfél nem lehet azonos a saját csapatoddal.' };
  }
  if (!quickMatchSelectionsCompatible(player, opponent)) {
    return { valid: false, code: 'INCOMPATIBLE_OPPONENT', message: 'Klub csak klubbal, válogatott pedig válogatottal vagy föderációs csapattal játszhat.' };
  }
  const opponentCards = resolveQuickMatchSelection(players, opponent);
  if (opponentCards.length < quickMatchMinimumForKind(opponent.kind)) {
    return { valid: false, code: 'OPPONENT_UNAVAILABLE', message: 'A kisorsolt ellenfélhez nincs elegendő használható játékoskártya.' };
  }
  return { valid: true, player, opponent, playerCards, opponentCards };
}

export function describeQuickMatchSelection(selection, players = []) {
  const normalised = normaliseQuickMatchSelection(selection);
  if (!normalised) return 'Nincs kiválasztott csapat';
  const count = resolveQuickMatchSelection(players, normalised).length;
  if (normalised.kind === 'nation') {
    const nation = nationPresentation(normalised.value);
    return `${nation.flag} ${nation.label} válogatott · ${count} játékoskártya`;
  }
  if (normalised.kind === 'federation') {
    const federation = federationPresentation(normalised.value);
    return `${federation.label} föderációs csapat · ${count} játékoskártya`;
  }
  return `${normalised.value} · ${count} játékoskártya`;
}

const quickMatchDescriptor = (selection, count) => {
  const normalised = normaliseQuickMatchSelection(selection);
  const key = quickMatchSelectionKey(normalised);
  if (normalised.kind === 'nation') {
    const nation = nationPresentation(normalised.value);
    return Object.freeze({
      kind: 'nation', key, value: nation.countryCode ?? nation.key, label: `${nation.label} válogatott`, icon: nation.flag, count,
    });
  }
  if (normalised.kind === 'federation') {
    const federation = federationPresentation(normalised.value);
    return Object.freeze({
      kind: 'federation', key, value: federation.code, label: federation.label,
      icon: federation.asset, badge: federation.asset, colors: federation.colors, count,
    });
  }
  return Object.freeze({
    kind: normalised.kind,
    key,
    value: normalised.value,
    label: normalised.value,
    icon: normalised.kind === 'league' ? '🏆' : '🛡️',
    count,
  });
};

const quickMatchDecorate = (players, side, team) => players.map(player => ({
  ...player,
  meta: {
    ...(player?.meta ?? {}),
    quickMatchSide: side,
    quickMatchTeamKind: team.kind,
    quickMatchTeamKey: team.key,
    quickMatchTeamLabel: team.label,
  },
}));

export function buildQuickMatchPayload(payload, playerSelection, opponentSelection = null, rng = Math.random) {
  const players = quickMatchPlayers(Array.isArray(payload) ? payload : payload?.players);
  const player = normaliseQuickMatchSelection(playerSelection);
  if (!player) return { payload: applyDeckSelectionToPayload(payload, { kind: 'random', value: '' }), matchup: null };

  const catalog = buildQuickMatchCatalog(players);
  const playerEntry = quickMatchEntryFromSelection(catalog, player);
  if (!playerEntry) return { payload: applyDeckSelectionToPayload(payload, { kind: 'random', value: '' }), matchup: null };

  let opponent = normaliseQuickMatchSelection(opponentSelection);
  let opponentEntry = quickMatchEntryFromSelection(catalog, opponent);
  if (!opponentEntry
    || opponentEntry.id === playerEntry.id
    || !quickMatchSelectionsCompatible(playerEntry.selection, opponentEntry.selection)) {
    opponentEntry = chooseQuickMatchOpponent(
      quickMatchOpponentEntries(catalog, playerEntry),
      playerEntry.id,
      { rng },
    );
    opponent = opponentEntry?.selection ?? null;
  }

  const checked = validateQuickMatchPairing(players, playerEntry.selection, opponent);
  if (!checked.valid) return { payload: applyDeckSelectionToPayload(payload, { kind: 'random', value: '' }), matchup: null };

  const humanTeam = quickMatchDescriptor(checked.player, checked.playerCards.length);
  const aiTeam = quickMatchDescriptor(checked.opponent, checked.opponentCards.length);
  const matchup = Object.freeze({
    enabled: true,
    category: quickMatchKindToCategory(checked.player.kind),
    opponentCategory: quickMatchKindToCategory(checked.opponent.kind),
    human: humanTeam,
    ai: aiTeam,
  });
  const deckMeta = {
    ...checked.player,
    label: describeQuickMatchSelection(checked.player, players),
    availableCards: checked.playerCards.length,
    minimumCards: quickMatchMinimumForKind(checked.player.kind),
  };
  const selectedPlayers = [
    ...quickMatchDecorate(checked.playerCards, 'human', humanTeam),
    ...quickMatchDecorate(checked.opponentCards, 'ai', aiTeam),
  ];

  if (Array.isArray(payload)) return { payload: selectedPlayers, matchup };
  return {
    matchup,
    payload: {
      ...(payload ?? {}),
      players: selectedPlayers,
      deckSelection: deckMeta,
      quickMatch: matchup,
      selection: {
        ...(payload?.selection ?? {}),
        deckSelection: deckMeta,
        quickMatch: matchup,
      },
    },
  };
}
