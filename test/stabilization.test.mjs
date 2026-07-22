import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const text = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
};

const profile = await import('../js/player-profile.js');
assert.equal(profile.normalizePlayerName('  Csabi   Kapitány  '), 'Csabi Kapitány');
assert.equal(profile.normalizePlayerName(''), '');
assert.equal(profile.normalizePlayerName('x'.repeat(40)).length, 24);
assert.equal(profile.loadPlayerName(), 'Játékos');
assert.equal(profile.savePlayerName('  Csabi  '), 'Csabi');
assert.equal(profile.loadPlayerName(), 'Csabi');
assert.equal(profile.savePlayerName('   '), 'Játékos');
assert.equal(profile.loadPlayerName(), 'Játékos');

const playerProfileSource = text('js/player-profile.js');
assert.doesNotMatch(playerProfileSource, /MutationObserver/);
assert.doesNotMatch(playerProfileSource, /replaceAll\(['"]Penalties/);
assert.doesNotMatch(playerProfileSource, /innerHTML\s*=/);

for (const deleted of [
  'js/focus-experience.js',
  'css/mobile-overlay-fix.css',
  'css/player-profile.css',
  'css/focus-experience.css',
  'css/mobile-selection-fix.css',
  'css/duel-emphasis.css',
  'css/phase-refinements.css',
]) assert.equal(fs.existsSync(path.join(ROOT, deleted)), false, `A felesleges fájl megmaradt: ${deleted}`);

const visibleSources = [
  'index.html', 'js/main.js', 'js/matchday.js', 'js/mobile-experience.js',
  'README.md', 'manifest.webmanifest', 'Fociskartyak2026.html',
].map(text).join('\n');
assert.doesNotMatch(visibleSources, /Penalties mód/u);
assert.doesNotMatch(visibleSources, /Tizenegyes mód/u);
assert.doesNotMatch(visibleSources, />\s*Penalties\s*</u);

const index = text('index.html');
const serviceWorker = text('sw.js');
const build = text('scripts/build-standalone.mjs');
for (const removedName of [
  'mobile-overlay-fix', 'player-profile.css', 'focus-experience.css',
  'mobile-selection-fix', 'duel-emphasis', 'phase-refinements',
  'focus-experience.js',
]) {
  assert.equal(index.includes(removedName), false, `Törött index-hivatkozás: ${removedName}`);
  assert.equal(serviceWorker.includes(removedName), false, `Törött cache-hivatkozás: ${removedName}`);
  assert.equal(build.includes(removedName), false, `Törött standalone-hivatkozás: ${removedName}`);
}

if (fs.existsSync(path.join(ROOT, 'js/usability-fixes.js'))) {
  const usability = text('js/usability-fixes.js');
  assert.match(usability, /syncHandInspectorButton/);
  assert.match(usability, /INSPECTOR_BACKDROP_ID/);
  assert.match(index, /js\/usability-fixes\.js/);
  assert.match(serviceWorker, /js\/usability-fixes\.js/);
  assert.match(build, /js\/usability-fixes\.js/);
}

assert.match(text('css/mobile-experience.css'), /--battle-card-width/);
assert.match(text('css/mobile-experience.css'), /prefers-reduced-motion/);
assert.match(text('JATEK_INDITASA.bat'), /--check/);
assert.match(text('.github/workflows/ci.yml'), /npm ci/);
