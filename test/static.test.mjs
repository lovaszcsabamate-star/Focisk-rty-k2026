import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const main = read('js/main.js');
const launcher = read('mobil.html');
const standalone = read('Fociskartyak2026.html');
const manifest = JSON.parse(read('manifest.webmanifest'));
const directory = JSON.parse(read('data/club-official-sources.json'));

assert.equal(
  directory.clubs.find(club => club.clubId === 'ferencvarosi-tc').status,
  'complete-42-of-42-player-review',
);
assert.equal(
  directory.clubs.find(club => club.clubId === 'dvtk').status,
  'complete-45-of-45-player-review',
);
assert.equal(
  directory.clubs.find(club => club.clubId === 'mtk-budapest').status,
  'complete-36-of-36-player-review',
);
assert.equal(
  directory.clubs.find(club => club.clubId === 'nyiregyhaza-spartacus-fc').status,
  'complete-39-of-39-player-review',
);
assert.equal(
  directory.clubs.find(club => club.clubId === 'kolorcity-kazincbarcika-sc').status,
  'complete-40-of-40-player-review',
);
assert.equal(
  directory.clubs.find(club => club.clubId === 'ujpest-fc').status,
  'complete-41-of-41-player-review',
);
assert.equal(
  directory.clubs.find(club => club.clubId === 'paksi-fc').status,
  'complete-33-of-33-player-review',
);
assert.equal(
  directory.clubs.find(club => club.clubId === 'eto-fc').status,
  'complete-35-of-35-player-review',
);
assert.equal(
  directory.clubs.find(club => club.clubId === 'zte-fc').status,
  'complete-43-of-43-player-review',
);

assert.equal(manifest.display, 'standalone');
assert.equal(manifest.orientation, 'portrait-primary');
const hasScalableApprovedIcon = manifest.icons.some(icon =>
  icon.sizes === 'any'
  && icon.type === 'image/svg+xml'
  && icon.src === 'src/assets/placeholders/app-icon.svg'
);
const hasRasterInstallIcons = manifest.icons.some(icon => icon.sizes === '192x192')
  && manifest.icons.some(icon => icon.sizes === '512x512');
assert.ok(hasScalableApprovedIcon || hasRasterInstallIcons, 'Hiányzik a skálázható vagy 192/512 px-es PWA-ikon.');
assert.match(main, /Klasszikus mód/);
assert.match(main, /Penalties mód/);
assert.match(main, /Játék folytatása/);
assert.match(main, /handleBackAction/);
assert.match(launcher, /Fociskartyak2026\.html/);
assert.match(standalone, /globalThis\.__EMBEDDED_PLAYER_DATA__/);
assert.match(standalone, /officialClubDirectory/);
assert.match(standalone, /officialClubStatPatches/);
assert.match(standalone, /"minutes":3161/);
assert.match(standalone, /"updatedExistingPlayers":\d+/);
assert.match(standalone, /"unmatchedRecords":0/);
assert.match(standalone, /"correctionCount":2/);
assert.match(standalone, /saved-match:v2/);
assert.doesNotMatch(standalone, /<script type="module" src=/);

console.log('✓ Statikus build-, adatbázis- és telepíthetőségi ellenőrzések rendben');
