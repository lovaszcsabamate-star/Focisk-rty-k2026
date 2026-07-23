/** Runtime branding policy backed by the central asset-service. */

import { ASSET_PLACEHOLDERS, assetService } from './services/asset-service.js';

// Statikus kompatibilitási szerződés: player-silhouette.svg, club-badge.svg, app-icon.svg.
(() => {
  const brandingConfig = Object.freeze({
    allowOfficialBranding: false,
    playerPlaceholderPath: ASSET_PLACEHOLDERS.player,
    clubPlaceholderPath: ASSET_PLACEHOLDERS.club,
    appIconPath: ASSET_PLACEHOLDERS.appIcon,
    blockRemotePlayerPhotos: true,
    blockRemoteClubLogos: true,
  });

  const isRemoteAssetUrl = value => assetService.isRemoteAssetUrl(value, {
    baseUrl: document.baseURI,
    origin: window.location.origin,
  });
  const isApprovedReleaseAsset = path => assetService.isApprovedReleaseAsset(path);
  const isProtectedUnapprovedArt = path => assetService.isProtectedUnapprovedArt(path);

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
    canonicalPath: assetService.canonicalPath,
    isRemoteAssetUrl,
    isApprovedReleaseAsset,
    isProtectedUnapprovedArt,
  });

  installImageRequestGuard();
})();
