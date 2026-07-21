import assert from 'node:assert/strict';
import fs from 'node:fs';

import { PHASE } from '../js/engine.js';
import { matchdayScoreboardStatus } from '../js/matchday.js';
import {
  comparisonDirectionInstruction,
  normalizeLegacyOpponentId,
  verdictHeadline,
} from '../js/mobile-experience.js';
import { ageResultExplanation } from '../js/reliability-fixes.js';

globalThis.__FOCISKARTYAK_TEST__ = true;
const { restoreGameState, Session } = await import('../js/main.js');

assert.equal(matchdayScoreboardStatus({ phase: PHASE.CHOOSE_CARD, chooser: 'ai' }), 'KÁRTYÁT VÁLASZT');
assert.equal(matchdayScoreboardStatus({ phase: PHASE.CHOOSE_CARD, chooser: 'human' }), 'A GÉP VÁLASZT');
assert.equal(matchdayScoreboardStatus({ phase: PHASE.REVEAL, chooser: 'human' }), 'EREDMÉNY');

assert.equal(comparisonDirectionInstruction({ direction: 'lower' }), 'A kisebb érték a jobb');
assert.equal(comparisonDirectionInstruction({ direction: 'earlier' }), 'A korábbi érték a jobb');
assert.equal(comparisonDirectionInstruction({ direction: 'later' }), 'A későbbi érték a jobb');

assert.equal(
  verdictHeadline({ winner: 'tie' }, { mode: 'penalties' }),
  'Döntetlen – nincs gól',
);
assert.equal(
  verdictHeadline({ winner: 'tie' }, { mode: 'classic' }),
  'Döntetlen – a lapok a közös pakliba kerülnek',
);

const state = {
  phase: PHASE.CHOOSE_ATTRIBUTE,
  hands: { human: [{ id: 'human-card' }], ai: [{ id: 'ai-card' }] },
  played: { human: null, ai: null },
  rng: () => 0.5,
};
const snapshot = JSON.parse(JSON.stringify(state));
state.phase = PHASE.CHOOSE_CARD;
state.played.human = state.hands.human.pop();
restoreGameState(state, snapshot);
assert.equal(state.phase, PHASE.CHOOSE_ATTRIBUTE);
assert.equal(state.hands.human[0].id, 'human-card');
assert.equal(state.played.human, null);
assert.equal(typeof state.rng, 'function');

const tokenContext = {
  game: { phase: PHASE.CHOOSE_CARD },
  sessionVersion: 3,
  turnVersion: 8,
  flowVersion: 13,
};
assert.equal(Session.prototype._tokenIsCurrent.call(tokenContext, {
  game: tokenContext.game, session: 3, turn: 8, flow: 12,
}, [PHASE.CHOOSE_CARD], false), false, 'régi callback nem maradhat érvényes');
assert.equal(Session.prototype._tokenIsCurrent.call(tokenContext, {
  game: tokenContext.game, session: 3, turn: 8, flow: 13,
}, [PHASE.CHOOSE_CARD], false), true);

assert.equal(normalizeLegacyOpponentId('pub'), 'bogdan');
assert.equal(normalizeLegacyOpponentId('regular'), 'd-raven');
assert.equal(normalizeLegacyOpponentId('hard'), 'h-li');
assert.equal(normalizeLegacyOpponentId('project-9'), 'project-9');

const ageText = ageResultExplanation({
  attribute: 'birthDate',
  humanCard: { name: 'Fiatalabb', birthDate: '2002-05-10' },
  aiCard: { name: 'Idősebb', birthDate: '2002-01-10' },
});
assert.match(ageText, /^mindkettő \d+ éves, de Fiatalabb fiatalabb$/);

const mobileSource = fs.readFileSync(new URL('../js/mobile-experience.js', import.meta.url), 'utf8');
const mainSource = fs.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const focusSource = fs.readFileSync(new URL('../js/focus-experience.js', import.meta.url), 'utf8');
const swSource = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const mobileBuildSource = fs.readFileSync(new URL('../scripts/prepare-mobile.mjs', import.meta.url), 'utf8');
const penaltiesSource = fs.readFileSync(new URL('../js/penalties.js', import.meta.url), 'utf8');

assert.doesNotMatch(mobileSource, /globalThis\.setTimeout\s*=/, 'a globális setTimeout nem írható felül');
assert.match(mainSource, /_beginTransaction\('human-card'\)/);
assert.match(mainSource, /_rollbackTransaction/);
assert.match(mainSource, /this\.delay\(250, token/);
assert.match(mainSource, /this\.delay\(1200, token/);
assert.match(focusSource, /fociskartyak:interaction-invalidated/);
assert.match(focusSource, /overlay && !overlay\.hidden/);
assert.match(mobileSource, /document\.querySelectorAll\(GAME_ACTION_SELECTOR\)/);
assert.match(mobileSource, /#inspector \.inspector__actions button/);
assert.match(swSource, /key\.startsWith\(CACHE_PREFIX\) && key !== PWA_CACHE/);
assert.match(swSource, /catch \(error\)[\s\S]*return response;/);
assert.match(swSource, /event\?\.waitUntil\?\./);
assert.match(mobileBuildSource, /\['assets', 'assets'\]/);
assert.match(mobileBuildSource, /Figyelmeztetés/);
assert.match(penaltiesSource, /cycleHistory/);
assert.match(penaltiesSource, /this\.used\[HUMAN\]\.push/);
assert.match(penaltiesSource, /this\.used\[AI\]\.push/);

console.log('✓ Játékfolyam-, Büntetőpárbaj-, cache-, mentés- és mobil build regressziók rendben.');
