import assert from 'node:assert/strict';
import fs from 'node:fs';

import './deck-selection-transaction.test.mjs';
import './tournament-launch-transaction.test.mjs';

// A generált fájlt nem szerkesztjük kézzel. Az alap runtime-jelenlétet a már
// generált HTML-en, az új stabilizációs szolgáltatásokat pedig a forrás- és
// buildlistán ellenőrizzük; így az `npm test` a build előtt is determinisztikus.
const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const buildScript = read('../scripts/build-standalone.mjs');
const buildSettingsScript = read('../scripts/build-standalone-with-settings.mjs');
const mainSource = read('../js/main.js');
const seasonSaveSource = read('../js/services/season-save-service.js');
const quickMatchSource = read('../js/services/quick-match-storage-service.js');
const tournamentStorageSource = read('../js/services/tournament-storage-service.js');
const standalone = read('../Fociskartyak2026.html');

assert.match(
  buildScript,
  /'js\/game\/game-runtime\.js'/,
  'Az önálló build modulrendjéből hiányzik a GameRuntime.',
);
assert.match(
  standalone,
  /class GameRuntime\b/,
  'A generált önálló HTML nem tartalmazza a GameRuntime osztályt.',
);
assert.match(
  standalone,
  /new GameRuntime\(\{ players: deck \}\)/,
  'A generált önálló HTML munkamenete nem a GameRuntime-ot használja.',
);

assert.match(mainSource, /launchInProgress/, 'A közös játékindítási zárolás hiányzik a forrásból.');
assert.match(seasonSaveSource, /SEASON_SAVE_STATUS/, 'A részletes mentésdiagnosztika hiányzik a forrásból.');
assert.match(
  tournamentStorageSource,
  /TOURNAMENT_PENDING_LAUNCH_STORAGE_KEY|fociskartyak\.tournament-pending-launch\.v1/,
  'A tranzakciós tornamérkőzés-staging hiányzik a forrásból.',
);
assert.match(
  quickMatchSource + tournamentStorageSource,
  /__FOCISKARTYAK_TOURNAMENT_LAUNCH_TRANSACTION__/,
  'A lapos standalone modulrendhez szükséges későn feloldott torna-hook hiányzik.',
);
for (const file of [
  'js/services/quick-match-storage-service.js',
  'js/services/tournament-storage-service.js',
  'js/services/season-save-service.js',
  'js/game/game-runtime.js',
  'js/main.js',
]) {
  assert.ok(
    buildScript.includes(`'${file}'`) || buildSettingsScript.includes(`'${file}'`),
    `Az önálló build listájából hiányzik: ${file}`,
  );
}
assert.ok(
  buildSettingsScript.indexOf("'js/services/quick-match-storage-service.js'")
    < buildSettingsScript.indexOf("'js/services/tournament-storage-service.js'"),
  'A tesztnek a tényleges standalone betöltési sorrendet kell védenie.',
);
assert.doesNotMatch(
  standalone,
  /\bimport\s+[^;\n]*\sfrom\s+['"]\.\/game\/game-runtime\.js['"]/,
  'A generált önálló HTML-ben feloldatlan GameRuntime-import maradt.',
);
assert.doesNotMatch(
  standalone,
  /<script\s+type="module"\s+src=|<link\s+rel="stylesheet"\s+href=/,
  'A generált önálló HTML-ben külső modul- vagy stílushivatkozás maradt.',
);

console.log('✓ Standalone buildlánc: GameRuntime, mentésvédelem, Torna/Gyors meccs tranzakció és külső asset nélküli alap-HTML rendben');
