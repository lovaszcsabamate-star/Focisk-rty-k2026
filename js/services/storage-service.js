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
  const readString = (key, fallback = null) => {
    try {
      if (!storage || typeof storage.getItem !== 'function') return fallback;
      const value = storage.getItem(key);
      return value == null ? fallback : String(value);
    } catch {
      return fallback;
    }
  };

  const writeString = (key, value) => {
    try {
      if (!storage || typeof storage.setItem !== 'function') return false;
      storage.setItem(key, String(value));
      return true;
    } catch {
      return false;
    }
  };

  const remove = key => {
    try {
      if (!storage || typeof storage.removeItem !== 'function') return false;
      storage.removeItem(key);
      return true;
    } catch {
      return false;
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
