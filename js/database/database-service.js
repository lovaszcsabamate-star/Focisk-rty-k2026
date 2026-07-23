/** Central database access layer for manifests, players, clubs, filters and validation. */

import {
  getAvailableDatabases as getRegisteredDatabases,
  getDatabaseById as getRegisteredDatabaseById,
  getDefaultDatabase as getRegisteredDefaultDatabase,
} from './database-registry.js';
import {
  applyClubEnrichmentPayload,
  prepareClubEnrichment,
} from '../data/club-enrichment.js';
import { applyOfficialStatPatches } from '../data/club-stat-patches.js';
import { filterCompleteCardsPayload } from '../data/complete-cards.js';
import { applyVerifiedPlayerCorrections } from '../data/verified-player-corrections.js';
import {
  normalisePlayerPayload,
  validatePlayerPayload,
} from '../models/player-model.js';

export const DEFAULT_ELIGIBLE_PLAYER_COUNT = 11;

const safeArray = value => (Array.isArray(value) ? value : []);
const asText = value => (typeof value === 'string' ? value.trim() : '');
const fold = value => asText(String(value ?? ''))
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const defaultFetchJson = async url => {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.json();
};

function combineEnrichments(parts, directory) {
  const valid = safeArray(parts).filter(part => part && Array.isArray(part.records));
  if (!valid.length) return null;
  return {
    ...valid[0],
    generatedAt: valid.at(-1)?.generatedAt ?? valid[0].generatedAt,
    sources: valid.flatMap(part => part.sources ?? []),
    records: valid.flatMap(part => part.records ?? []),
    clubDirectory: safeArray(directory?.clubs),
  };
}

function combineCorrections(parts) {
  const valid = safeArray(parts).filter(Boolean);
  return {
    schemaVersion: 1,
    checkedAt: valid.at(-1)?.checkedAt ?? null,
    addSources: valid.flatMap(part => part.addSources ?? []),
    recordPatches: valid.flatMap(part => part.recordPatches ?? []),
    verifiedCorrections: valid.flatMap(part => part.verifiedCorrections ?? []),
    excludeRecords: valid.flatMap(part => part.excludeRecords ?? []),
    additions: valid.flatMap(part => part.additions ?? []),
  };
}

function validateNormalizedPayload(payload, database) {
  if (!payload || !Array.isArray(payload.players)
    || payload.players.length < database.minimumPlayers) {
    throw new Error('A normalizált adatfájl nem tartalmaz elegendő játékosrekordot.');
  }
  if (payload.databaseId && payload.databaseId !== database.id) {
    throw new Error(`A normalizált adatfájl másik adatbázishoz tartozik: ${payload.databaseId}`);
  }
  const requiredModelVersion = database.normalization?.playerModelVersion;
  if (requiredModelVersion != null && payload.playerModel?.version !== requiredModelVersion) {
    throw new Error(
      `Nem támogatott játékosmodell: ${payload.playerModel?.version ?? 'ismeretlen'}; `
      + `elvárt: ${requiredModelVersion}`,
    );
  }
  if ((payload.playerModel?.validation?.errorCount ?? 0) > 0) {
    throw new Error('A normalizált adatfájl kritikus validációs hibát jelez.');
  }
  return payload;
}

function normaliseClubs(directory, database) {
  return safeArray(directory?.clubs).map(club => Object.freeze({
    ...club,
    id: asText(club.id || club.clubId),
    name: asText(club.name || club.clubName),
    shortName: asText(club.shortName || club.clubName || club.name),
    country: asText(club.country || database.country),
    primaryColor: asText(club.primaryColor) || null,
    secondaryColor: asText(club.secondaryColor) || null,
    logo: asText(club.logo) || null,
    season: asText(club.season || database.season),
  }));
}

function playerClubKey(player) {
  return asText(player?.clubId) || fold(player?.clubName || player?.club);
}

function nationalityTokens(player) {
  const raw = asText(player?.nationalityCode || player?.nation || player?.nationality);
  if (!raw) return [];
  return [...new Set(raw.split('/').map(value => value.trim().toLocaleUpperCase('hu-HU')).filter(Boolean))];
}

