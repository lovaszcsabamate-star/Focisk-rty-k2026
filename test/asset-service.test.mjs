import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  ASSET_EXTENSION_ORDER,
  ASSET_PLACEHOLDERS,
  ASSET_PROTECTED_PREFIXES,
  AssetServiceError,
  assetService,
  canonicalAssetPath,
  createAssetService,
} from '../js/services/asset-service.js';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

assert.deepEqual(ASSET_EXTENSION_ORDER, ['png', 'jpg', 'jpeg', 'webp']);
assert.equal(canonicalAssetPath('./assets/cards/back.png?version=2#x'), 'assets/cards/back.png');
assert.equal(canonicalAssetPath(null), '');
assert.ok(ASSET_PROTECTED_PREFIXES.includes('assets/portraits/'));
assert.equal(ASSET_PLACEHOLDERS.player, 'src/assets/placeholders/player-silhouette.svg');
assert.equal(ASSET_PLACEHOLDERS.club, 'src/assets/placeholders/club-badge.svg');
assert.equal(ASSET_PLACEHOLDERS.appIcon, 'src/assets/placeholders/app-icon.svg');

assert.deepEqual(
  assetService.playerPortraitCandidates('player-42'),
  [
    'assets/portraits/player-42.png',
    'assets/portraits/player-42.jpg',
    'assets/portraits/player-42.jpeg',
    'assets/portraits/player-42.webp',
  ],
);
assert.deepEqual(
  assetService.playerPortraitCandidates({ id: 'p-1', meta: { imageUrl: 'https://example.com/p.jpg' } }),
  [
    'assets/portraits/p-1.png',
    'assets/portraits/p-1.jpg',
    'assets/portraits/p-1.jpeg',
    'assets/portraits/p-1.webp',
    'https://example.com/p.jpg',
  ],
);
assert.equal(
  assetService.playerPortraitCandidates({ id: 'p-1' }, { includePlaceholder: true }).at(-1),
  ASSET_PLACEHOLDERS.player,
);
assert.deepEqual(
  assetService.cardBackCandidates(),
  [
    'assets/cards/back.png',
    'assets/cards/back.jpg',
    'assets/cards/back.jpeg',
    'assets/cards/back.webp',
  ],
);
assert.deepEqual(
  assetService.friendCandidates('regular-joe'),
  [
    'assets/friends/regular-joe.png',
    'assets/friends/regular-joe.jpg',
    'assets/friends/regular-joe.jpeg',
    'assets/friends/regular-joe.webp',
  ],
);
assert.deepEqual(
  assetService.pubBackgroundCandidates(),
  [
    'assets/pub/background.png',
    'assets/pub/background.jpg',
    'assets/pub/background.jpeg',
    'assets/pub/background.webp',
  ],
);
assert.deepEqual(
  assetService.clubLogoCandidates('ferencvarosi-tc'),
  [
    'assets/clubs/ferencvarosi-tc.png',
    'assets/clubs/ferencvarosi-tc.jpg',
    'assets/clubs/ferencvarosi-tc.jpeg',
    'assets/clubs/ferencvarosi-tc.webp',
  ],
);
assert.deepEqual(
  assetService.flagCandidates('hungary'),
  [
    'assets/flags/hungary.png',
    'assets/flags/hungary.jpg',
    'assets/flags/hungary.jpeg',
    'assets/flags/hungary.webp',
  ],
);

assert.equal(assetService.isRemoteAssetUrl('assets/cards/back.png'), false);
assert.equal(assetService.isRemoteAssetUrl('./assets/cards/back.png?x=1'), false);
assert.equal(assetService.isRemoteAssetUrl('https://example.com/card.png'), true);
assert.equal(assetService.isRemoteAssetUrl('https://game.local/card.png', {
  baseUrl: 'https://game.local/index.html',
  origin: 'https://game.local',
}), false);
assert.equal(assetService.isRemoteAssetUrl('not-a-remote-file.png'), false);
assert.equal(assetService.isRemoteAssetUrl('http://[invalid'), true);
assert.equal(assetService.isApprovedReleaseAsset(ASSET_PLACEHOLDERS.player), true);
assert.equal(assetService.isProtectedUnapprovedArt('assets/portraits/player-42.png'), true);
assert.equal(assetService.isProtectedUnapprovedArt(ASSET_PLACEHOLDERS.player), false);
assert.equal(assetService.isProtectedUnapprovedArt('css/style.css'), false);
assert.equal(assetService.placeholder('club'), ASSET_PLACEHOLDERS.club);
assert.throws(() => assetService.placeholder('missing'), error => (
  error instanceof AssetServiceError && error.code === 'UNKNOWN_PLACEHOLDER'
));
assert.throws(() => createAssetService({ extensions: [] }), error => (
  error instanceof AssetServiceError && error.code === 'INVALID_EXTENSIONS'
));
assert.throws(() => createAssetService({ roots: null }), TypeError);

const custom = createAssetService({
  extensions: ['.svg', 'png', 'svg'],
  roots: { portrait: 'custom/portraits', cardBack: 'custom/back', friend: 'custom/friends', pub: 'custom/pub', clubLogo: 'custom/clubs', flag: 'custom/flags' },
  placeholders: { player: 'fallback/player.svg', club: 'fallback/club.svg', appIcon: 'fallback/app.svg' },
  protectedPrefixes: ['custom/portraits/'],
  approvedReleaseAssets: ['fallback/player.svg'],
});
assert.deepEqual(custom.extensions, ['svg', 'png']);
assert.deepEqual(custom.playerPortraitCandidates('../safe-player'), [
  'custom/portraits/safe-player.svg',
  'custom/portraits/safe-player.png',
]);
assert.equal(custom.isProtectedUnapprovedArt('custom/portraits/safe-player.svg'), true);
assert.equal(custom.isApprovedReleaseAsset('fallback/player.svg?cache=1'), true);

const serviceSource = read('../js/services/asset-service.js');
const primitivesSource = read('../js/ui/dom-primitives.js');
const cardSource = read('../js/ui/card-component.js');
const brandingSource = read('../js/branding.js');
const buildSource = read('../scripts/build-standalone.mjs');
const serviceWorkerSource = read('../sw.js');

assert.doesNotMatch(serviceSource, /\bdocument\b|\bwindow\b|HTMLElement|HTMLImageElement|new Image\s*\(/);
assert.match(primitivesSource, /services\/asset-service\.js/);
assert.doesNotMatch(primitivesSource, /UI_ART_EXTENSIONS|assets\/portraits\/|assets\/cards\/back|assets\/pub\/background/);
assert.match(cardSource, /ART\.playerPortrait\(card\)/);
assert.match(brandingSource, /services\/asset-service\.js/);
assert.doesNotMatch(brandingSource, /const canonicalPath\s*=|const protectedArtPrefixes\s*=|playerPlaceholderPath:\s*['"]/);
assert.ok(
  buildSource.indexOf("'js/services/asset-service.js'") < buildSource.indexOf("'js/branding.js'"),
  'az asset-service a branding előtt kerül a standalone bundle-be',
);
assert.ok(
  buildSource.indexOf("'js/services/asset-service.js'") < buildSource.indexOf("'js/ui/dom-primitives.js'"),
  'az asset-service a DOM-primitívek előtt kerül a standalone bundle-be',
);
assert.match(serviceWorkerSource, /\.\/js\/services\/asset-service\.js/);

console.log('✓ Központi, DOM-mentes assetútvonal-, fallback- és jogi policy szolgáltatás: rendben');
