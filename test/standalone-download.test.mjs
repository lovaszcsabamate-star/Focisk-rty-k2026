import assert from 'node:assert/strict';
import fs from 'node:fs';

const standalone = fs.readFileSync(new URL('../Fociskartyak2026.html', import.meta.url), 'utf8');

assert.match(standalone, /<!DOCTYPE html>/i);
assert.match(standalone, /globalThis\.__EMBEDDED_PLAYER_DATA__/);
assert.match(standalone, /standalone deck selection bootstrap/);
assert.doesNotMatch(standalone, /<script\s+type="module"\s+src=/i);
assert.doesNotMatch(standalone, /<link\s+rel="stylesheet"\s+href=/i);
assert.doesNotMatch(standalone, /<link\s+rel="manifest"/i);
assert.doesNotMatch(standalone, /src\/assets\/placeholders\/app-icon\.svg/i);

console.log('✓ Az önálló HTML külső fájlok nélkül letölthető és futtatható');
