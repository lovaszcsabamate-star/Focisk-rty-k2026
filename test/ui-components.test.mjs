// A vizuális és játékmenet-regressziók forrásszintű ellenőrzése.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const ui = read('../js/ui.js');
const primitives = read('../js/ui/dom-primitives.js');
const card = read('../js/ui/card-component.js');
const scoreboard = read('../js/ui/scoreboard-component.js');
const picker = read('../js/ui/attribute-picker-component.js');
const matchday = read('../js/matchday.js');
const matchdayCss = read('../css/matchday.css');
const configuration = read('../js/app/configuration.js');
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

assert.match(configuration, /timedTurns:\s*'fociskartyak:timedTurns'/);
assert.match(configuration, /timedTurns:\s*false/);
assert.match(scoreboard, /outcome === 'win' \|\| outcome === 'tie' \? '⚽'/);
assert.match(matchday, /CHOICE_LIMIT_SECONDS = 90/);
assert.match(matchday, /writeStoredBoolean\(TIMED_TURNS_KEY/);
assert.match(matchday, /\['3', '2', '1', '📣 SÍP!'\]/);
assert.match(matchday, /function prepareWhistle/);
assert.match(matchday, /dataset\.matchClock/);
assert.match(matchday, /dataset\.choiceClock/);
assert.match(matchday, /Meccs újrajátszása/);
assert.match(matchday, /Torna kezdőlapja/);
assert.match(matchdayCss, /match-scoreboard__clock/);
assert.match(matchdayCss, /matchday-kickoff/);

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

console.log('✓ A vizuális réteg, sporteredményjelző, torna-visszajátszás és időzítés regressziói ellenőrizve');
