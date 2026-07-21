import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const replaceOnce = (path, search, replacement) => {
  const content = read(path);
  if (!content.includes(search)) throw new Error(`${path}: nem található a várt minta: ${search}`);
  write(path, content.replace(search, replacement));
};
const addUnique = (array, value) => {
  if (!array.includes(value)) array.push(value);
};

const file = 'data/club-official-enrichment-23-final-missing-basic.json';

replaceOnce(
  'js/bootstrap.js',
  "  'data/club-official-enrichment-22-kisvarda-nationalities.json',\n",
  "  'data/club-official-enrichment-22-kisvarda-nationalities.json',\n  'data/club-official-enrichment-23-final-missing-basic.json',\n",
);
replaceOnce(
  'scripts/build-standalone.mjs',
  "  'data/club-official-enrichment-22-kisvarda-nationalities.json',\n",
  "  'data/club-official-enrichment-22-kisvarda-nationalities.json',\n  'data/club-official-enrichment-23-final-missing-basic.json',\n",
);
replaceOnce(
  'sw.js',
  "// Előző cache-verzió: fociskartyak-2026-v28\nconst PWA_CACHE = 'fociskartyak-2026-v29';",
  "// Előző cache-verzió: fociskartyak-2026-v29\nconst PWA_CACHE = 'fociskartyak-2026-v30';",
);
replaceOnce(
  'sw.js',
  "  './data/club-official-enrichment-22-kisvarda-nationalities.json',\n",
  "  './data/club-official-enrichment-22-kisvarda-nationalities.json',\n  './data/club-official-enrichment-23-final-missing-basic.json',\n",
);

const packageJson = JSON.parse(read('package.json'));
packageJson.scripts['test:final-missing'] = 'node test/final-missing-complete.test.mjs';
for (const key of ['test', 'test:all']) {
  const command = packageJson.scripts[key];
  if (!command.includes('test/final-missing-complete.test.mjs')) {
    packageJson.scripts[key] = `node test/final-missing-complete.test.mjs && ${command}`;
  }
}
write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

replaceOnce(
  'test/static.test.mjs',
  "const kisvardaNationalities = readJson('../data/club-official-enrichment-22-kisvarda-nationalities.json');\n",
  "const kisvardaNationalities = readJson('../data/club-official-enrichment-22-kisvarda-nationalities.json');\nconst finalMissingBasic = readJson('../data/club-official-enrichment-23-final-missing-basic.json');\n",
);
replaceOnce(
  'test/static.test.mjs',
  "  'club-official-enrichment-22-kisvarda-nationalities.json',\n",
  "  'club-official-enrichment-22-kisvarda-nationalities.json',\n  'club-official-enrichment-23-final-missing-basic.json',\n",
);
replaceOnce(
  'test/static.test.mjs',
  'assert.match(clubStatPatches, /correctedFieldCounts/);\n',
  'assert.match(clubStatPatches, /correctedFieldCounts/);\nassert.match(clubStatPatches, /officialStatConsensus/);\nassert.match(clubStatPatches, /consensusPromotedPlayers/);\n',
);
replaceOnce(
  'test/static.test.mjs',
  'assert.match(serviceWorker, /fociskartyak-2026-v29/);',
  'assert.match(serviceWorker, /fociskartyak-2026-v30/);',
);
replaceOnce(
  'test/static.test.mjs',
  'assert.equal(kisvardaNationalities.records.length, 21);\n',
  'assert.equal(kisvardaNationalities.records.length, 21);\nassert.equal(finalMissingBasic.batch.playerCount, 7);\nassert.equal(finalMissingBasic.records.length, 7);\n',
);

const directory = JSON.parse(read('data/club-official-sources.json'));
const dvsc = directory.clubs.find(club => club.clubId === 'dvsc');
const nyiregyhaza = directory.clubs.find(club => club.clubId === 'nyiregyhaza-spartacus-fc');
if (!dvsc || !nyiregyhaza) throw new Error('A DVSC vagy a Nyíregyháza hiányzik a klubforrás-jegyzékből.');
addUnique(dvsc.recordFiles, file);
dvsc.status = 'complete-38-of-38-player-review';
dvsc.note = `${dvsc.note ?? ''} Asztalos Noel magyar középpályás és Kohut Máté magyar támadó hivatalos DVSC-akadémiai, klub- és HLSZ-forrásból lezárva.`.trim();
addUnique(nyiregyhaza.recordFiles, file);
nyiregyhaza.status = 'complete-39-of-39-player-review';
nyiregyhaza.note = `${nyiregyhaza.note ?? ''} Beke Péter támadó, Dantaye Gilbert középpályás, Ranko Jokić védő, Vane Jovanov védő és Varga Kevin középpályás posztja hivatalos klub-, HLSZ- és ellenőrzött bejelentési forrásból lezárva.`.trim();
write('data/club-official-sources.json', `${JSON.stringify(directory, null, 2)}\n`);

