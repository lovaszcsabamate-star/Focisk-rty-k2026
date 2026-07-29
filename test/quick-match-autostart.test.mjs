import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainSource = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');

assert.match(
  mainSource,
  /consumeQuickMatchLaunch/,
  'A játékmenet-vezérlőnek be kell olvasnia az egyszeri Gyors meccs indítási kérést.',
);
assert.match(
  mainSource,
  /if \(quickMatchLaunch\) this\.start\(quickMatchLaunch\.mode, quickMatchLaunch\.difficulty\);/,
  'A Gyors meccset közvetlenül, szintetikus menükattintás nélkül kell elindítani.',
);
assert.match(
  mainSource,
  /const quickMatchLaunch = consumeQuickMatchLaunch\(\);[\s\S]*new Session\(players, source, meta, \{ quickMatchLaunch \}\);/,
  'Az indítási kérést a Session létrehozása előtt kell elfogyasztani és átadni.',
);

console.log('✓ A Gyors meccs közvetlen automatikus indítása regresszióvédett');
