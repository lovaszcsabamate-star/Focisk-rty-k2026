import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const replaceRequired = (source, search, replacement, label) => {
  if (!source.includes(search)) throw new Error(`Nem található integrációs minta: ${label}`);
  return source.replace(search, replacement);
};

let service = read('js/services/asset-service.js');
service = replaceRequired(
  service,
  "  'assets/clubs/',\n  'assets/leagues/',",
  "  'assets/clubs/',\n  'assets/leagues/',\n  'assets/flags/',",
  'védett zászlómappa',
);
service = replaceRequired(
  service,
  "const assetIdentifier = value => canonicalAssetPath(value)\n  .replace(/^\\/+|\\/+$/g, '')\n  .replace(/\\.\\./g, '')\n  .trim();",
  "const assetIdentifier = value => canonicalAssetPath(value)\n  .replace(/\\.\\./g, '')\n  .replace(/^\\/+|\\/+$/g, '')\n  .trim();",
  'biztonságos assetazonosító',
);
write('js/services/asset-service.js', service);

let primitives = read('js/ui/dom-primitives.js');
primitives = replaceRequired(
  primitives,
  "const UI_ART_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];\nconst withUiArtExtensions = base => UI_ART_EXTENSIONS.map(extension => `${base}.${extension}`);\n\n// Szándékosan bővíthető: a későbbi kompatibilitási modulok további asset-feloldókat adhatnak hozzá.\nexport const ART = {\n  portrait: id => withUiArtExtensions(`assets/portraits/${id}`),\n  cardBack: () => withUiArtExtensions('assets/cards/back'),\n  friend: id => withUiArtExtensions(`assets/friends/${id}`),\n  pub: () => withUiArtExtensions('assets/pub/background'),\n};",
  "import { assetService } from '../services/asset-service.js';\n\n// Kompatibilis UI-API, központi asset-service feloldással.\nexport const ART = Object.freeze({\n  portrait: id => assetService.playerPortraitCandidates(id, { includeMetadata: false }),\n  playerPortrait: card => assetService.playerPortraitCandidates(card),\n  cardBack: () => assetService.cardBackCandidates(),\n  friend: id => assetService.friendCandidates(id),\n  pub: () => assetService.pubBackgroundCandidates(),\n  clubLogo: clubOrId => assetService.clubLogoCandidates(clubOrId),\n  flag: nationKey => assetService.flagCandidates(nationKey),\n  placeholder: kind => assetService.placeholder(kind),\n});",
  'DOM-primitív asset API',
);
write('js/ui/dom-primitives.js', primitives);

let card = read('js/ui/card-component.js');
card = replaceRequired(
  card,
  "  tryArt(portrait, [...ART.portrait(card.id), ...(card.meta?.imageUrl ? [card.meta.imageUrl] : [])]);",
  "  tryArt(portrait, ART.playerPortrait(card));",
  'kártyaportré candidate-lista',
);
write('js/ui/card-component.js', card);

const branding = `/** Runtime branding policy backed by the central asset-service. */

import { ASSET_PLACEHOLDERS, assetService } from './services/asset-service.js';

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
   * UI.tryArt uses \`new Image()\` probes. Guard those probes before the game modules
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
`;
write('js/branding.js', branding);

let build = read('scripts/build-standalone.mjs');
build = replaceRequired(
  build,
  "  'js/services/storage-service.js',\n  'js/deck-selection.js',",
  "  'js/services/storage-service.js',\n  'js/services/asset-service.js',\n  'js/deck-selection.js',",
  'standalone asset-service modulrend',
);
write('scripts/build-standalone.mjs', build);

let sw = read('sw.js');
sw = sw.replace(
  /\/\/ Korábbi cache-verziók: fociskartyak-2026-v30 \.\.\. fociskartyak-2026-v\d+/,
  '// Korábbi cache-verziók: fociskartyak-2026-v30 ... fociskartyak-2026-v59',
);
sw = sw.replace(/const PWA_CACHE = 'fociskartyak-2026-v\d+';/, "const PWA_CACHE = 'fociskartyak-2026-v60';");
sw = replaceRequired(
  sw,
  "  './js/services/storage-service.js',\n  './js/services/save-service.js',",
  "  './js/services/storage-service.js',\n  './js/services/asset-service.js',\n  './js/services/save-service.js',",
  'PWA asset-service cache',
);
write('sw.js', sw);

let pkg = read('package.json');
pkg = replaceRequired(
  pkg,
  'node --check js/services/storage-service.js && node --check js/services/save-service.js',
  'node --check js/services/storage-service.js && node --check js/services/asset-service.js && node --check js/services/save-service.js',
  'lint asset-service modul',
);
pkg = replaceRequired(
  pkg,
  'node --check test/storage-service.test.mjs && node --check test/save-service.test.mjs',
  'node --check test/storage-service.test.mjs && node --check test/asset-service.test.mjs && node --check test/save-service.test.mjs',
  'lint asset-service teszt',
);
pkg = pkg.replaceAll(
  'node test/storage-service.test.mjs && node test/save-service.test.mjs',
  'node test/storage-service.test.mjs && node test/asset-service.test.mjs && node test/save-service.test.mjs',
);
pkg = replaceRequired(
  pkg,
  '"test:storage-service": "node test/storage-service.test.mjs",\n    "test:save-service":',
  '"test:storage-service": "node test/storage-service.test.mjs",\n    "test:asset-service": "node test/asset-service.test.mjs",\n    "test:save-service":',
  'asset-service npm tesztparancs',
);
write('package.json', pkg);

let test = read('test/asset-service.test.mjs');
test = test.replace(
  "assert.equal(assetService.isRemoteAssetUrl('not a valid URL %'), false);",
  "assert.equal(assetService.isRemoteAssetUrl('not-a-remote-file.png'), false);\nassert.equal(assetService.isRemoteAssetUrl('%%%'), true);",
);
write('test/asset-service.test.mjs', test);

console.log('A 14. lépés központi asset-service integrációja elkészült.');
