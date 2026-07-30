/** DOM- és tárolásfüggetlen pakliválasztási domainlogika. */

import {
  canonicalNationalityKey,
  nationalityPresentation as centralNationalityPresentation,
  resolvePlayerNationality,
} from '../data/nationalities.js';
import { federationPresentation, normaliseFederationCode } from '../data/federations.js';
import {
  getPlayableFederationTeams,
  getPlayableNationalTeams,
  getPlayerFederation,
  isPlayablePlayer,
} from './federation-domain.js';

export const MIN_FILTERED_DECK_SIZE = 11;
// Önálló/Android buildben is betöltési sorrendtől független, a federation-domain tesztjeivel szinkronban tartott szabály.
export const MIN_NATIONAL_DECK_SIZE = 8;

export const RANDOM_DECK_SELECTION = Object.freeze({
  kind: 'random',
  value: '',
});

const DECK_DOMAIN_SELECTION_KINDS = new Set(['random', 'club', 'nation', 'federation']);

const deckDomainFold = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU')
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const deckDomainPlayers = players => (Array.isArray(players) ? players : []);

const deckDomainGroupBy = (players, keyFor, labelFor) => {
  const groups = new Map();
  for (const player of deckDomainPlayers(players)) {
    if (!isPlayablePlayer(player)) continue;
    const key = keyFor(player);
    if (!key) continue;
    const current = groups.get(key) ?? { key, label: labelFor(player), count: 0 };
    current.count += 1;
    groups.set(key, current);
  }
  return [...groups.values()];
};

const playerNationValue = player => {
  const resolved = resolvePlayerNationality(player);
  return resolved.countryCode
    ?? player?.countryCode
    ?? player?.nationalTeam
    ?? player?.nationality
    ?? player?.nation
    ?? player?.nationalityCode;
};

const deckSelectionMinimum = (kind, fallback = MIN_FILTERED_DECK_SIZE) => (
  kind === 'nation' ? MIN_NATIONAL_DECK_SIZE : fallback
);

export const canonicalClubKey = value => deckDomainFold(value);

export function canonicalNationKey(value) {
  return canonicalNationalityKey(value) || deckDomainFold(value).replace(/\s+/g, '-');
}

export function canonicalFederationKey(value) {
  return normaliseFederationCode(value) ?? String(value ?? '').trim().toLocaleUpperCase('en-US');
}

export function nationPresentation(value) {
  const presentation = centralNationalityPresentation(value);
  return {
    key: presentation.known ? presentation.key : canonicalNationKey(value),
    flag: presentation.known ? presentation.flag : '🌍',
    label: presentation.label,
    countryCode: presentation.countryCode,
    federationCode: presentation.federationCode,
  };
}

export function buildDeckSelectionOptions(players, minimum = MIN_FILTERED_DECK_SIZE) {
  const pool = deckDomainPlayers(players);
  const clubs = deckDomainGroupBy(
    pool,
    player => canonicalClubKey(player?.clubName ?? player?.club),
    player => String(player?.clubName ?? player?.club ?? '').trim(),
  )
    .filter(item => item.count >= minimum)
    .sort((a, b) => a.label.localeCompare(b.label, 'hu-HU'));

  const nations = getPlayableNationalTeams(pool, MIN_NATIONAL_DECK_SIZE).map(team => ({
    key: canonicalNationKey(team.countryCode),
    label: team.label,
    flag: team.flag,
    countryCode: team.countryCode,
    federationCode: team.federationCode,
    count: team.count,
  }));

  const federations = getPlayableFederationTeams(pool, minimum).map(team => ({
    key: team.federationCode,
    label: team.label,
    federationCode: team.federationCode,
    badge: team.badge,
    colors: team.colors,
    count: team.count,
  }));

  return {
    minimum,
    nationMinimum: MIN_NATIONAL_DECK_SIZE,
    total: pool.length,
    clubs,
    nations,
    federations,
  };
}

export function normaliseDeckSelection(selection) {
  if (!selection || typeof selection !== 'object') return { ...RANDOM_DECK_SELECTION };
  const kind = DECK_DOMAIN_SELECTION_KINDS.has(selection.kind) ? selection.kind : 'random';
  if (kind === 'random') return { ...RANDOM_DECK_SELECTION };
  const value = String(selection.value ?? '').trim();
  return value ? { kind, value } : { ...RANDOM_DECK_SELECTION };
}

export function selectionEquals(left, right) {
  const a = normaliseDeckSelection(left);
  const b = normaliseDeckSelection(right);
  if (a.kind !== b.kind) return false;
  if (a.kind === 'club') return canonicalClubKey(a.value) === canonicalClubKey(b.value);
  if (a.kind === 'nation') return canonicalNationKey(a.value) === canonicalNationKey(b.value);
  if (a.kind === 'federation') return canonicalFederationKey(a.value) === canonicalFederationKey(b.value);
  return true;
}

export function resolveDeckSelection(players, selection) {
  const pool = deckDomainPlayers(players).filter(isPlayablePlayer);
  const normalised = normaliseDeckSelection(selection);
  if (normalised.kind === 'club') {
    const key = canonicalClubKey(normalised.value);
    return pool.filter(player => canonicalClubKey(player?.clubName ?? player?.club) === key);
  }
  if (normalised.kind === 'nation') {
    const key = canonicalNationKey(normalised.value);
    return pool.filter(player => canonicalNationKey(playerNationValue(player)) === key);
  }
  if (normalised.kind === 'federation') {
    const key = canonicalFederationKey(normalised.value);
    return pool.filter(player => getPlayerFederation(player).federationCode === key);
  }
  return pool.slice();
}

export function validateDeckSelection(players, selection, minimum = MIN_FILTERED_DECK_SIZE) {
  const normalised = normaliseDeckSelection(selection);
  const selectedPlayers = resolveDeckSelection(players, normalised);
  const required = deckSelectionMinimum(normalised.kind, minimum);
  if (normalised.kind !== 'random' && selectedPlayers.length < required) {
    return {
      selection: { ...RANDOM_DECK_SELECTION },
      players: deckDomainPlayers(players).filter(isPlayablePlayer),
      valid: false,
    };
  }
  return { selection: normalised, players: selectedPlayers, valid: true };
}

export function describeDeckSelection(selection, players = []) {
  const normalised = normaliseDeckSelection(selection);
  const count = resolveDeckSelection(players, normalised).length;
  if (normalised.kind === 'club') return `Klub: ${normalised.value} · ${count} kártya`;
  if (normalised.kind === 'nation') {
    const nation = nationPresentation(normalised.value);
    return `Ligaválogatott: ${nation.flag} ${nation.label} · ${count} kártya`;
  }
  if (normalised.kind === 'federation') {
    const federation = federationPresentation(normalised.value);
    return `Föderáció: ${federation.label} · ${count} kártya`;
  }
  return `Véletlen kártyák · ${count} lapos adatbázis`;
}

export function applyDeckSelectionToPayload(payload, selection) {
  const sourcePlayers = Array.isArray(payload) ? payload : payload?.players;
  const checked = validateDeckSelection(sourcePlayers, selection);
  const deckMeta = {
    ...checked.selection,
    label: describeDeckSelection(checked.selection, sourcePlayers),
    availableCards: checked.players.length,
    minimumCards: deckSelectionMinimum(checked.selection.kind),
  };

  if (Array.isArray(payload)) return checked.players;
  return {
    ...(payload ?? {}),
    players: checked.players,
    deckSelection: deckMeta,
    selection: {
      ...(payload?.selection ?? {}),
      deckSelection: deckMeta,
    },
  };
}
