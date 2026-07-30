import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const source = read('../js/tournament-cup-experience.js');
const bootstrap = read('../js/bootstrap.js');
const build = read('../scripts/build-standalone-with-settings.mjs');
const workflow = read('../.github/workflows/tournament-mode.yml');

assert.match(source, /tournament-format-showcase/);
assert.match(source, /tournament-final-intro/);
assert.match(source, /tournament-bracket-team/);
assert.match(source, /cupExperienceCreateMark/);
assert.match(source, /buildQuickMatchCatalog/);
assert.match(source, /tournamentStorageService\.read/);
assert.match(source, /tournamentNextHumanMatch/);
assert.match(source, /Koppints az átugráshoz/);
assert.match(source, /prefers-reduced-motion/);
assert.match(source, /aria-live/);
assert.match(source, /aria-label/);

assert.ok(
  bootstrap.indexOf("await import('./tournament-mode.js')")
    < bootstrap.indexOf("await import('./tournament-cup-experience.js')"),
  'a kupaélménynek a Torna mód után kell betöltődnie',
);
assert.match(build, /js\/tournament-cup-experience\.js/);
assert.match(build, /tournament-format-showcase/);
assert.match(build, /tournament-final-intro/);
assert.match(workflow, /tournament-cup-experience\.test\.mjs/);

console.log('✓ Kupaélmény: serlegkártyák, csapatjelvények, kupaág és döntő átvezető integrációja rendben.');
