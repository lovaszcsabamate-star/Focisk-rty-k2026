import assert from 'node:assert/strict';

import { isValidHeightCm } from '../js/data/height.js';
import { buildNormalizedDatabase } from '../scripts/migrate-normalized-database.mjs';
import {
  BASELINE_HEIGHT_COUNT,
  EXPECTED_PLAYER_COUNT,
  EXPECTED_REGISTRATION_COUNT,
  createHeightCoverageAudit,
} from '../scripts/audit-player-heights.mjs';

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

console.log(`✓ Height coverage audit: ${audit.summary.known}/${audit.summary.players} (${audit.summary.coveragePercent}%), regisztráció=${audit.summary.registrationRecords}, hiányzó=${audit.summary.missing}, invalid=${audit.summary.invalid}`);
