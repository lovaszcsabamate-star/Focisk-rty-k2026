/** Runtime branding policy. Keep this file dependency-free for the standalone build. */

(() => {
  const brandingConfig = Object.freeze({
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
   * Runtime allow-list. An official asset may be added only after the JSON
   * registry documents permission and approvedForRelease=true.
   */
  const approvedReleaseAssets = new Set([
    brandingConfig.playerPlaceholderPath,
    brandingConfig.clubPlaceholderPath,
  ].map(canonicalPath));

  const protectedArtPrefixes = [
    'assets/portraits/',
    'assets/pub/',
    'assets/cards/',
    'assets/friends/',
    'assets/logos/',
    'assets/clubs/',
    'assets/leagues/',
  ];

  const isRemoteAssetUrl = value => {
    if (typeof value !== 'string' || !value.trim()) return false;
    try {
      const parsed = new URL(value, document.baseURI);
      return parsed.origin !== window.location.origin;
    } catch {
      return true;
    }
  };

  const isApprovedReleaseAsset = path => approvedReleaseAssets.has(canonicalPath(path));

  const isProtectedUnapprovedArt = path => {
    const canonical = canonicalPath(path);
    return protectedArtPrefixes.some(prefix => canonical.includes(prefix))
      && !isApprovedReleaseAsset(canonical);
  };

  /**
   * UI.tryArt uses `new Image()` probes. Guard those probes before the game modules
   * start, so remote URLs and unapproved portrait/logo folders never create a
   * network request. Normal interface images outside protected art folders remain
   * untouched.
   */
  const installImageRequestGuard = () => {
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
  };

  globalThis.__FOCISKARTYAK_BRANDING__ = Object.freeze({
    config: brandingConfig,
    isRemoteAssetUrl,
    isApprovedReleaseAsset,
    isProtectedUnapprovedArt,
  });

  installImageRequestGuard();
})();
