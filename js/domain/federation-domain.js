/** DOM-mentes ország-, válogatott- és föderációs csapatlogika. */

import {
  countryCodeToFlagEmoji,
  countryCodeToNationality,
  nationalityPresentation,
  normaliseCountryCode,
  resolvePlayerNationality,
} from '../data/nationalities.js';
import {
  FEDERATION_DEFINITIONS,
  FEDERATION_TEAM_MINIMUM,
  federationPresentation,
  resolveFederationByCountryCode,
} from '../data/federations.js';

export const MINIMUM_TEAM_SIZE = FEDERATION_TEAM_MINIMUM;
export const NATIONAL_TEAM_MINIMUM = 8;

const federationDomainPlayers = players => (Array.isArray(players) ? players : []);
const federationDomainText = value => String(value ?? '').trim();
const federationDomainPlayerIdentity = (player, index = 0) => (
  federationDomainText(player?.id) || `${federationDomainText(player?.name) || 'player'}:${index}`
);

export function isPlayablePlayer(player) {
  if (!player || typeof player !== 'object') return false;
  if (!federationDomainText(player.id) || !federationDomainText(player.name ?? player.displayName)) return false;
  if (player.playable === false || player.disabled === true || player.meta?.disabled === true || player.meta?.excluded === true) return false;
  if (player.meta?.fictional === true) return false;
  return true;
}

export function getCountryData(value) {
  const presentation = nationalityPresentation(value);
  if (!presentation.known) {
    return Object.freeze({
      nationality: null,
      countryCode: null,
      federation: null,
      federationCode: null,
      federationLabel: null,
      flag: '🌐',
      known: false,
    });
  }
  const federation = resolveFederationByCountryCode(presentation.countryCode);
  return Object.freeze({
    nationality: presentation.nationality,
    countryCode: presentation.countryCode,
    federation: federation.federation,
    federationCode: federation.federationCode,
    federationLabel: federation.federationLabel,
    flag: presentation.flag,
    known: federation.known,
  });
}

export function getPlayerFederation(player = {}) {
  const nationality = resolvePlayerNationality(player);
  const countryCode = normaliseCountryCode(nationality.countryCode ?? player.countryCode);
  const federation = resolveFederationByCountryCode(countryCode);
  return Object.freeze({
    playerId: player.id ?? null,
    playerName: player.name ?? player.displayName ?? null,
    nationality: nationality.nationality ?? (countryCode ? countryCodeToNationality[countryCode] : null),
    countryCode,
    federation: federation.federation,
    federationCode: federation.federationCode,
    federationLabel: federation.federationLabel,
    known: Boolean(countryCode && federation.known),
  });
}

const federationDomainGroupUniquePlayers = (players, keyFor, metaFor) => {
  const groups = new Map();
  federationDomainPlayers(players).forEach((player, index) => {
    if (!isPlayablePlayer(player)) return;
    const key = keyFor(player);
    if (!key) return;
    const identity = federationDomainPlayerIdentity(player, index);
    const current = groups.get(key) ?? { key, players: [], identities: new Set(), ...metaFor(player) };
    if (!current.identities.has(identity)) {
      current.identities.add(identity);
      current.players.push(player);
    }
    groups.set(key, current);
  });
  return [...groups.values()].map(({ identities, ...group }) => Object.freeze({
    ...group,
    players: Object.freeze(group.players.slice()),
    playerIds: Object.freeze(group.players.map(player => player.id)),
    count: group.players.length,
  }));
};

export function groupPlayersByCountry(players) {
  return federationDomainGroupUniquePlayers(
    players,
    player => getPlayerFederation(player).countryCode,
    player => {
      const resolved = getPlayerFederation(player);
      const presentation = nationalityPresentation(resolved.countryCode);
      return {
        countryCode: resolved.countryCode,
        nationality: resolved.nationality,
        label: presentation.label,
        flag: presentation.flag,
        federation: resolved.federation,
        federationCode: resolved.federationCode,
      };
    },
  );
}

export function groupPlayersByFederation(players) {
  return federationDomainGroupUniquePlayers(
    players,
    player => getPlayerFederation(player).federationCode,
    player => {
      const resolved = getPlayerFederation(player);
      const presentation = federationPresentation(resolved.federationCode);
      return {
        federation: resolved.federation,
        federationCode: resolved.federationCode,
        label: presentation.label,
        asset: presentation.asset,
        colors: presentation.colors,
      };
    },
  );
}

