/** Runtime branding policy. Keep this file dependency-free for the standalone build. */

export const BRANDING_CONFIG = Object.freeze({
  allowOfficialBranding: false,
  playerPlaceholderPath: 'src/assets/placeholders/player-silhouette.svg',
  clubPlaceholderPath: 'src/assets/placeholders/club-badge.svg',
  blockRemotePlayerPhotos: true,
  blockRemoteClubLogos: true,
});

const canonicalPath = value => String(value || '')
  .trim()
  .replace(/^\.\//, '')
  .split(/[?#]/, 1)[0];

/**
 * Runtime allow-list. An official asset must be present here only after the JSON
 * registry has documented permission and approvedForRelease=true.
 */
const APPROVED_RELEASE_ASSETS = new Set([
  BRANDING_CONFIG.playerPlaceholderPath,
  BRANDING_CONFIG.clubPlaceholderPath,
].map(canonicalPath));

const PROTECTED_ART_PREFIXES = [
  'assets/portraits/',
  'assets/pub/',
  'assets/cards/',
  'assets/friends/',
  'assets/logos/',
  'assets/clubs/',
  'assets/leagues/',
];

export function isRemoteAssetUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value, document.baseURI);
    return parsed.origin !== window.location.origin;
  } catch {
    return true;
  }
}

export function isApprovedReleaseAsset(path) {
  return APPROVED_RELEASE_ASSETS.has(canonicalPath(path));
}

export function isProtectedUnapprovedArt(path) {
  const canonical = canonicalPath(path);
  return PROTECTED_ART_PREFIXES.some(prefix => canonical.includes(prefix))
    && !isApprovedReleaseAsset(canonical);
}

/**
 * Resolve safe art without making an unapproved network request.
 * Unknown portraits always fall back to the neutral silhouette.
 */
export function approvedArtCandidates(kind, requested = []) {
  const candidates = (Array.isArray(requested) ? requested : [requested])
    .filter(path => typeof path === 'string' && path.trim())
    .filter(path => !isRemoteAssetUrl(path))
    .filter(isApprovedReleaseAsset);

  if (kind === 'player-photo') {
    return candidates.length ? candidates : [BRANDING_CONFIG.playerPlaceholderPath];
  }
  if (kind === 'club-logo') {
    return candidates.length ? candidates : [BRANDING_CONFIG.clubPlaceholderPath];
  }

  // Backgrounds, card backs and avatars keep their CSS fallbacks until their
  // individual license entries are approved and added to the allow-list.
  return candidates;
}

/**
 * UI.tryArt uses `new Image()` probes. Guard those probes before the game modules
 * start, so remote URLs and unapproved portrait/logo folders never create a
 * network request. Normal interface images outside protected art folders remain
 * untouched.
 */
function installImageRequestGuard() {
  if (typeof window === 'undefined' || typeof window.Image !== 'function') return;
  if (window.Image.__fociskartyakGuarded) return;

  const NativeImage = window.Image;
  const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (!srcDescriptor?.get || !srcDescriptor?.set) return;

  function GuardedImage(width, height) {
    const image = new NativeImage(width, height);
    Object.defineProperty(image, 'src', {
      configurable: true,
      enumerable: true,
      get: () => srcDescriptor.get.call(image),
      set: value => {
        const blocked = isRemoteAssetUrl(value) || isProtectedUnapprovedArt(value);
        if (blocked) {
          queueMicrotask(() => image.onerror?.(new Event('error')));
          return;
        }
        srcDescriptor.set.call(image, value);
      },
    });
    return image;
  }

  GuardedImage.prototype = NativeImage.prototype;
  Object.defineProperty(GuardedImage, '__fociskartyakGuarded', { value: true });
  window.Image = GuardedImage;
}

installImageRequestGuard();
