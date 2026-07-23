/** DOM-mentes assetútvonal-, fallback- és kiadási policy szolgáltatás. */

export const ASSET_EXTENSION_ORDER = Object.freeze(['png', 'jpg', 'jpeg', 'webp']);

export const ASSET_ROOTS = Object.freeze({
  portrait: 'assets/portraits',
  cardBack: 'assets/cards/back',
  friend: 'assets/friends',
  pub: 'assets/pub/background',
  clubLogo: 'assets/clubs',
  flag: 'assets/flags',
});

export const ASSET_PLACEHOLDERS = Object.freeze({
  player: 'src/assets/placeholders/player-silhouette.svg',
  club: 'src/assets/placeholders/club-badge.svg',
  appIcon: 'src/assets/placeholders/app-icon.svg',
});

export const ASSET_PROTECTED_PREFIXES = Object.freeze([
  'assets/portraits/',
  'assets/pub/',
  'assets/cards/',
  'assets/friends/',
  'assets/logos/',
  'assets/clubs/',
  'assets/leagues/',
  'assets/flags/',
]);

export class AssetServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AssetServiceError';
    this.code = code;
  }
}

export const canonicalAssetPath = value => String(value ?? '')
  .trim()
  .replace(/^\.\//, '')
  .split(/[?#]/, 1)[0];

const assetUniqueStrings = values => [...new Set(values
  .map(value => String(value ?? '').trim())
  .filter(Boolean))];

const assetValidateExtensions = extensions => {
  if (!Array.isArray(extensions) || !extensions.length) {
    throw new AssetServiceError('INVALID_EXTENSIONS', 'Az asset-kiterjesztések nem lehetnek üresek.');
  }
  const normalized = assetUniqueStrings(extensions.map(extension => extension.replace(/^\./, '').toLowerCase()));
  if (!normalized.length || normalized.some(extension => !/^[a-z0-9]+$/u.test(extension))) {
    throw new AssetServiceError('INVALID_EXTENSIONS', 'Érvénytelen asset-kiterjesztés.');
  }
  return Object.freeze(normalized);
};

const assetValidateRecord = (record, label) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError(`Az asset-service ${label} mezője objektum kell legyen.`);
  }
  return Object.freeze({ ...record });
};

const assetWithExtensions = (base, extensions) => {
  const canonical = canonicalAssetPath(base);
  if (!canonical) return [];
  return extensions.map(extension => `${canonical}.${extension}`);
};

const assetIdentifier = value => canonicalAssetPath(value)
  .replace(/\.\./g, '')
  .replace(/^\/+|\/+$/g, '')
  .trim();

const assetRecordId = (value, candidates) => {
  if (value && typeof value === 'object') {
    for (const key of candidates) {
      const resolved = assetIdentifier(value[key]);
      if (resolved) return resolved;
    }
    return '';
  }
  return assetIdentifier(value);
};

const assetOptionalUrl = (value, keys) => {
  if (!value || typeof value !== 'object') return '';
  for (const key of keys) {
    const candidate = String(value[key] ?? '').trim();
    if (candidate) return candidate;
  }
  return '';
};

export function createAssetService({
  extensions = ASSET_EXTENSION_ORDER,
  roots = ASSET_ROOTS,
  placeholders = ASSET_PLACEHOLDERS,
  protectedPrefixes = ASSET_PROTECTED_PREFIXES,
  approvedReleaseAssets = Object.values(ASSET_PLACEHOLDERS),
} = {}) {
  const configuredExtensions = assetValidateExtensions(extensions);
  const configuredRoots = assetValidateRecord(roots, 'roots');
  const configuredPlaceholders = assetValidateRecord(placeholders, 'placeholders');
  const configuredPrefixes = Object.freeze(assetUniqueStrings(protectedPrefixes).map(canonicalAssetPath));
  const approved = new Set(assetUniqueStrings(approvedReleaseAssets).map(canonicalAssetPath));

  const extensionCandidates = base => Object.freeze(assetWithExtensions(base, configuredExtensions));
  const placeholder = kind => {
    const path = configuredPlaceholders[kind];
    if (!path) throw new AssetServiceError('UNKNOWN_PLACEHOLDER', `Ismeretlen asset-placeholder: ${kind}`);
    return path;
  };

  const isApprovedReleaseAsset = path => approved.has(canonicalAssetPath(path));
  const isProtectedUnapprovedArt = path => {
    const canonical = canonicalAssetPath(path);
    return configuredPrefixes.some(prefix => canonical.includes(prefix))
      && !isApprovedReleaseAsset(canonical);
  };

  const isRemoteAssetUrl = (value, {
    baseUrl = 'http://localhost/',
    origin = null,
  } = {}) => {
    if (typeof value !== 'string' || !value.trim()) return false;
    try {
      const base = new URL(baseUrl);
      const parsed = new URL(value, base);
      return parsed.origin !== (origin ?? base.origin);
    } catch {
      return true;
    }
  };

  const playerPortraitCandidates = (playerOrId, {
    includeMetadata = true,
    includePlaceholder = false,
  } = {}) => {
    const id = assetRecordId(playerOrId, ['id', 'playerId']);
    const local = id ? assetWithExtensions(`${configuredRoots.portrait}/${id}`, configuredExtensions) : [];
    const metadata = includeMetadata
      ? assetOptionalUrl(playerOrId?.meta ?? playerOrId, ['imageUrl', 'photoUrl', 'portraitUrl'])
      : '';
    const fallback = includePlaceholder ? configuredPlaceholders.player : '';
    return Object.freeze(assetUniqueStrings([...local, metadata, fallback]));
  };

  const clubLogoCandidates = (clubOrId, {
    includeMetadata = true,
    includePlaceholder = false,
  } = {}) => {
    const id = assetRecordId(clubOrId, ['clubId', 'id']);
    const local = id ? assetWithExtensions(`${configuredRoots.clubLogo}/${id}`, configuredExtensions) : [];
    const metadata = includeMetadata
      ? assetOptionalUrl(clubOrId?.meta ?? clubOrId, ['logoUrl', 'crestUrl', 'clubLogo'])
      : '';
    const fallback = includePlaceholder ? configuredPlaceholders.club : '';
    return Object.freeze(assetUniqueStrings([...local, metadata, fallback]));
  };

  const flagCandidates = nationKey => {
    const key = assetIdentifier(nationKey);
    return Object.freeze(key ? assetWithExtensions(`${configuredRoots.flag}/${key}`, configuredExtensions) : []);
  };

  const cardBackCandidates = () => extensionCandidates(configuredRoots.cardBack);
  const friendCandidates = id => {
    const key = assetIdentifier(id);
    return Object.freeze(key ? assetWithExtensions(`${configuredRoots.friend}/${key}`, configuredExtensions) : []);
  };
  const pubBackgroundCandidates = () => extensionCandidates(configuredRoots.pub);

  return Object.freeze({
    extensions: configuredExtensions,
    roots: configuredRoots,
    placeholders: configuredPlaceholders,
    protectedPrefixes: configuredPrefixes,
    canonicalPath: canonicalAssetPath,
    extensionCandidates,
    playerPortraitCandidates,
    clubLogoCandidates,
    flagCandidates,
    cardBackCandidates,
    friendCandidates,
    pubBackgroundCandidates,
    placeholder,
    isRemoteAssetUrl,
    isApprovedReleaseAsset,
    isProtectedUnapprovedArt,
  });
}

export const assetService = createAssetService();
