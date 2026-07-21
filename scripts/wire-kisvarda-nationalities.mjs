import fs from 'node:fs';

const FILE = 'data/club-official-enrichment-22-kisvarda-nationalities.json';

function replaceOnce(path, oldText, newText) {
  const text = fs.readFileSync(path, 'utf8');
  if (!text.includes(oldText)) throw new Error(`Nem található cserecél: ${path}: ${oldText}`);
  fs.writeFileSync(path, text.replace(oldText, newText));
}

for (const path of ['js/bootstrap.js', 'scripts/build-standalone.mjs']) {
  replaceOnce(
    path,
    "  'data/club-official-enrichment-21-eto-completion.json',\n];",
    "  'data/club-official-enrichment-21-eto-completion.json',\n  'data/club-official-enrichment-22-kisvarda-nationalities.json',\n];",
  );
}

replaceOnce(
  'sw.js',
  "// Előző cache-verzió: fociskartyak-2026-v27\nconst PWA_CACHE = 'fociskartyak-2026-v28';",
  "// Előző cache-verzió: fociskartyak-2026-v28\nconst PWA_CACHE = 'fociskartyak-2026-v29';",
);
replaceOnce(
  'sw.js',
  "  './data/club-official-enrichment-21-eto-completion.json',\n",
  "  './data/club-official-enrichment-21-eto-completion.json',\n  './data/club-official-enrichment-22-kisvarda-nationalities.json',\n",
);

replaceOnce(
  'test/static.test.mjs',
  "const etoCompletion = readJson('../data/club-official-enrichment-21-eto-completion.json');",
  "const etoCompletion = readJson('../data/club-official-enrichment-21-eto-completion.json');\nconst kisvardaNationalities = readJson('../data/club-official-enrichment-22-kisvarda-nationalities.json');",
);
replaceOnce(
  'test/static.test.mjs',
  "  'club-official-enrichment-21-eto-completion.json',\n",
  "  'club-official-enrichment-21-eto-completion.json',\n  'club-official-enrichment-22-kisvarda-nationalities.json',\n",
);
replaceOnce('test/static.test.mjs', '/fociskartyak-2026-v28/', '/fociskartyak-2026-v29/');
replaceOnce(
  'test/static.test.mjs',
  "assert.equal(etoCompletion.records.length, 35);",
  "assert.equal(etoCompletion.records.length, 35);\nassert.equal(kisvardaNationalities.batch.playerCount, 21);\nassert.equal(kisvardaNationalities.records.length, 21);",
);

const directoryPath = 'data/club-official-sources.json';
const directory = JSON.parse(fs.readFileSync(directoryPath, 'utf8'));
const club = directory.clubs.find(item => item.clubId === 'kisvarda-master-good');
if (!club) throw new Error('A Kisvárda nem található a forrásjegyzékben.');
club.status = 'complete-38-of-38-player-review';
club.recordFiles = [...new Set([...(club.recordFiles ?? []), FILE])];
club.note = 'A Kisvárda mind a 38 adatbázisrekordja játékosonkénti MLSZ-, HLSZ- és klubforrásos ellenőrzést kapott. Valamennyi pontos születési dátum, nemzetiség és poszt rögzített. A korábban hiányzó 21 országadat külön, kizárólag nemzetiséget tartalmazó rétegben került be; Abdullahi Kamal nigériai és Jazsik Román ukrán besorolását az MLSZ-azonosítással egyező ellenőrzött másodlagos forrás támasztja alá, mert a HLSZ mezője üres. A már meglévő Fizz Liga-statisztikák változatlanok maradtak.';
fs.writeFileSync(directoryPath, JSON.stringify(directory, null, 2) + '\n');

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts['test:kisvarda-nationalities'] = 'node test/kisvarda-nationalities-complete.test.mjs';
for (const key of ['test', 'test:all']) {
  const command = 'node test/kisvarda-nationalities-complete.test.mjs';
  if (!pkg.scripts[key].includes(command)) pkg.scripts[key] = `${command} && ${pkg.scripts[key]}`;
}
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

for (const path of [
  'scripts/discover-kisvarda-nationalities.mjs',
  '.github/workflows/kisvarda-nationality-discovery.yml',
  'scripts/wire-kisvarda-nationalities.mjs',
]) {
  if (fs.existsSync(path)) fs.rmSync(path);
}