function createValidation({ database, payload, clubs, playablePlayers, source, directoryError }) {
  const result = validatePlayerPayload(payload.players);
  const errors = [...result.errors];
  const warnings = [...result.warnings];
  const information = [...result.information];

  if (payload.players.length < database.minimumPlayers) {
    errors.push(
      `Az adatbázisban nincs elegendő játékos: ${payload.players.length}/${database.minimumPlayers}.`,
    );
  }
  if (playablePlayers.length < database.minimumPlayers) {
    errors.push(
      `Nincs elegendő játszható játékos: ${playablePlayers.length}/${database.minimumPlayers}.`,
    );
  }

  const clubIds = clubs.map(club => club.id).filter(Boolean);
  if (new Set(clubIds).size !== clubIds.length) errors.push('Duplikált klubazonosító található.');
  if (directoryError) warnings.push(`A klubjegyzék nem tölthető be: ${directoryError.message}`);

  if (clubIds.length) {
    const knownClubIds = new Set(clubIds);
    const unknownClubIds = [...new Set(
      payload.players.map(player => asText(player.clubId)).filter(id => id && !knownClubIds.has(id)),
    )];
    if (unknownClubIds.length) {
      warnings.push(`Ismeretlen klubazonosítók: ${unknownClubIds.join(', ')}`);
    }
  }

  information.push(`Adatforrás: ${source}`);
  information.push(`Játékosok: ${payload.players.length}; játszható: ${playablePlayers.length}`);

  return Object.freeze({
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    information: Object.freeze(information),
    summary: Object.freeze({
      playerCount: payload.players.length,
      playablePlayerCount: playablePlayers.length,
      clubCount: clubs.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      informationCount: information.length,
      valid: errors.length === 0,
    }),
  });
}

function createStatistics({ database, payload, playablePlayers, clubs, source }) {
  const nations = new Map();
  for (const player of playablePlayers) {
    for (const code of nationalityTokens(player)) {
      nations.set(code, (nations.get(code) ?? 0) + 1);
    }
  }

  const clubCounts = new Map();
  for (const player of playablePlayers) {
    const key = playerClubKey(player);
    if (key) clubCounts.set(key, (clubCounts.get(key) ?? 0) + 1);
  }

  return Object.freeze({
    databaseId: database.id,
    databaseVersion: database.version,
    season: database.season,
    competition: database.competition,
    source,
    playerCount: payload.players.length,
    playablePlayerCount: playablePlayers.length,
    excludedPlayerCount: payload.players.length - playablePlayers.length,
    clubCount: clubs.length || clubCounts.size,
    nationalityCount: nations.size,
    modelVersion: payload.playerModel?.version ?? null,
    supportedModes: Object.freeze([...(database.supportedModes ?? [])]),
    supportedDeckSelections: Object.freeze([...(database.supportedDeckSelections ?? [])]),
  });
}

export class DatabaseValidationError extends Error {
  constructor(databaseId, validation) {
    super(`Az adatbázis nem használható (${databaseId}): ${validation.errors.join('; ')}`);
    this.name = 'DatabaseValidationError';
    this.databaseId = databaseId;
    this.validation = validation;
  }
}

