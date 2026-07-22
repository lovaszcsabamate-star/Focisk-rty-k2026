/** Runtime branding policy. Keep this file dependency-free for the standalone build. */

export const BRANDING_CONFIG = Object.freeze({
  allowOfficialBranding: false,
  playerPlaceholderPath: 'src/assets/placeholders/player-silhouette.svg',
  clubPlaceholderPath: 'src/assets/placeholders/club-badge.svg',
  blockRemotePlayerPhotos: true,
  blockRemoteClubLogos: true,
});

/**
 * Runtime allow-list. An official asset must be present here only after the JSON
 * registry has documented permission and approvedForRelease=true.
 */
const APPROVED_RELEASE_ASSETS = new Set([
  BRANDING_CONFIG.playerPlaceholderPath,
  BRANDING_CONFIG.clubPlaceholderPath,
]);

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
  return typeof path === 'string' && APPROVED_RELEASE_ASSETS.has(path);
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
