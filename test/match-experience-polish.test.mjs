import assert from 'node:assert/strict';

import { HUMAN } from '../js/engine.js';
import {
  matchExperienceBestCategory,
  matchExperienceSecondaryLabel,
} from '../js/match-experience-polish.js';
import { opponentPersona } from '../js/opponents.js';

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

console.log('✓ Match Experience Polish: HUD másodlagos sor, valós best-category és AI személyiség UI rendben.');
