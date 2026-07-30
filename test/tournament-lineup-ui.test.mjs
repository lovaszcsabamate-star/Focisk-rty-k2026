import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = relative => fs.readFileSync(path.resolve(here, relative), 'utf8');

const controller = read('../js/tournament/tournament-lineup-controller.js');
const lineupState = read('../js/tournament/tournament-lineup-state.js');
const deckSelection = read('../js/deck-selection.js');
const penalties = read('../js/penalties.js');
const bootstrap = read('../js/bootstrap.js');
const bundler = read('../scripts/build-standalone-with-settings.mjs');
const matchday = read('../js/matchday.js');

assert.match(controller, /Automatikus összeállítás/);
assert.match(controller, /Legutóbbi összeállítás használata/);
assert.match(controller, /Alaphelyzet visszaállítása/);
assert.match(controller, /Kedvenc összeállítás mentése/);
assert.match(controller, /Kedvenc összeállítás használata/);
assert.match(controller, /Mentés csak az aktuális mérkőzésre/);
assert.match(controller, /aria-pressed=/);
assert.match(controller, /aria-label=/);
assert.match(controller, /min-width:44px/);
assert.match(controller, /min-height:44px/);
assert.match(controller, /validation\.valid && !runtime\.launching/);
assert.match(controller, /event\.stopImmediatePropagation\(\)/);
assert.match(controller, /globalThis\.addEventListener\?\.\('popstate'/);
assert.match(controller, /event\.preventDefault\(\);\s*event\.stopPropagation\(\)/);
assert.doesNotMatch(controller, /MutationObserver/);
assert.doesNotMatch(controller, /GameRuntime\.prototype\.result/);

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

assert.match(bootstrap, /installTournamentLineupController/);
assert.match(bundler, /tournament-lineup-state\.js/);
assert.match(bundler, /tournament-lineup-controller\.js/);
assert.match(bundler, /file\.endsWith\('tournament-lineup-controller\.js'\)/);
assert.match(matchday, /Meccs újrajátszása/);
assert.match(matchday, /Torna kezdőlapja/);

console.log('✓ A keretválasztó egyetlen Torna UI-t használ, akadálymentes és megőrzi a jelenlegi eredmény-véglegesítést.');
