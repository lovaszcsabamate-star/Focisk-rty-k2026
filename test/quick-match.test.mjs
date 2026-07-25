import assert from 'node:assert/strict';
import fs from 'node:fs';

import { HUMAN, AI } from '../js/engine.js';
import {
  DEFAULT_QUICK_MATCH_DECK_SIZE,
  MIN_QUICK_MATCH_TEAM_SIZE,
  QUICK_MATCH_CATEGORY,
  buildQuickMatchDecks,
  buildQuickMatchTeams,
  chooseQuickMatchOpponent,
  createQuickMatchConfig,
  quickMatchNationKeys,
  quickMatchTeamsForCategory,
  resolveQuickMatchTeamPlayers,
} from '../js/domain/quick-match-domain.js';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const aliases = {
  Hungary: ['Hungary', 'HUN', 'Magyarország', 'magyar', 'HU', 'Hungarian', 'HUN'],
  Serbia: ['Serbia', 'SRB', 'Szerbia', 'szerb', 'RS', 'Serbian', 'SRB'],
  Romania: ['Romania', 'ROU', 'Románia', 'román', 'RO', 'Romanian', 'ROU'],
  Slovakia: ['Slovakia', 'SVK', 'Szlovákia', 'szlovák', 'SK', 'Slovak'],
};

const makePlayers = (club, nationValues, offset) => nationValues.map((nation, index) => ({
  id: `${club.toLocaleLowerCase('hu-HU').replace(/\s+/g, '-')}-${offset + index}`,
  name: `${club} játékos ${index + 1}`,
  club,
  nation,
  birthDate: `199${index % 9}-0${(index % 8) + 1}-01`,
  stats: {
    appearances: 10 + index,
    starts: 5 + index,
    goals: index,
    yellowCards: index % 4,
    redCards: index % 6 === 0 ? 1 : 0,
  },
}));

const players = [
  ...makePlayers('Alfa FC', aliases.Hungary, 0),
  ...makePlayers('Béta FC', aliases.Serbia, 20),
  ...makePlayers('Gamma FC', aliases.Romania, 40),
  ...makePlayers('Delta FC', aliases.Slovakia, 60),
  { id: 'invalid-nation', name: 'Hibás nemzetiség', club: 'Delta FC', nation: '', stats: { goals: 0 } },
];

assert.equal(MIN_QUICK_MATCH_TEAM_SIZE, 7);
assert.equal(DEFAULT_QUICK_MATCH_DECK_SIZE, 7);
assert.deepEqual(quickMatchNationKeys('Hungary / HUN / Magyarország'), ['hungary']);
assert.deepEqual(quickMatchNationKeys('SRB; Szerbia'), ['serbia']);

const catalog = buildQuickMatchTeams(players, { minimum: 7 });
const clubs = quickMatchTeamsForCategory(catalog, QUICK_MATCH_CATEGORY.HUNGARIAN_LEAGUE);
const nations = quickMatchTeamsForCategory(catalog, QUICK_MATCH_CATEGORY.NATIONAL);

assert.equal(clubs.length, 4, 'mind a négy legalább hétfős klub megjelenik');
assert.equal(nations.some(team => team.id === 'national:slovakia'), false, 'a hat érvényes szlovák játékos nem elég');
assert.equal(nations.some(team => team.id === 'national:hungary'), true, 'a hét magyar játékos elég');
assert.equal(nations.some(team => team.id === 'national:serbia'), true, 'a hét szerb játékos elég');
assert.equal(nations.some(team => team.id === 'national:romania'), true, 'a hét román játékos elég');
assert.equal(nations.length, 3, 'három, legalább hétfős válogatott készül');

const hungary = nations.find(team => team.id === 'national:hungary');
assert.equal(hungary.playerIds.length, 7, 'a normalizált magyar aliasok egy válogatottba kerülnek');
assert.equal(new Set(hungary.playerIds).size, hungary.playerIds.length, 'egy játékos csak egyszer szerepel');

const selected = clubs[0];
const firstOpponent = chooseQuickMatchOpponent(selected, clubs, { rng: () => 0 });
assert.ok(firstOpponent);
assert.notEqual(firstOpponent.id, selected.id, 'a gép nem választhatja ugyanazt a csapatot');

