import assert from 'node:assert/strict';
import fs from 'node:fs';

import { enrichmentNamesMatch } from '../js/data/club-enrichment.js';
import { applyOfficialStatPatches } from '../js/data/club-stat-patches.js';

const CLUB_ID = 'ferencvarosi-tc';
const PATCH_FILE = 'club-official-stat-patches-ferencvaros.json';
const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const readText = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

const reviewed = readJson('../data/players-reviewed.json');
const patch = readJson(`../data/${PATCH_FILE}`);
const patched = applyOfficialStatPatches(reviewed, patch);

assert.equal(patch.batch.playerCount, 42);
assert.equal(patch.rows.length, 42);
assert.equal(new Set(patch.rows.map(row => row[0])).size, 42);
assert.equal(patched.officialStatPatches.records, 42);
assert.equal(patched.officialStatPatches.matchedRecords, 42);
assert.equal(patched.officialStatPatches.unmatchedRecords, 0);
assert.equal(patched.officialStatPatches.manualReview.length, 0);
assert.equal(patched.source.officialClubStatPatches.at(-1).clubId, CLUB_ID);

for (const row of patch.rows) {
  const [name, appearances, starts, substitutes, squads, goals, yellow, red, dismissals] = row;
  for (const [field, value] of Object.entries({ appearances, starts, substitutes, squads, goals, yellow, red, dismissals })) {
    assert.equal(Number.isFinite(value), true, `${name}: hibás ${field}`);
    assert.ok(value >= 0, `${name}: negatív ${field}`);
  }
  assert.equal(starts + substitutes, appearances, `${name}: hibás kezdés/csere bontás`);
  assert.ok(squads >= appearances, `${name}: a kerettagság kisebb a pályára lépésnél`);
  assert.equal(dismissals, red, `${name}: a teljes kiállításszám nem egyezik az MLSZ Piros oszlopával`);

  const aliases = patch.aliases?.[name] ?? [];
  const candidates = patched.players.filter(player =>
    player?.meta?.clubIds?.includes(CLUB_ID)
    && enrichmentNamesMatch(player.name, { name, aliases })
  );
  assert.equal(candidates.length, 1, `${name}: nem egyértelmű adatbázis-egyezés`);
  const clubStats = candidates[0].meta?.clubOfficialStatsByClub?.[CLUB_ID];
  assert.ok(clubStats, `${name}: hiányzik a klubforrásos statisztikai metaadat`);
  assert.equal(clubStats.appearances, appearances, `${name}: hibás pályára lépés az alkalmazott patchben`);
  assert.equal(clubStats.squads, squads, `${name}: hibás kerettagság az alkalmazott patchben`);
}

const expected = new Map(patch.rows.map(row => [row[0], row]));
assert.deepEqual(expected.get('Varga Barnabás').slice(1, 6), [17, 14, 3, 17, 10]);
assert.deepEqual(expected.get('Gruber Zsombor').slice(1, 6), [29, 17, 12, 33, 9]);
assert.deepEqual(expected.get('Dibusz Dénes').slice(1, 6), [20, 20, 0, 22, 0]);
assert.deepEqual(expected.get('Szécsi Gergő').slice(1, 6), [0, 0, 0, 3, 0]);
assert.equal(expected.get('Gróf Dávid Attila')[7], 1);
assert.equal(expected.get('Corbu Marius Dumitru')[7], 1);

for (const source of ['../js/bootstrap.js', '../scripts/build-standalone.mjs', '../sw.js']) {
  assert.match(readText(source), new RegExp(PATCH_FILE.replaceAll('.', '\\.')));
}

assert.match(patch.source.scope, /nem közölnek játékpercet és gólpasszt/);
assert.equal(patch.fields.includes('minutes'), false);
assert.equal(patch.fields.includes('assists'), false);
assert.equal(patch.fields.includes('secondYellowRedCards'), false);

console.log('✓ Ferencváros lezárva: 42/42 MLSZ Fizz Liga-profil illesztve, pályára lépés és kerettagság külön kezelve');
