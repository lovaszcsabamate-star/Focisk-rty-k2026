/** Central database registry and manifest validation. */

export const DATABASE_REGISTRY_URL = 'data/databases/registry.json';

const registryCache = new Map();
const asText = value => typeof value === 'string' ? value.trim() : '';
const asStringList = value => Array.isArray(value) ? value.map(asText).filter(Boolean) : [];
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const fetchJson = async url => {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  return response.json();
};

const throwValidationError = (kind, errors) => {
  if (errors.length) throw new Error(`${kind}: ${errors.join('; ')}`);
};

export function normaliseDatabaseRegistry(payload = {}) {
  const databases = Array.isArray(payload.databases)
    ? payload.databases.map(entry => ({
      id: asText(entry?.id),
      manifest: asText(entry?.manifest),
      enabled: entry?.enabled !== false,
    }))
    : [];

  return {
    schemaVersion: Number(payload.schemaVersion),
    defaultDatabaseId: asText(payload.defaultDatabaseId),
    databases,
  };
}

export function validateDatabaseRegistry(payload = {}) {
  const registry = normaliseDatabaseRegistry(payload);
  const errors = [];

  if (!Number.isInteger(registry.schemaVersion) || registry.schemaVersion < 1) {
    errors.push('érvénytelen schemaVersion');
  }
  if (!registry.defaultDatabaseId) errors.push('hiányzó defaultDatabaseId');
  if (!registry.databases.length) errors.push('nincs regisztrált adatbázis');

  const ids = registry.databases.map(entry => entry.id).filter(Boolean);
  if (ids.length !== registry.databases.length) errors.push('hiányzó adatbázis-azonosító');
  if (new Set(ids).size !== ids.length) errors.push('duplikált adatbázis-azonosító');
  if (registry.databases.some(entry => !entry.manifest)) errors.push('hiányzó manifest útvonal');

  const enabledIds = new Set(registry.databases.filter(entry => entry.enabled).map(entry => entry.id));
  if (registry.defaultDatabaseId && !enabledIds.has(registry.defaultDatabaseId)) {
    errors.push('az alapértelmezett adatbázis nem elérhető');
  }

  throwValidationError('Hibás adatbázis-regiszter', errors);
  return registry;
}

export function normaliseDatabaseManifest(payload = {}, manifestUrl = '') {
  const files = isObject(payload.files) ? payload.files : {};
  const normalization = isObject(payload.normalization) ? payload.normalization : {};
  return {
    ...payload,
    schemaVersion: Number(payload.schemaVersion),
    id: asText(payload.id),
    name: asText(payload.name),
    competition: asText(payload.competition),
    country: asText(payload.country),
    season: asText(payload.season),
    version: asText(payload.version),
    enabled: payload.enabled !== false,
    default: payload.default === true,
    minimumPlayers: Number(payload.minimumPlayers),
    supportedModes: asStringList(payload.supportedModes),
    supportedDeckSelections: asStringList(payload.supportedDeckSelections),
    lastUpdated: asText(payload.lastUpdated),
    manifestUrl: asText(manifestUrl),
    files: {
      players: asText(files.players),
      normalizedPlayers: asText(files.normalizedPlayers),
      normalizationReport: asText(files.normalizationReport),
      clubDirectory: asText(files.clubDirectory),
      enrichments: asStringList(files.enrichments),
      corrections: asStringList(files.corrections),
      statPatches: asStringList(files.statPatches),
    },
    normalization: {
      schemaVersion: Number(normalization.schemaVersion),
      playerModelVersion: Number(normalization.playerModelVersion),
      primaryFile: asText(normalization.primaryFile),
      migrationScript: asText(normalization.migrationScript),
      reproducible: normalization.reproducible === true,
      fallback: asText(normalization.fallback),
    },
  };
}

