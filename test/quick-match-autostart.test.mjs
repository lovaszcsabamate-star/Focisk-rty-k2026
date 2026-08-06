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
const quickMatchConstructorFlow = mainSource.match(
  /if \(quickMatchLaunch\)[\s\S]*?else \{[\s\S]*?showTitleScreen\(\{ offerOnboarding: true \}\);[\s\S]*?\}/,
)?.[0] ?? '';
assert.match(
  quickMatchConstructorFlow,
  /this\.start\(quickMatchLaunch\.mode, quickMatchLaunch\.difficulty\);/,
  'A Gyors meccset közvetlenül, a kód tördelésétől függetlenül kell elindítani.',
);
assert.doesNotMatch(
  quickMatchConstructorFlow,
  /\.click\(/,
  'A Gyors meccs automatikus indítása nem használhat szintetikus menükattintást.',
);
assert.match(
  mainSource,
  /const quickMatchLaunch = consumeQuickMatchLaunch\(\);[\s\S]*new Session\(players, source, meta, \{ quickMatchLaunch \}\);/,
  'Az indítási kérést a Session létrehozása előtt kell elfogyasztani és átadni.',
);

console.log('✓ A Gyors meccs közvetlen automatikus indítása regresszióvédett');