const secondOpponent = chooseQuickMatchOpponent(selected, clubs, {
  lastOpponentIds: [firstOpponent.id],
  rng: () => 0,
});
assert.ok(secondOpponent);
assert.notEqual(secondOpponent.id, selected.id);
assert.notEqual(secondOpponent.id, firstOpponent.id, 'a Másik ellenfél nem ismétel azonnal, ha van más lehetőség');

const decks = buildQuickMatchDecks(selected, firstOpponent, players, {
  deckSize: 7,
  rng: () => 0.25,
});
assert.equal(decks.matchDeckSize, 7);
assert.equal(decks.teamDecks[HUMAN].length, decks.teamDecks[AI].length, 'a két pakli azonos méretű');
assert.equal(decks.teamDecks[HUMAN].length, 7);

const selectedIds = new Set(selected.playerIds);
const opponentIds = new Set(firstOpponent.playerIds);
assert.ok(decks.teamDecks[HUMAN].every(player => selectedIds.has(player.id)), 'a saját pakli csak saját csapatjátékost tartalmaz');
assert.ok(decks.teamDecks[AI].every(player => opponentIds.has(player.id)), 'a gépi pakli csak ellenféljátékost tartalmaz');
assert.deepEqual(
  resolveQuickMatchTeamPlayers(selected, players).map(player => player.id).sort(),
  [...selectedIds].sort(),
);

const config = createQuickMatchConfig({
  playerTeam: selected,
  opponentTeam: firstOpponent,
  deckSize: decks.matchDeckSize,
  enabledComparisonCategories: ['goals', 'goals', 'yellowCards'],
});
assert.equal(config.mode, 'quick-match');
assert.notEqual(config.playerTeamId, config.opponentTeamId);
assert.equal(config.deckSize, 7);
assert.deepEqual(config.enabledComparisonCategories, ['goals', 'yellowCards']);

assert.throws(
  () => buildQuickMatchDecks(selected, selected, players),
  /két különböző csapat/i,
);

const controllerSource = read('../js/app/quick-match-controller.js');
const resultSource = read('../js/app/result-controller.js');
const cssSource = read('../css/quick-match.css');
const indexSource = read('../index.html');
const serviceWorkerSource = read('../sw.js');
const mainSource = read('../js/main.js');

assert.match(controllerSource, /aria-label.*elérhető kártya/s, 'a csempék értelmes aria-labelt kapnak');
assert.match(controllerSource, /QUICK_MATCH_EMPTY_CATEGORY_MESSAGE/);
assert.match(controllerSource, /Másik ellenfél/);
assert.match(controllerSource, /MECCS INDÍTÁSA/);
assert.match(controllerSource, /quick-match-badge-fallback/, 'hiányzó logóhoz helyettesítő grafika tartozik');
assert.match(resultSource, /Visszavágó/);
assert.match(resultSource, /Másik ellenfél/);
assert.match(resultSource, /Másik csapat választása/);
assert.match(resultSource, /Vissza a főmenübe/);
assert.match(resultSource, /result-panel--quick-match/, 'külön Gyors meccs eredményképernyő készül');
assert.match(cssSource, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(150px,\s*1fr\)\)/);
assert.match(cssSource, /@media \(max-width: 620px\)/);
assert.match(cssSource, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
assert.match(cssSource, /@media \(max-width: 390px\)[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
assert.doesNotMatch(cssSource, /position:\s*absolute[\s\S]{0,120}\.quick-match-team-tile\s*\{/);
assert.match(indexSource, /css\/quick-match\.css/);
assert.match(serviceWorkerSource, /\.\/css\/quick-match\.css/);
assert.match(serviceWorkerSource, /\.\/js\/domain\/quick-match-domain\.js/);
assert.match(mainSource, /runtime\.start\(mode/);
assert.match(mainSource, /mode === 'quick-match'/);
assert.match(mainSource, /mode === 'penalties'/);

console.log('✓ Gyors meccs: csapatok, nemzetiségnormalizálás, ellenfél, paklik, eredmény és mobilrács rendben');
