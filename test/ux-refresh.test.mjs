import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildRecentDuelHistory,
  summariseClassicMatch,
} from '../js/domain/match-summary.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const card = (id, name, club, goals) => ({ id, name, club, stats: { goals } });
const a = card('a', 'A Játékos', 'Paksi FC', 6);
const b = card('b', 'B Játékos', 'DVTK', 2);
const c = card('c', 'C Játékos', 'ETO FC Győr', 5);
const d = card('d', 'D Játékos', 'Újpest FC', 3);
const log = [
  { round: 1, attribute: 'goals', humanCard: a, aiCard: b, winner: 'human' },
  { round: 2, attribute: 'yellowCards', humanCard: b, aiCard: c, winner: 'ai' },
  { round: 3, attribute: 'goals', humanCard: c, aiCard: c, winner: 'tie' },
  { round: 4, attribute: 'goals', humanCard: a, aiCard: d, winner: 'human' },
  { round: 5, attribute: 'yellowCards', humanCard: a, aiCard: b, winner: 'human' },
];
const registry = {
  goals: { icon: '⚽', label: 'Több gól' },
  yellowCards: { icon: '🟨', label: 'Több sárga lap' },
};
const values = (player, key) => key === 'goals' ? player.stats.goals : player.id.charCodeAt(0) % 5;
const formatted = (player, key) => String(values(player, key));

const summary = summariseClassicMatch({
  game: { log },
  result: { human: 31, ai: 21 },
  attributeRegistry: registry,
  attributeValue: values,
});
assert.deepEqual(summary.finalScore, { human: 31, ai: 21 });
assert.equal(summary.rounds, 5);
assert.equal(summary.humanWins, 3);
assert.equal(summary.aiWins, 1);
assert.equal(summary.ties, 1);
assert.equal(summary.bestCategory.key, 'goals');
assert.equal(summary.bestCategory.wins, 2);
assert.equal(summary.playerOfMatch.name, 'A Játékos');
assert.equal(summary.playerOfMatch.club, 'Paksi FC');
assert.equal(summary.playerOfMatch.wins, 3);

const history = buildRecentDuelHistory(log, {
  attributeRegistry: registry,
  formatValue: formatted,
});
assert.equal(history.length, 3);
assert.deepEqual(history.map(item => item.round), [3, 4, 5]);
assert.deepEqual(history.map(item => item.result), ['Döntetlen', 'Győzelem', 'Győzelem']);
assert.match(history[1].values, /6–3/);

const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
};
const opponents = await import('../js/opponents.js');
opponents.selectOpponentById('d-raven');
const firstRandom = opponents.pickRandomOpponent({ rng: () => 0 });
const secondRandom = opponents.pickRandomOpponent({ rng: () => 0 });
assert.ok(opponents.OPPONENTS.includes(firstRandom));
assert.ok(opponents.OPPONENTS.includes(secondRandom));
assert.notEqual(firstRandom.id, secondRandom.id, 'két egymást követő gyors meccs ne ugyanazt az ellenfelet sorsolja');
opponents.activateMatchOpponent(firstRandom.id);
assert.equal(opponents.getActiveOpponent().id, firstRandom.id);
assert.equal(opponents.getSelectedOpponent().id, 'd-raven', 'az ideiglenes ellenfél nem írhatja felül a mentett választást');
opponents.clearMatchOpponent();
assert.equal(opponents.getActiveOpponent().id, 'd-raven');

const menuSource = read('js/app/menu-controller.js');
const categorySource = read('js/category-picker.js');
const legalSource = read('js/legal-ui.js');
const profileSource = read('js/player-profile.js');
const matchExperienceSource = read('js/match-experience.js');
const styleSource = read('css/ux-refresh.css');
const configurationSource = read('js/app/configuration.js');
const buildSource = read('scripts/build-standalone.mjs');
const serviceWorkerSource = read('sw.js');

assert.match(menuSource, /⚡ Gyors meccs/);
assert.match(menuSource, /Igen, gyors meccs/);
assert.match(menuSource, /Aktuális mérkőzés/);
assert.match(menuSource, /Büntetőpárbaj/);
assert.doesNotMatch(menuSource, /Penalties mód|Tizenegyes mód/);
assert.match(categorySource, /Alapadatok[\s\S]*Pályára lépés[\s\S]*Támadás[\s\S]*Fegyelem/);
assert.match(categorySource, /Korlátozott adatok/);
assert.match(categorySource, /Tovább a kártyákhoz/);
assert.match(matchExperienceSource, /slice\(-3\)/);
assert.match(styleSource, /recent-duels/);
assert.match(styleSource, /min-height:\s*44px/);
assert.match(
  styleSource,
  /#pub\.is-duel-focus #felt:has\(> \.recent-duels:not\(\[hidden\]\)\)[\s\S]*overflow-y:\s*auto/,
  'A mobil eredményfázisnak tényleges helyet kell biztosítania a háromsoros párbajtörténetnek.',
);
assert.match(
  styleSource,
  /#pub\.is-duel-focus #felt:has\(> \.recent-duels:not\(\[hidden\]\)\) #duel[\s\S]*--duel-card-h:\s*clamp\(196px, 60vw, 242px\)/,
  'A látható mobil előzménylista mellett a csatakártyáknak kompaktabbnak kell lenniük.',
);
assert.doesNotMatch(legalSource, /REPLACEMENTS|localiseText/);
assert.doesNotMatch(profileSource, /INTERFACE_TEXT_REPLACEMENTS|replaceAll\(source/);
assert.match(configurationSource, /SAVED_MATCH_VERSION\s*=\s*2/);
assert.match(buildSource, /js\/domain\/match-summary\.js/);
assert.match(buildSource, /js\/match-experience\.js/);
assert.match(buildSource, /css\/ux-refresh\.css/);
assert.match(serviceWorkerSource, /fociskartyak-2026-v72/);
assert.match(serviceWorkerSource, /js\/domain\/match-summary\.js/);
assert.match(serviceWorkerSource, /js\/match-experience\.js/);
assert.match(serviceWorkerSource, /css\/ux-refresh\.css/);

for (const relative of [
  'js/app/menu-controller.js',
  'js/app/result-controller.js',
  'js/app/round-controller.js',
  'js/mobile-experience.js',
  'js/player-profile.js',
  'js/legal-ui.js',
]) {
  const source = read(relative);
  assert.doesNotMatch(source, /['"`]Penalties mód|['"`]Tizenegyes mód/, `${relative}: hibás felületi módnév maradt`);
}

console.log('✓ Gyors meccs, mérkőzés-összesítő, kategóriacsoportok és háromsoros előzmény: rendben');
