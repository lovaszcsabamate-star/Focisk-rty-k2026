import assert from 'node:assert/strict';
import fs from 'node:fs';

// A tesztet a build után kell futtatni, mert a kiadási és Android-folyamat ugyanazt az önálló HTML-t használja.
const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const buildScript = read('../scripts/build-standalone.mjs');
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
assert.doesNotMatch(
  standalone,
  /from ['"]\.\/game\/game-runtime\.js['"]/,
  'A generált önálló HTML-ben feloldatlan GameRuntime-import maradt.',
);

console.log('✓ Az önálló HTML tartalmazza a DOM-mentes GameRuntime-ot, feloldatlan import nélkül');
