import assert from 'node:assert/strict';

import {
  canonicalNationalityKey,
  countryCodeToFlagAsset,
  countryCodeToFlagEmoji,
  nationalityPresentation,
  normaliseCountryCode,
  resolveNationality,
  resolvePlayerNationality,
  validateNationalityAssignments,
} from '../js/data/nationalities.js';
import { normalisePlayerRecord } from '../js/models/player-model.js';
import { buildNormalizedDatabase } from '../scripts/migrate-normalized-database.mjs';

assert.equal(normaliseCountryCode('Haiti'), 'HT');
assert.equal(normaliseCountryCode('Haitian'), 'HT');
assert.equal(normaliseCountryCode('HAI'), 'HT');
assert.equal(normaliseCountryCode('HTI'), 'HT');
assert.equal(normaliseCountryCode('Republic of Ireland'), 'IE');
assert.equal(normaliseCountryCode('Irish'), 'IE');
assert.equal(normaliseCountryCode("Côte d’Ivoire"), 'CI');
assert.equal(normaliseCountryCode('Ivory Coast'), 'CI');
assert.equal(normaliseCountryCode('Democratic Republic of the Congo'), 'CD');
assert.equal(normaliseCountryCode('Korea Republic'), 'KR');
assert.equal(normaliseCountryCode('Macedonia'), 'MK');

assert.equal(normaliseCountryCode('ENG'), 'GB-ENG');
assert.equal(normaliseCountryCode('SCO'), 'GB-SCT');
assert.equal(normaliseCountryCode('WAL'), 'GB-WLS');
assert.equal(normaliseCountryCode('NIR'), 'GB-NIR');
assert.equal(normaliseCountryCode('IRL'), 'IE');
assert.notEqual(normaliseCountryCode('IRL'), 'GB');
assert.equal(canonicalNationalityKey('Northern Ireland'), 'northern-ireland');
assert.equal(canonicalNationalityKey('Ireland'), 'ireland');

for (const code of ['GB-ENG', 'GB-SCT', 'GB-WLS', 'GB-NIR']) {
  assert.ok(countryCodeToFlagAsset[code], `${code}: hiányzó helyi zászlóasset`);
  assert.notEqual(countryCodeToFlagEmoji(code), '🇬🇧', `${code}: nem egyszerűsíthető brit zászlóra`);
}
assert.equal(countryCodeToFlagEmoji('IE'), '🇮🇪');
assert.equal(countryCodeToFlagEmoji('HT'), '🇭🇹');

const lenny = normalisePlayerRecord({
  id: 'lenny-joseph', name: 'Lenny Joseph', club: 'Ferencvárosi TC', nation: 'FRA',
});
assert.equal(lenny.nationality, 'Haiti');
assert.equal(lenny.countryCode, 'HT');
assert.equal(lenny.nationalTeam, 'Haiti');

const odowda = normalisePlayerRecord({
  id: 'callum-odowda', name: 'Callum O’Dowda', club: 'Ferencvárosi TC', nation: 'ENG',
});
assert.equal(odowda.nationality, 'Ireland');
assert.equal(odowda.countryCode, 'IE');
assert.equal(odowda.nationalTeam, 'Ireland');

const dualInternational = resolvePlayerNationality({
  name: 'Minta játékos',
  nationality: 'England / Ireland',
  nationalTeam: 'Republic of Ireland',
});
assert.equal(dualInternational.countryCode, 'IE');
assert.equal(dualInternational.nationality, 'Ireland');

const unknown = resolveNationality('Nem létező ország');
assert.equal(unknown.known, false);
assert.equal(nationalityPresentation('Nem létező ország').flag, '🌐');

const { output } = buildNormalizedDatabase();
assert.equal(output.players.length, 440);
const actualLenny = output.players.find(player => player.name.toLocaleUpperCase('hu-HU').includes('LENNY JOSEPH'));
const actualODowda = output.players.find(player => player.name.toLocaleUpperCase('hu-HU').includes("CALLUM O'DOWDA")
  || player.name.toLocaleUpperCase('hu-HU').includes('CALLUM O’DOWDA'));
if (actualLenny) assert.equal(actualLenny.countryCode, 'HT');
if (actualODowda) assert.equal(actualODowda.countryCode, 'IE');

const audit = validateNationalityAssignments(output.players);
assert.equal(audit.summary.playerCount, 440);
assert.equal(audit.britishMisassignments.length, 0);
assert.equal(audit.contradictions.length, 0);
assert.equal(audit.missingNationality.length, 0);
assert.equal(audit.missingCountryCode.length, 0);
assert.equal(audit.unknownCountryCode.length, 0);

console.log('✓ Nemzetiségi audit: 440 játékos, ISO countryCode, Haiti/Írország és külön brit tagországi zászlók');
