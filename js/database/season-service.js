/** Szezonközpontú homlokzat a regisztrált adatbázisok betöltéséhez. */

import {
  getAvailableSeasons as getRegisteredSeasons,
  getDatabaseBySeason as getRegisteredDatabaseBySeason,
  getDefaultSeason as getRegisteredDefaultSeason,
} from './database-registry.js';
import { loadDatabase } from './database-service.js';
import { createSeasonCardId, deriveSeasonId } from './season-model.js';

const asText = value => typeof value === 'string' ? value.trim() : '';
const safeArray = value => Array.isArray(value) ? value : [];

export function attachSeasonContextToPayload(payload, database = {}) {
  const source = Array.isArray(payload) ? { players: payload } : (payload ?? {});
  const databaseId = asText(database.id || source.databaseId);
  const competitionId = asText(database.competitionId || source.competitionId);
  const seasonId = deriveSeasonId(database.seasonId || source.seasonId || database.season || source.season);
  const season = asText(database.season || database.seasonMeta?.label || source.season);
  const seasonMeta = database.seasonMeta ?? source.seasonMeta ?? null;
  const players = safeArray(source.players).map(player => ({
    ...player,
    databaseId: asText(player?.databaseId) || databaseId || null,
    competitionId: asText(player?.competitionId) || competitionId || null,
    seasonId: deriveSeasonId(player?.seasonId || player?.season) || seasonId || null,
    season: asText(player?.season) || season || null,
    cardId: asText(player?.cardId) || createSeasonCardId(
      deriveSeasonId(player?.seasonId || player?.season) || seasonId,
      player?.id,
    ) || null,
  }));

  return {
    ...source,
    databaseId: databaseId || null,
    competitionId: competitionId || null,
    seasonId: seasonId || null,
    season: season || null,
    seasonMeta,
    players,
  };
}

export function attachSeasonContextToSnapshot(snapshot) {
  if (!snapshot?.database) return snapshot;
  const database = snapshot.database;
  const payload = attachSeasonContextToPayload(snapshot.payload, database);
  const playablePayload = attachSeasonContextToPayload(snapshot.playablePayload, database);
  return Object.freeze({
    ...snapshot,
    payload: Object.freeze(payload),
    playablePayload: Object.freeze(playablePayload),
    players: Object.freeze([...payload.players]),
    playablePlayers: Object.freeze([...playablePayload.players]),
    statistics: Object.freeze({
      ...(snapshot.statistics ?? {}),
      databaseId: database.id,
      competitionId: database.competitionId,
      seasonId: database.seasonId,
      season: database.season,
      seasonMeta: database.seasonMeta,
    }),
  });
}

export async function getAvailableSeasons({ competitionId = '' } = {}) {
  const competition = asText(competitionId);
  const seasons = await getRegisteredSeasons();
  return seasons.filter(season => !competition || season.competitionId === competition);
}

export async function getDefaultSeason() {
  return getRegisteredDefaultSeason();
}

export async function loadSeason(seasonId, {
  competitionId = '',
  ...options
} = {}) {
  const database = await getRegisteredDatabaseBySeason(seasonId, { competitionId });
  if (!database) {
    const scope = competitionId ? ` a(z) ${competitionId} versenysorozatban` : '';
    throw new Error(`Ismeretlen vagy letiltott szezon${scope}: ${seasonId}`);
  }
  return attachSeasonContextToSnapshot(await loadDatabase(database.id, options));
}

export async function loadActiveSeason({
  databaseId = '',
  seasonId = '',
  competitionId = '',
  ...options
} = {}) {
  if (asText(databaseId)) return attachSeasonContextToSnapshot(await loadDatabase(databaseId, options));
  if (deriveSeasonId(seasonId)) return loadSeason(seasonId, { competitionId, ...options });
  return attachSeasonContextToSnapshot(await loadDatabase(undefined, options));
}
