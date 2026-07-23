import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const ui = read('../js/ui.js');
const dom = read('../js/ui/dom.js');
const card = read('../js/ui/card-view.js');
const scoreboard = read('../js/ui/scoreboard-view.js');
const match = read('../js/ui/match-view.js');
const feedback = read('../js/ui/feedback-view.js');
const build = read('../scripts/build-standalone.mjs');
const serviceWorker = read('../sw.js');
const standalone = read('../Fociskartyak2026.html');

for (const [source, className] of [
  [card, 'CardView'],
  [scoreboard, 'ScoreboardView'],
  [match, 'MatchView'],
  [feedback, 'FeedbackView'],
]) {
  assert.match(source, new RegExp(`export class ${className}\\b`), `Hiányzó UI-komponens: ${className}`);
}

assert.match(dom, /export const ART/);
assert.match(dom, /export const el/);
assert.match(dom, /export function tryArt/);

for (const component of ['CardView', 'ScoreboardView', 'MatchView', 'FeedbackView']) {
  assert.match(ui, new RegExp(`new ${component}\\b`), `A UI homlokzat nem példányosítja: ${component}`);
}

for (const method of [
  'renderCard', 'renderHands', 'openInspector', 'closeInspector', '_renderInspector', '_inspectorStep',
  'renderScores', '_renderClassicScores', '_renderPenaltyScores', '_renderPiles',
  'showAttributePicker', 'showDuel', 'showVerdict', 'showOverlay',
]) {
  assert.match(ui, new RegExp(`\\n  ${method.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\(`), `A patch-elhető UI metódus eltűnt: ${method}`);
}

assert.match(card, /card__portrait/);
assert.match(scoreboard, /attempt-row/);
assert.match(match, /GÓL A JÁTÉKOSNAK/);
assert.match(feedback, /createOscillator/);

for (const path of [
  'js/ui/dom.js',
  'js/ui/card-view.js',
  'js/ui/scoreboard-view.js',
  'js/ui/match-view.js',
  'js/ui/feedback-view.js',
]) {
  const escaped = path.replaceAll('.', '\\.').replaceAll('/', '\\/');
  assert.match(build, new RegExp(`'${escaped}'`), `Az önálló buildből hiányzik: ${path}`);
  assert.match(serviceWorker, new RegExp(escaped), `A PWA cache-ből hiányzik: ${path}`);
}

for (const className of ['CardView', 'ScoreboardView', 'MatchView', 'FeedbackView']) {
  assert.match(standalone, new RegExp(`class ${className}\\b`), `Az önálló HTML-ből hiányzik: ${className}`);
}
assert.doesNotMatch(standalone, /from ['"]\.\/ui\//, 'Feloldatlan UI-komponens import maradt az önálló HTML-ben.');

console.log('✓ A UI homlokzat, a külön nézetkomponensek, a patch-elhető hookok és az offline build szerződése rendben');
