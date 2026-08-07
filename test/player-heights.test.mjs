import assert from 'node:assert/strict';

import { AI, Game, HUMAN, compare } from '../js/engine.js';
import { PenaltyGame } from '../js/penalties.js';
import { isValidHeightCm } from '../js/data/height.js';
import {
  ATTRIBUTE_BY_KEY,
  CARD_ATTRIBUTE_KEYS,
  configureAttributes,
  formatAttribute,
  hasAttributeData,
  normaliseCard,
} from '../js/data/players.js';
import { buildNormalizedDatabase } from '../scripts/migrate-normalized-database.mjs';
import {
  BASELINE_HEIGHT_COUNT,
  EXPECTED_PLAYER_COUNT,
  EXPECTED_REGISTRATION_COUNT,
  createHeightCoverageAudit,
} from '../scripts/audit-player-heights.mjs';

const heightCard = (id, heightCm, extra = {}) => normaliseCard({
  id,
  name: `Teszt ${id}`,
  club: 'Teszt FC',
  stats: { heightCm },
  ...extra,
});
const quickSideCard = (side, index, heightCm) => heightCard(`${side}-${index}`, heightCm, {
  meta: { quickMatchSide: side, quickMatchTeamLabel: `${side} tesztcsapat` },
});

// Kategóriaszerződés és megjelenítés.
assert.equal(ATTRIBUTE_BY_KEY.heightCm.label, 'Magasabb játékos');
assert.equal(ATTRIBUTE_BY_KEY.heightCm.icon, '📏');
assert.equal(ATTRIBUTE_BY_KEY.heightCm.direction, 'higher');
assert.equal(ATTRIBUTE_BY_KEY.heightCm.unit, 'cm');
assert.ok(CARD_ATTRIBUTE_KEYS.includes('heightCm'));
assert.equal(formatAttribute(heightCard('format', 187), 'heightCm'), '187 cm');

// A feladatban kért összehasonlítási esetek.
assert.equal(compare('heightCm', heightCard('human-190', 190), heightCard('ai-185', 185)), 'human');
assert.equal(compare('heightCm', heightCard('human-178', 178), heightCard('ai-193', 193)), 'ai');
assert.equal(compare('heightCm', heightCard('human-184', 184), heightCard('ai-184', 184)), 'tie');

const missingHuman = heightCard('missing-human', null);
const validAi = heightCard('valid-ai', 190);
assert.equal(hasAttributeData(missingHuman, 'heightCm'), false);
assert.equal(hasAttributeData(validAi, 'heightCm'), true);
assert.throws(() => compare('heightCm', missingHuman, validAi), /mindkét kártyán hiteles adat/);

const validHuman = heightCard('valid-human', 190);
const missingAi = heightCard('missing-ai', null);
assert.equal(hasAttributeData(validHuman, 'heightCm'), true);
assert.equal(hasAttributeData(missingAi, 'heightCm'), false);
assert.throws(() => compare('heightCm', validHuman, missingAi), /mindkét kártyán hiteles adat/);

assert.equal(hasAttributeData(heightCard('missing-both-a', null), 'heightCm'), false);
assert.equal(hasAttributeData(heightCard('missing-both-b', null), 'heightCm'), false);

for (const invalid of [0, 235, 'magas']) {
  const card = heightCard(`invalid-${String(invalid)}`, invalid);
  assert.equal(card.stats.heightCm, null, `invalid height normalizálása: ${invalid}`);
  assert.equal(hasAttributeData(card, 'heightCm'), false, `invalid height nem játszható: ${invalid}`);
  assert.equal(formatAttribute(card, 'heightCm'), '', `invalid height nem jelenik meg: ${invalid}`);
}

