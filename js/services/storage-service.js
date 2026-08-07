/**
 * Biztonságos, injektálható tartós tárolási szolgáltatás.
 * A böngészői localStorage hiánya vagy hibája nem szakíthatja meg a játékot.
 */

const resolveDefaultStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export function createStorageService(storage = resolveDefaultStorage()) {
  let lastFailure = null;
  const rememberFailure = (operation, key, error, code = 'failed') => {
    lastFailure = Object.freeze({
      operation,
      key: String(key ?? ''),
      code,
      name: String(error?.name || (code === 'unavailable' ? 'StorageUnavailable' : 'Error')),
      message: String(error?.message || (code === 'unavailable'
        ? 'A böngészői tárhely nem érhető el.'
        : 'Ismeretlen storage-hiba.')),
    });
    return false;
  };
  const clearFailure = () => { lastFailure = null; };

  const readString = (key, fallback = null) => {
    try {
      if (!storage || typeof storage.getItem !== 'function') {
        rememberFailure('read', key, null, 'unavailable');
        return fallback;
      }
      const value = storage.getItem(key);
      clearFailure();
      return value == null ? fallback : String(value);
    } catch (error) {
      rememberFailure('read', key, error);
      return fallback;
    }
  };

  const writeString = (key, value) => {
    try {
      if (!storage || typeof storage.setItem !== 'function') {
        return rememberFailure('write', key, null, 'unavailable');
      }
      storage.setItem(key, String(value));
      clearFailure();
      return true;
    } catch (error) {
      return rememberFailure('write', key, error);
    }
  };

  const remove = key => {
    try {
      if (!storage || typeof storage.removeItem !== 'function') {
        return rememberFailure('remove', key, null, 'unavailable');
      }
      storage.removeItem(key);
      clearFailure();
      return true;
    } catch (error) {
      return rememberFailure('remove', key, error);
    }
  };

  const readJson = (key, fallback = null) => {
    const raw = readString(key, null);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    try {
      return writeString(key, JSON.stringify(value));
    } catch {
      return false;
    }
  };

  const readBoolean = (key, fallback = false) => {
    const raw = readString(key, null);
    if (raw == null) return Boolean(fallback);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return Boolean(fallback);
  };

  const writeBoolean = (key, value) => writeString(key, String(Boolean(value)));

  return Object.freeze({
    readString,
    writeString,
    readJson,
    writeJson,
    readBoolean,
    writeBoolean,
    remove,
    inspectLastFailure: () => lastFailure,
    available: Boolean(storage),
  });
}

export const storageService = createStorageService();

export const readStoredString = (...args) => storageService.readString(...args);
export const writeStoredString = (...args) => storageService.writeString(...args);
export const readStoredJson = (...args) => storageService.readJson(...args);
export const writeStoredJson = (...args) => storageService.writeJson(...args);
export const readStoredBoolean = (...args) => storageService.readBoolean(...args);
export const writeStoredBoolean = (...args) => storageService.writeBoolean(...args);
export const removeStoredValue = (...args) => storageService.remove(...args);
