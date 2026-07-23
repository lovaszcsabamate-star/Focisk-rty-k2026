import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const ui = read('../js/ui.js');
const primitives = read('../js/ui/dom-primitives.js');
const card = read('../js/ui/card-component.js');
const scoreboard = read('../js/ui/scoreboard-component.js');
const picker = read('../js/ui/attribute-picker-component.js');
const build = read('../scripts/build-standalone.mjs');
const serviceWorker = read('../sw.js');

for (const source of [primitives, card, scoreboard, picker]) {
  assert.doesNotMatch(source, /class UI\b|class Session\b|GameRuntime/);
}

assert.match(primitives, /export const el/);
assert.match(primitives, /export function tryArt/);
assert.match(card, /export function createCardComponent/);
assert.match(card, /export function getCardRows/);
assert.match(scoreboard, /export function renderScoreboardComponent/);
assert.match(picker, /export function renderAttributePickerComponent/);

assert.match(ui, /createCardComponent/);
assert.match(ui, /renderScoreboardComponent/);
assert.match(ui, /renderAttributePickerComponent/);
assert.match(ui, /export \{ \$, ART, el \}/);
assert.doesNotMatch(ui, /CARD_ATTRIBUTE_KEYS/);
assert.doesNotMatch(ui, /_renderClassicScores|_renderPenaltyScores|_scoreChip|_cardRows/);

const moduleOrder = [
  'js/ui/dom-primitives.js',
  'js/ui/card-component.js',
  'js/ui/scoreboard-component.js',
  'js/ui/attribute-picker-component.js',
  'js/ui.js',
];
let previousIndex = -1;
for (const file of moduleOrder) {
  const index = build.indexOf(`'${file}'`);
  assert.ok(index > previousIndex, `Hibás vagy hiányzó önálló modulrend: ${file}`);
  previousIndex = index;
  assert.match(serviceWorker, new RegExp(file.replaceAll('/', '\\/').replaceAll('.', '\\.')));
}

console.log('✓ A vizuális réteg stabil DOM-, kártya-, eredményjelző- és kategóriaválasztó komponensekre bomlik');