// Klasszikus / Quick Match: csak akkor választható, ha mindkét oldalon van kijátszható hiteles heightCm.
const classicPlayers = [
  ...Array.from({ length: 5 }, (_, index) => quickSideCard(HUMAN, index, index === 0 ? 190 : null)),
  ...Array.from({ length: 5 }, (_, index) => quickSideCard(AI, index, 180 + index)),
];
configureAttributes(classicPlayers, { minimumCoverage: 0 });
const classic = new Game({ players: classicPlayers, rng: () => 0 });
assert.equal(classic.quickMatch?.enabled, true);
assert.ok(classic.availableAttributeKeys().includes('heightCm'));

const classicMissingPlayers = [
  ...Array.from({ length: 5 }, (_, index) => quickSideCard(HUMAN, index + 20, null)),
  ...Array.from({ length: 5 }, (_, index) => quickSideCard(AI, index + 20, 180 + index)),
];
configureAttributes(classicMissingPlayers, { minimumCoverage: 0 });
const classicMissingSide = new Game({ players: classicMissingPlayers, rng: () => 0 });
assert.equal(classicMissingSide.availableAttributeKeys().includes('heightCm'), false);

// Büntetőpárbaj: ugyanaz a központi missing-data filtering működik a 11 fős keretekkel.
const penaltyPlayers = [
  ...Array.from({ length: 11 }, (_, index) => quickSideCard(HUMAN, index + 40, index === 0 ? 191 : null)),
  ...Array.from({ length: 11 }, (_, index) => quickSideCard(AI, index + 40, 179 + (index % 5))),
];
configureAttributes(penaltyPlayers, { minimumCoverage: 0 });
const penalty = new PenaltyGame({ players: penaltyPlayers, rng: () => 0 });
assert.ok(penalty.availableAttributeKeys().includes('heightCm'));

const penaltyMissingPlayers = [
  ...Array.from({ length: 11 }, (_, index) => quickSideCard(HUMAN, index + 80, null)),
  ...Array.from({ length: 11 }, (_, index) => quickSideCard(AI, index + 80, 180)),
];
configureAttributes(penaltyMissingPlayers, { minimumCoverage: 0 });
const penaltyMissingSide = new PenaltyGame({ players: penaltyMissingPlayers, rng: () => 0 });
assert.equal(penaltyMissingSide.availableAttributeKeys().includes('heightCm'), false);

// Adatbázis-audit: 440 személy, 464 klubregisztráció, 0 invalid és nem romló coverage.
const { output } = buildNormalizedDatabase();
const audit = createHeightCoverageAudit(output.players);

assert.equal(audit.summary.players, EXPECTED_PLAYER_COUNT, 'a teljes 440 fős játékosállomány megmarad');
assert.equal(audit.summary.registrationRecords, EXPECTED_REGISTRATION_COUNT, 'mind a 464 szezonbeli klubregisztráció megmarad');
assert.equal(audit.summary.invalid, 0, 'nem lehet 140–220 cm-en kívüli vagy nem egész magasság');
assert.ok(audit.summary.known >= BASELINE_HEIGHT_COUNT, 'a height coverage nem romolhat 285 alá');
assert.equal(audit.summary.known + audit.summary.missing, EXPECTED_PLAYER_COUNT, 'minden játékos ismert vagy hiányzó magasságú');
assert.equal(audit.clubs.length, 12, 'mind a 12 NB I-es klub megmarad');
assert.equal(audit.clubs.reduce((sum, club) => sum + club.players, 0), EXPECTED_REGISTRATION_COUNT);
assert.equal(isValidHeightCm(140), true);
assert.equal(isValidHeightCm(220), true);
assert.equal(isValidHeightCm(139), false);
assert.equal(isValidHeightCm(221), false);
assert.equal(isValidHeightCm(184.5), false);

console.log(`✓ Height 1.0: Classic/Quick Match + Penalties + missing/invalid safety + coverage ${audit.summary.known}/${audit.summary.players} (${audit.summary.coveragePercent}%), regisztráció=${audit.summary.registrationRecords}, hiányzó=${audit.summary.missing}, invalid=${audit.summary.invalid}`);
