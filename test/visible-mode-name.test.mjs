import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const visibleSources = [
  'index.html',
  'manifest.webmanifest',
  'js/app/menu-controller.js',
  'js/main.js',
  'js/mobile-experience.js',
  'js/player-profile.js',
  'js/legal-ui.js',
  'js/reliability-fixes.js',
  'js/visual-hierarchy.js',
];

for (const relative of visibleSources) {
  const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  assert.doesNotMatch(source, /Penalties mód|Tizenegyes mód/u, `${relative}: régi, látható játékmódnév maradt`);
}

const menu = fs.readFileSync(path.join(ROOT, 'js/app/menu-controller.js'), 'utf8');
for (const required of [
  '⚽ Büntetőpárbaj',
  "saved.mode === 'penalties' ? 'Büntetőpárbaj'",
  "current.mode === 'penalties' ? 'Büntetőpárbaj'",
  '<h2>⚽ Büntetőpárbaj</h2>',
  '<p class=\"eyebrow\">Büntetőpárbaj</p>',
]) assert.match(menu, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

console.log('✓ Minden látható felületi forrás a Büntetőpárbaj elnevezést használja');