export function getPlayableNationalTeams(players, minimumPlayers = NATIONAL_TEAM_MINIMUM) {
  return groupPlayersByCountry(players)
    .filter(group => group.count >= minimumPlayers)
    .map(group => Object.freeze({
      id: `nation:${group.countryCode}`,
      type: 'national',
      kind: 'nation',
      key: group.countryCode,
      value: group.countryCode,
      name: `${group.label} ligaválogatott`,
      label: `${group.label} ligaválogatott`,
      countryCode: group.countryCode,
      federation: group.federation,
      federationCode: group.federationCode,
      flag: group.flag || countryCodeToFlagEmoji(group.countryCode),
      playerIds: group.playerIds,
      players: group.players,
      playerCount: group.count,
      count: group.count,
      minimum: minimumPlayers,
      usable: true,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'hu-HU'));
}

export function getPlayableFederationTeams(players, minimumPlayers = MINIMUM_TEAM_SIZE) {
  return groupPlayersByFederation(players)
    .filter(group => group.count >= minimumPlayers)
    .map(group => {
      const presentation = federationPresentation(group.federationCode);
      return Object.freeze({
        id: `federation:${group.federationCode}`,
        type: 'federation',
        kind: 'federation',
        key: group.federationCode,
        value: group.federationCode,
        name: presentation.label,
        label: presentation.label,
        federation: presentation.name,
        federationCode: presentation.code,
        badge: presentation.asset,
        asset: presentation.asset,
        colors: presentation.colors,
        playerIds: group.playerIds,
        players: group.players,
        playerCount: group.count,
        count: group.count,
        minimum: minimumPlayers,
        usable: true,
      });
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'hu-HU'));
}

export function validatePlayerFederationData(players, minimumPlayers = MINIMUM_TEAM_SIZE) {
  const list = federationDomainPlayers(players);
  const missingFederation = [];
  const unmappedCountries = new Map();
  const contradictions = [];
  const duplicatePlayerIds = [];
  const seenIds = new Set();

  list.forEach(player => {
    const resolved = getPlayerFederation(player);
    const name = player?.name ?? player?.id ?? 'Ismeretlen játékos';
    if (player?.id && seenIds.has(player.id)) duplicatePlayerIds.push(player.id);
    if (player?.id) seenIds.add(player.id);
    if (!resolved.countryCode) {
      unmappedCountries.set(federationDomainText(player?.nationality ?? player?.nation) || 'Ismeretlen', null);
      return;
    }
    if (!resolved.federationCode) {
      missingFederation.push(name);
      unmappedCountries.set(resolved.countryCode, resolved.countryCode);
    }
    const explicitFederationCode = federationDomainText(player?.federationCode).toLocaleUpperCase('en-US');
    if (explicitFederationCode && resolved.federationCode && explicitFederationCode !== resolved.federationCode) {
      contradictions.push({
        playerId: player.id ?? null,
        playerName: name,
        countryCode: resolved.countryCode,
        expectedFederationCode: resolved.federationCode,
        actualFederationCode: explicitFederationCode,
      });
    }
  });

  const countryGroups = groupPlayersByCountry(list);
  const federationGroups = groupPlayersByFederation(list);
  const playableNationalTeams = getPlayableNationalTeams(list, NATIONAL_TEAM_MINIMUM);
  const playableFederationTeams = getPlayableFederationTeams(list, minimumPlayers);

  return Object.freeze({
    missingFederation: Object.freeze(missingFederation),
    unmappedCountries: Object.freeze([...unmappedCountries.keys()]),
    contradictions: Object.freeze(contradictions),
    duplicatePlayerIds: Object.freeze(duplicatePlayerIds),
    countries: Object.freeze(countryGroups.map(group => Object.freeze({
      countryCode: group.countryCode,
      nationality: group.nationality,
      federationCode: group.federationCode,
      playerCount: group.count,
      playable: group.count >= NATIONAL_TEAM_MINIMUM,
    }))),
    federations: Object.freeze(Object.keys(FEDERATION_DEFINITIONS).map(federationCode => {
      const group = federationGroups.find(item => item.federationCode === federationCode);
      const presentation = federationPresentation(federationCode);
      return Object.freeze({
        federationCode,
        label: presentation.label,
        playerCount: group?.count ?? 0,
        playable: (group?.count ?? 0) >= minimumPlayers,
      });
    })),
    playableNationalTeams: Object.freeze(playableNationalTeams),
    playableFederationTeams: Object.freeze(playableFederationTeams),
    summary: Object.freeze({
      playerCount: list.length,
      playablePlayerCount: list.filter(isPlayablePlayer).length,
      mappedCountryCount: countryGroups.length,
      missingFederationCount: missingFederation.length,
      unmappedCountryCount: unmappedCountries.size,
      contradictionCount: contradictions.length,
      duplicatePlayerIdCount: duplicatePlayerIds.length,
      playableNationalTeamCount: playableNationalTeams.length,
      playableFederationTeamCount: playableFederationTeams.length,
    }),
  });
}
