import assert from 'node:assert/strict';
import fs from 'node:fs';

// A tesztet a build után kell futtatni, mert a kiadási és Android-folyamat ugyanazt az önálló HTML-t használja.
const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const buildScript = read('../scripts/build-standalone.mjs');
const buildSettingsScript = read('../scripts/build-standalone-with-settings.mjs');
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
assert.match(standalone, /launchInProgress/, 'A közös játékindítási zárolás nem került a standalone buildbe.');
assert.match(standalone, /SEASON_SAVE_STATUS/, 'A részletes mentésdiagnosztika nem került a standalone buildbe.');
assert.match(
  standalone,
  /TOURNAMENT_PENDING_LAUNCH_STORAGE_KEY|fociskartyak\.tournament-pending-launch\.v1/,
  'A tranzakciós tornamérkőzés-staging nem került a standalone buildbe.',
);
assert.match(
  standalone,
  /__FOCISKARTYAK_TOURNAMENT_LAUNCH_TRANSACTION__/,
  'A lapos standalone modulrendhez szükséges későn feloldott torna-hook hiányzik.',
);
assert.ok(
  buildSettingsScript.indexOf("'js/services/quick-match-storage-service.js'")
    < buildSettingsScript.indexOf("'js/services/tournament-storage-service.js'"),
  'A tesztnek a tényleges standalone betöltési sorrendet kell védenie.',
);
assert.doesNotMatch(
  standalone,
  /from ['"]\.\/game\/game-runtime\.js['"]/,
  'A generált önálló HTML-ben feloldatlan GameRuntime-import maradt.',
);
assert.doesNotMatch(
  standalone,
  /from ['"][^'"]+['"]|<script\s+type="module"\s+src=|<link\s+rel="stylesheet"\s+href=/,
  'A generált önálló HTML-ben külső modul- vagy stílushivatkozás maradt.',
);

console.log('✓ Standalone HTML: GameRuntime, mentésvédelem, Torna/Gyors meccs tranzakció és külső import nélküli build rendben');