export function createDatabaseService({
  listDatabases = getRegisteredDatabases,
  findDatabase = getRegisteredDatabaseById,
  findDefaultDatabase = getRegisteredDefaultDatabase,
  fetchJson = defaultFetchJson,
  logger = console,
} = {}) {
  const jsonCache = new Map();
  const snapshotCache = new Map();

  const fetchCached = (url, { forceReload = false } = {}) => {
    if (!url) return Promise.reject(new Error('Hiányzó adatfájl-útvonal.'));
    if (forceReload) jsonCache.delete(url);
    if (!jsonCache.has(url)) {
      jsonCache.set(url, Promise.resolve(fetchJson(url)).catch(error => {
        jsonCache.delete(url);
        throw error;
      }));
    }
    return jsonCache.get(url);
  };

  const resolveDatabase = async databaseId => {
    if (!asText(databaseId)) return findDefaultDatabase();
    const database = await findDatabase(asText(databaseId));
    if (!database) throw new Error(`Ismeretlen vagy letiltott adatbázis: ${databaseId}`);
    return database;
  };

  const loadLegacyLayeredPayload = async (database, options) => {
    const files = database.files ?? {};
    const enrichmentFiles = safeArray(files.enrichments);
    const correctionFiles = safeArray(files.corrections);
    const statPatchFiles = safeArray(files.statPatches);

    const optionalPart = async (url, kind) => fetchCached(url, options).catch(error => {
      logger.warn?.(`[database] ${kind} nem tölthető be (${url}): ${error.message}`);
      return null;
    });

    const [basePayload, enrichmentParts, correctionParts, statPatchParts, directory] = await Promise.all([
      fetchCached(files.players, options),
      Promise.all(enrichmentFiles.map(url => optionalPart(url, 'Kiegészítési réteg'))),
      Promise.all(correctionFiles.map(url => optionalPart(url, 'Korrekciós réteg'))),
      Promise.all(statPatchFiles.map(url => optionalPart(url, 'Statisztikai réteg'))),
      optionalPart(files.clubDirectory, 'Klubjegyzék'),
    ]);

    const corrections = combineCorrections(correctionParts);
    const correctedPayload = applyVerifiedPlayerCorrections(
      basePayload,
      corrections.verifiedCorrections,
    );
    const enrichment = prepareClubEnrichment(
      combineEnrichments(enrichmentParts, directory),
      corrections,
    );
    const enrichedPayload = enrichment
      ? applyClubEnrichmentPayload(correctedPayload, enrichment)
      : correctedPayload;
    return applyOfficialStatPatches(enrichedPayload, statPatchParts);
  };

  const loadSourcePayload = async (database, options) => {
    const files = database.files ?? {};
    if (files.normalizedPlayers) {
      try {
        return {
          payload: validateNormalizedPayload(
            await fetchCached(files.normalizedPlayers, options),
            database,
          ),
          source: 'normalized',
        };
      } catch (error) {
        logger.warn?.(
          `[database] A normalizált adatbázis nem használható (${files.normalizedPlayers}): `
          + `${error.message}. Visszaállás a régi forrásrétegekre.`,
        );
      }
    }
    return {
      payload: await loadLegacyLayeredPayload(database, options),
      source: 'legacy-fallback',
    };
  };

  const buildSnapshot = async (databaseId, {
    forceReload = false,
    allowInvalid = false,
  } = {}) => {
    const database = await resolveDatabase(databaseId);
    const options = { forceReload };
    let directoryError = null;
    const [loaded, directory] = await Promise.all([
      loadSourcePayload(database, options),
      fetchCached(database.files?.clubDirectory, options).catch(error => {
        directoryError = error;
        return { clubs: [] };
      }),
    ]);

    const payload = normalisePlayerPayload(loaded.payload, { database });
    const playablePayload = filterCompleteCardsPayload(payload, {
      minimumCards: database.minimumPlayers,
      playerModel: { database },
    });
    const clubs = normaliseClubs(directory, database);
    const validation = createValidation({
      database,
      payload,
      clubs,
      playablePlayers: playablePayload.players,
      source: loaded.source,
      directoryError,
    });
    if (!allowInvalid && validation.errors.length) {
      throw new DatabaseValidationError(database.id, validation);
    }

    return Object.freeze({
      database: Object.freeze({ ...database }),
      source: loaded.source,
      payload: Object.freeze(payload),
      playablePayload: Object.freeze(playablePayload),
      players: Object.freeze([...payload.players]),
      playablePlayers: Object.freeze([...playablePayload.players]),
      clubs: Object.freeze(clubs),
      validation,
      statistics: createStatistics({
        database,
        payload,
        playablePlayers: playablePayload.players,
        clubs,
        source: loaded.source,
      }),
    });
  };

  const loadDatabase = async (databaseId, options = {}) => {
    const database = await resolveDatabase(databaseId);
    const key = database.id;
    if (options.forceReload) snapshotCache.delete(key);
    if (!snapshotCache.has(key)) {
      snapshotCache.set(key, buildSnapshot(key, options).catch(error => {
        snapshotCache.delete(key);
        throw error;
      }));
    }
    return snapshotCache.get(key);
  };

  const getAvailableDatabases = async () => (
    await listDatabases()
  ).map(database => Object.freeze({ ...database }));

  const getDatabaseById = async databaseId => {
    const database = await findDatabase(asText(databaseId));
    return database ? Object.freeze({ ...database }) : null;
  };

  const getAllPlayers = async (databaseId, { playable = false, ...options } = {}) => {
    const snapshot = await loadDatabase(databaseId, options);
    return [...(playable ? snapshot.playablePlayers : snapshot.players)];
  };

  const getAllClubs = async (databaseId, options = {}) => {
    const snapshot = await loadDatabase(databaseId, options);
    return [...snapshot.clubs];
  };

  const getPlayersByClub = async (databaseId, clubId, {
    playable = true,
    ...options
  } = {}) => {
    const snapshot = await loadDatabase(databaseId, options);
    const pool = playable ? snapshot.playablePlayers : snapshot.players;
    const requested = asText(clubId);
    const requestedFolded = fold(requested);
    const club = snapshot.clubs.find(item => item.id === requested || fold(item.name) === requestedFolded);
    const acceptedKeys = new Set([
      requested,
      requestedFolded,
      club?.id,
      fold(club?.name),
      fold(club?.shortName),
    ].filter(Boolean));
    return pool.filter(player => acceptedKeys.has(playerClubKey(player))
      || acceptedKeys.has(fold(player.clubName || player.club)));
  };

  const getPlayersByNationality = async (databaseId, nationalityCode, {
    playable = true,
    ...options
  } = {}) => {
    const snapshot = await loadDatabase(databaseId, options);
    const pool = playable ? snapshot.playablePlayers : snapshot.players;
    const code = asText(nationalityCode).toLocaleUpperCase('hu-HU');
    return pool.filter(player => nationalityTokens(player).includes(code));
  };

  const getEligibleNationalities = async (
    databaseId,
    minimumPlayerCount = DEFAULT_ELIGIBLE_PLAYER_COUNT,
    options = {},
  ) => {
    const players = await getAllPlayers(databaseId, { ...options, playable: true });
    const groups = new Map();
    for (const player of players) {
      for (const code of nationalityTokens(player)) {
        const current = groups.get(code) ?? { code, name: code, count: 0 };
        current.count += 1;
        groups.set(code, current);
      }
    }
    return [...groups.values()]
      .filter(item => item.count >= minimumPlayerCount)
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code, 'hu-HU'));
  };

  const getEligibleTeams = async (
    databaseId,
    minimumPlayerCount = DEFAULT_ELIGIBLE_PLAYER_COUNT,
    options = {},
  ) => {
    const snapshot = await loadDatabase(databaseId, options);
    const groups = new Map();
    for (const player of snapshot.playablePlayers) {
      const id = playerClubKey(player);
      if (!id) continue;
      const current = groups.get(id) ?? { id, name: player.clubName || player.club || id, count: 0 };
      current.count += 1;
      groups.set(id, current);
    }
    return [...groups.values()]
      .filter(item => item.count >= minimumPlayerCount)
      .map(item => {
        const club = snapshot.clubs.find(candidate => candidate.id === item.id
          || fold(candidate.name) === item.id);
        return { ...club, ...item, name: club?.name || item.name };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'hu-HU'));
  };

  const validateDatabase = async (databaseId, options = {}) => {
    try {
      return (await buildSnapshot(databaseId, { ...options, allowInvalid: true })).validation;
    } catch (error) {
      return Object.freeze({
        errors: Object.freeze([error.message]),
        warnings: Object.freeze([]),
        information: Object.freeze([]),
        summary: Object.freeze({
          playerCount: 0,
          playablePlayerCount: 0,
          clubCount: 0,
          errorCount: 1,
          warningCount: 0,
          informationCount: 0,
          valid: false,
        }),
      });
    }
  };

  const normalizeDatabase = async (databaseId, options = {}) => (
    await loadDatabase(databaseId, options)
  ).payload;

  const getDatabaseStatistics = async (databaseId, options = {}) => (
    await loadDatabase(databaseId, options)
  ).statistics;

  const clearCache = databaseId => {
    if (asText(databaseId)) snapshotCache.delete(asText(databaseId));
    else snapshotCache.clear();
    jsonCache.clear();
  };

  return Object.freeze({
    getAvailableDatabases,
    getDatabaseById,
    loadDatabase,
    getAllPlayers,
    getAllClubs,
    getPlayersByClub,
    getPlayersByNationality,
    getEligibleNationalities,
    getEligibleTeams,
    validateDatabase,
    normalizeDatabase,
    getDatabaseStatistics,
    clearCache,
  });
}