replaceOnce(
  'js/data/club-stat-patches.js',
  '  const records = parts.flatMap(expandRows);\n  if (!records.length) return payload;\n',
  '  const records = parts.flatMap(expandRows);\n',
);
replaceOnce(
  'js/data/club-stat-patches.js',
  '  const correctedFieldCounts = {};\n  let matchedRecords = 0;\n',
  '  const correctedFieldCounts = {};\n  const consensusAppliedFieldCounts = {};\n  const consensusPromotions = [];\n  const consensusConflicts = [];\n  let matchedRecords = 0;\n',
);
const consensusBlock = `
  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    const registeredClubs = cardClubIds(card);
    if (registeredClubs.length <= 1) continue;

    const officialByClub = card?.meta?.clubOfficialStatsByClub ?? {};
    const clubRows = registeredClubs.map(clubId => officialByClub[clubId]);
    if (clubRows.some(row => !isObject(row))) continue;

    const stats = { ...card.stats };
    const appliedFields = [];
    const differingFields = [];
    for (const field of STAT_FIELDS) {
      if (finite(stats[field])) continue;
      const values = clubRows.map(row => row[field]);
      if (!values.every(finite)) continue;
      if (!values.every(value => value === values[0])) {
        differingFields.push({
          field,
          values: Object.fromEntries(registeredClubs.map((clubId, rowIndex) => [clubId, values[rowIndex]])),
        });
        continue;
      }
      stats[field] = values[0];
      appliedFields.push(field);
      consensusAppliedFieldCounts[field] = (consensusAppliedFieldCounts[field] ?? 0) + 1;
    }

    if (differingFields.length) {
      consensusConflicts.push({
        playerId: card.id,
        playerName: card.name,
        clubIds: registeredClubs,
        fields: differingFields,
      });
    }
    if (!appliedFields.length) continue;

    const values = Object.fromEntries(appliedFields.map(field => [field, stats[field]]));
    const sourceIds = [...new Set(clubRows.map(row => row.sourceId).filter(Boolean))];
    const meta = {
      ...card.meta,
      dataStatus: card.meta?.dataStatus === 'verified' ? 'verified' : 'partially_verified',
      officialStatConsensus: {
        season: parts.at(-1)?.season ?? null,
        clubIds: registeredClubs,
        sourceIds,
        fieldsApplied: appliedFields,
        values,
        rule: 'all-registered-clubs-report-identical-player-season-totals',
      },
    };
    cards[index] = { ...card, stats, meta };
    consensusPromotions.push({
      playerId: card.id,
      playerName: card.name,
      clubIds: registeredClubs,
      sourceIds,
      fieldsApplied: appliedFields,
      values,
    });
  }

`;
replaceOnce(
  'js/data/club-stat-patches.js',
  '  const after = patchCoverage(cards);\n',
  `${consensusBlock}  const after = patchCoverage(cards);\n`,
);
replaceOnce(
  'js/data/club-stat-patches.js',
  '    correctedFieldCounts,\n    fieldCoverage,\n',
  '    correctedFieldCounts,\n    consensusPromotedPlayers: consensusPromotions.length,\n    consensusConflictCount: consensusConflicts.length,\n    consensusAppliedFieldCounts,\n    consensusPromotions,\n    consensusConflicts,\n    fieldCoverage,\n',
);

for (const path of [
  'scripts/discover-final-missing-data.mjs',
  '.github/workflows/discover-final-missing-data.yml',
  'scripts/finalize-final-missing-data.mjs',
  '.github/workflows/finalize-final-missing-data.yml',
]) {
  if (fs.existsSync(path)) fs.rmSync(path);
}

console.log('A végső alapadat- és statisztikai konszenzusintegráció elkészült.');
