import assert from 'node:assert/strict';
import fs from 'node:fs';

import { HUMAN } from '../js/engine.js';
import {
  MATCH_EXPERIENCE_POLISH_VERSION,
  matchExperienceBestCategory,
  matchExperienceSecondaryLabel,
} from '../js/match-experience-polish.js';
import { opponentPersona } from '../js/opponents.js';

assert.equal(MATCH_EXPERIENCE_POLISH_VERSION, 2);

{
  const label = matchExperienceSecondaryLabel({
    mode: 'classic',
    round: 7,
    chooser: HUMAN,
    attribute: 'heightCm',
  });
  assert.match(label, /^7\. kör/);
  assert.match(label, /Magasabb játékos/);
}

{
  const label = matchExperienceSecondaryLabel({
    mode: 'penalties',
    round: 4,
    suddenDeath: false,
  });
  assert.equal(label, '4. párbaj · Büntetőpárbaj');
  assert.equal(matchExperienceSecondaryLabel({
    mode: 'penalties',
    round: 8,
    suddenDeath: true,
  }), '8. párbaj · Hirtelen halál');
}

{
  const game = {
    log: [
      { winner: HUMAN, attribute: 'heightCm' },
      { winner: 'ai', attribute: 'goals' },
      { winner: HUMAN, attribute: 'heightCm' },
      { winner: HUMAN, attribute: 'appearances' },
      { winner: HUMAN, attribute: 'heightCm' },
    ],
  };
  const best = matchExperienceBestCategory(game);
  assert.equal(best?.key, 'heightCm');
  assert.equal(best?.wins, 3);
  assert.equal(best?.label, 'Magasabb játékos');
}

{
  assert.equal(matchExperienceBestCategory({ log: [] }), null);
  assert.equal(matchExperienceBestCategory({ log: [{ winner: 'ai', attribute: 'heightCm' }] }), null);
}

{
  assert.deepEqual(
    [opponentPersona({ level: 1 }).label, opponentPersona({ level: 5 }).label, opponentPersona({ level: 9 }).label],
    ['Kicsit spicces', 'Törzsvendég', 'Kocsmai cápa'],
  );
}

const source = fs.readFileSync('js/match-experience-polish.js', 'utf8');
assert.match(source, /match-arena-refresh/, 'A meccsnézet kapjon külön arena állapotot.');
assert.match(source, /match-arena-tabletop/, 'A párbajtér asztalfelületként legyen jelölve.');
assert.match(source, /repeating-linear-gradient\(92deg,#3d2215/, 'A játéktér fa asztalperemet használjon.');
assert.match(source, /linear-gradient\(145deg,#174932/, 'A játéktér zöld filc/felt felületet használjon.');
assert.match(source, /--stadium-led-amber:#ffd15a/, 'A stadioneredményjelzőnek legyen amber LED színrendszere.');
assert.match(source, /scoreboardStyle = 'classic-stadium'/, 'A HUD explicit klasszikus stadion-scoreboard állapotot kapjon.');
assert.match(source, /final-score\[data-sports-scoreboard='true'\]/, 'A végeredmény tábla is a stadion vizuális nyelvet használja.');
assert.match(source, /match-experience-result__score/, 'A saját végeredmény blokk külön LED score mezőt tartson fenn.');
assert.match(source, /context\?\.humanTeam/, 'Torna meccsnél a valódi saját csapatnév legyen használható fallbackként.');
assert.match(source, /context\?\.opponentTeam/, 'Torna meccsnél a valódi ellenfélnév legyen használható fallbackként.');
assert.match(source, /prefers-reduced-motion:reduce/);
assert.match(source, /forced-colors:active/);
assert.doesNotMatch(source, /https?:\/\//, 'A Match Arena nem hozhat be távoli vizuális assetet.');

const tournamentEntry = fs.readFileSync('js/tournament-experience-v2.js', 'utf8');
const tournamentUi = fs.readFileSync('js/tournament/tournament-ui-improvement.js', 'utf8');
const standalone = fs.readFileSync('scripts/postprocess-standalone.mjs', 'utf8');
assert.match(tournamentEntry, /installTournamentUiImprovement\(\)/,
  'A Tournament Experience 2.0 vizuális rétegének ténylegesen települnie kell.');
assert.match(tournamentUi, /TOURNAMENT_UI_IMPROVEMENT_VERSION = 2/,
  'A Match Arena ág a Tournament Experience 2.0 javított UI-jára épüljön.');
assert.match(standalone, /tournament\/tournament-ui-improvement\.js/,
  'A Torna 2.0 réteg a standalone/Android buildbe is kerüljön be.');

console.log('✓ Match Arena Visual Refresh: asztalszerű párbajtér, klasszikus stadion-scoreboard, látványos eredménytáblák és Tournament 2.0 integrációs szerződés rendben.');