const defaultDatabaseService = createDatabaseService();

export const getAvailableDatabases = (...args) => defaultDatabaseService.getAvailableDatabases(...args);
export const getDatabaseById = (...args) => defaultDatabaseService.getDatabaseById(...args);
export const loadDatabase = (...args) => defaultDatabaseService.loadDatabase(...args);
export const getAllPlayers = (...args) => defaultDatabaseService.getAllPlayers(...args);
export const getAllClubs = (...args) => defaultDatabaseService.getAllClubs(...args);
export const getPlayersByClub = (...args) => defaultDatabaseService.getPlayersByClub(...args);
export const getPlayersByNationality = (...args) => defaultDatabaseService.getPlayersByNationality(...args);
export const getEligibleNationalities = (...args) => defaultDatabaseService.getEligibleNationalities(...args);
export const getEligibleTeams = (...args) => defaultDatabaseService.getEligibleTeams(...args);
export const validateDatabase = (...args) => defaultDatabaseService.validateDatabase(...args);
export const normalizeDatabase = (...args) => defaultDatabaseService.normalizeDatabase(...args);
export const getDatabaseStatistics = (...args) => defaultDatabaseService.getDatabaseStatistics(...args);
export const clearDatabaseServiceCache = (...args) => defaultDatabaseService.clearCache(...args);
