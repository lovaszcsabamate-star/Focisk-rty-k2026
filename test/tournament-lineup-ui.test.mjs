import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  tournamentLineupPositionGroup,
  tournamentLineupPositionSummary,
} from '../js/tournament/tournament-lineup-controller.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = relative => fs.readFileSync(path.resolve(here, relative), 'utf8');

const controller = read('../js/tournament/tournament-lineup-controller.js');
const lineupState = read('../js/tournament/tournament-lineup-state.js');
const deckSelection = read('../js/deck-selection.js');
const penalties = read('../js/penalties.js');
const bootstrap = read('../js/bootstrap.js');
const bundler = read('../scripts/build-standalone-with-settings.mjs');
const tournamentMode = read('../js/tournament-mode.js');
const tournamentCss = read('../css/tournament-mode.css');
const mobileLayout = read('../scripts/mobile-layout-smoke.mjs');
const matchday = read('../js/matchday.js');

assert.match(controller, /⚡ Automatikus 11/);
assert.match(controller, /↩ Legutóbbi keret/);
assert.match(controller, /↺ Alaphelyzet/);
assert.match(controller, /☆ Mentés kedvencként/);
assert.match(controller, /⭐ Kedvenc keret/);
assert.match(controller, /Mentés erre a mérkőzésre/);
assert.match(controller, /▶ MÉRKŐZÉS INDÍTÁSA/);
assert.match(controller, /Meccsnapi keret/);
assert.match(controller, /KEZDŐCSAPAT/);
assert.match(controller, /Büntetőrúgók sorrendje/);
assert.match(controller, /GK/);
assert.match(controller, /DEF/);
assert.match(controller, /MID/);
assert.match(controller, /ATT/);
assert.match(controller, /Tájékoztató jellegű · nincs kötelező formáció/);
assert.match(controller, /aria-pressed=/);
assert.match(controller, /aria-label=/);
assert.match(controller, /min-width:44px/);
assert.match(controller, /min-height:44px/);
assert.match(controller, /selected\.length < TOURNAMENT_LINEUP_SIZE/);
assert.match(controller, /validation\.valid && !runtime\.launching/);
assert.match(controller, /if \(runtime\.launching\) return/);
assert.match(controller, /position:sticky/);
assert.match(controller, /@media\(max-width:760px\)/);
assert.match(controller, /@media\(max-width:420px\)/);
assert.match(controller, /overflow-x:hidden/);
assert.match(controller, /event\.stopImmediatePropagation\(\)/);
assert.match(controller, /globalThis\.addEventListener\?\.\('popstate'/);
assert.match(controller, /event\.preventDefault\(\);\s*event\.stopPropagation\(\)/);
assert.doesNotMatch(controller, /MutationObserver/);
assert.doesNotMatch(controller, /GameRuntime\.prototype\.result/);
assert.doesNotMatch(controller, /marketValue[^\n]*innerHTML/);

assert.equal(tournamentLineupPositionGroup({ position: 'Kapus' }), 'GK');
assert.equal(tournamentLineupPositionGroup({ position: 'Centre-Back' }), 'DEF');
assert.equal(tournamentLineupPositionGroup({ position: 'Középpályás' }), 'MID');
assert.equal(tournamentLineupPositionGroup({ position: 'Striker' }), 'ATT');
assert.equal(tournamentLineupPositionGroup({ position: '' }), null);
const summary = tournamentLineupPositionSummary(
  ['gk', 'def1', 'def2', 'mid', 'att'],
  [
    { id: 'gk', position: 'Goalkeeper' },
    { id: 'def1', position: 'Defender' },
    { id: 'def2', position: 'Right-Back' },
    { id: 'mid', position: 'Midfielder' },
    { id: 'att', position: 'Forward' },
    { id: 'bench', position: 'Forward' },
  ],
);
assert.deepEqual(summary, { GK: 1, DEF: 2, MID: 1, ATT: 1 });

assert.match(lineupState, /lineupState\.byMatchId/);
assert.match(lineupState, /favoriteLineupIds/);
assert.match(lineupState, /penaltyOrders/);
assert.match(lineupState, /missingOrForeignCount/);
assert.match(lineupState, /TOURNAMENT_LINEUP_SIZE = 11/);

assert.match(deckSelection, /tournamentLineupOrder/);
assert.match(deckSelection, /humanIds: orderedHuman\.map/);
assert.match(penalties, /orderedTournamentHuman \?\? shuffle/);
assert.match(penalties, /if \(winner !== 'tie'\) this\.scores\[winner\] \+= 1/);
assert.doesNotMatch(penalties, /mindkét csapat gólt/);

assert.match(bootstrap, /tournament\/tournament-lineup-controller\.js/);
assert.match(bundler, /tournament-lineup-state\.js/);
assert.match(bundler, /tournament-lineup-controller\.js/);
assert.match(bundler, /file === 'js\/tournament\/cup-atmosphere\.js' \|\| file === 'js\/tournament\/tournament-lineup-controller\.js'/);
assert.match(tournamentMode, /id="tournament-play"/);
assert.match(tournamentMode, /storedTournamentLineup\(state, 'last', humanCards\)/);
assert.match(tournamentMode, /✓ Legutóbbi keret elérhető/);
assert.match(tournamentMode, /tournament-next-match-meta/);
assert.match(tournamentCss, /Tournament Lineup 1\.1 — next match readiness/);
assert.match(tournamentCss, /tournament-next-match-meta/);
assert.match(mobileLayout, /WIDTHS = \[320, 360, 390, 412, 480\]/);
assert.match(matchday, /Meccs újrajátszása/);
assert.match(matchday, /Torna kezdőlapja/);

console.log('✓ Tournament Lineup 1.1: meccsnapi keret, 11\/11 státusz, pozíciósegéd, mobil UX és Torna-központ jelzések rendben.');