export function validateDatabaseManifest(payload = {}, manifestUrl = '') {
  const manifest = normaliseDatabaseManifest(payload, manifestUrl);
  const errors = [];

  if (!Number.isInteger(manifest.schemaVersion) || manifest.schemaVersion < 1) {
    errors.push('érvénytelen schemaVersion');
  }
  if (!manifest.id) errors.push('hiányzó id');
  if (!manifest.name) errors.push('hiányzó name');
  if (!manifest.competition) errors.push('hiányzó competition');
  if (!manifest.season) errors.push('hiányzó season');
  if (!manifest.files.players) errors.push('hiányzó játékosadat-fájl');
  if (!manifest.files.clubDirectory) errors.push('hiányzó klubforrás-jegyzék');
  if (!Number.isInteger(manifest.minimumPlayers) || manifest.minimumPlayers < 2) {
    errors.push('érvénytelen minimumPlayers');
  }
  if (!manifest.supportedModes.length) errors.push('nincs támogatott játékmód');

  if (manifest.normalization.primaryFile) {
    if (manifest.normalization.primaryFile !== 'normalizedPlayers') {
      errors.push('ismeretlen normalizált elsődleges fájltípus');
    }
    if (!manifest.files.normalizedPlayers) errors.push('hiányzó normalizált játékosadat-fájl');
    if (!Number.isInteger(manifest.normalization.playerModelVersion)
      || manifest.normalization.playerModelVersion < 1) {
      errors.push('érvénytelen playerModelVersion');
    }
  }

  const allFiles = [
    manifest.files.players,
    manifest.files.normalizedPlayers,
    manifest.files.normalizationReport,
    manifest.files.clubDirectory,
    ...manifest.files.enrichments,
    ...manifest.files.corrections,
    ...manifest.files.statPatches,
  ].filter(Boolean);
  if (new Set(allFiles).size !== allFiles.length) errors.push('duplikált adatfájl-útvonal');

  throwValidationError(`Hibás adatbázis-manifest${manifestUrl ? ` (${manifestUrl})` : ''}`, errors);
  return manifest;
}

async function createRegistrySnapshot(url) {
  const registry = validateDatabaseRegistry(await fetchJson(url));
  const entries = registry.databases.filter(entry => entry.enabled);
  const databases = await Promise.all(entries.map(async entry => {
    const manifest = validateDatabaseManifest(await fetchJson(entry.manifest), entry.manifest);
    if (manifest.id !== entry.id) {
      throw new Error(`Az adatbázis-regiszter azonosítója (${entry.id}) nem egyezik a manifest azonosítójával (${manifest.id}).`);
    }
    return manifest;
  }));

  if (!databases.some(database => database.id === registry.defaultDatabaseId)) {
    throw new Error(`Az alapértelmezett adatbázis manifestje nem tölthető be: ${registry.defaultDatabaseId}`);
  }

  return Object.freeze({
    schemaVersion: registry.schemaVersion,
    defaultDatabaseId: registry.defaultDatabaseId,
    databases: Object.freeze(databases),
  });
}

export function loadDatabaseRegistry(url = DATABASE_REGISTRY_URL) {
  const key = asText(url) || DATABASE_REGISTRY_URL;
  if (!registryCache.has(key)) {
    registryCache.set(key, createRegistrySnapshot(key).catch(error => {
      registryCache.delete(key);
      throw error;
    }));
  }
  return registryCache.get(key);
}

export async function getAvailableDatabases(url = DATABASE_REGISTRY_URL) {
  const registry = await loadDatabaseRegistry(url);
  return registry.databases.filter(database => database.enabled);
}

export async function getDatabaseById(databaseId, url = DATABASE_REGISTRY_URL) {
  const id = asText(databaseId);
  const databases = await getAvailableDatabases(url);
  return databases.find(database => database.id === id) ?? null;
}

export async function getDefaultDatabase(url = DATABASE_REGISTRY_URL) {
  const registry = await loadDatabaseRegistry(url);
  const database = registry.databases.find(item => item.id === registry.defaultDatabaseId);
  if (!database) throw new Error(`Nincs használható alapértelmezett adatbázis: ${registry.defaultDatabaseId}`);
  return database;
}

export function clearDatabaseRegistryCache() {
  registryCache.clear();
}
