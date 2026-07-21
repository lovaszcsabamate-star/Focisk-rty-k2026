import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');
const replaceOnce = (path, oldValue, newValue) => {
  const source = read(path);
  if (!source.includes(oldValue)) throw new Error(`Nem található cserecél: ${path}: ${oldValue.slice(0, 100)}`);
  write(path, source.replace(oldValue, newValue));
};

const ETO_FILE = 'data/club-official-enrichment-21-eto-completion.json';

for (const path of ['js/bootstrap.js', 'scripts/build-standalone.mjs']) {
  replaceOnce(
    path,
    "  'data/club-official-enrichment-20-puskas-completion.json',\n];",
    "  'data/club-official-enrichment-20-puskas-completion.json',\n  'data/club-official-enrichment-21-eto-completion.json',\n];",
  );
}

replaceOnce(
  'sw.js',
  "// Előző cache-verzió: fociskartyak-2026-v26\nconst PWA_CACHE = 'fociskartyak-2026-v27';",
  "// Előző cache-verzió: fociskartyak-2026-v27\nconst PWA_CACHE = 'fociskartyak-2026-v28';",
);
replaceOnce(
  'sw.js',
  "  './data/club-official-enrichment-20-puskas-completion.json',\n",
  "  './data/club-official-enrichment-20-puskas-completion.json',\n  './data/club-official-enrichment-21-eto-completion.json',\n",
);

const directoryPath = 'data/club-official-sources.json';
const directory = JSON.parse(read(directoryPath));
const eto = directory.clubs.find(club => club.clubId === 'eto-fc');
if (!eto) throw new Error('Az ETO FC nem található a klubforrás-jegyzékben.');
eto.status = 'complete-35-of-35-player-review';
eto.recordFiles ??= [];
if (!eto.recordFiles.includes(ETO_FILE)) eto.recordFiles.push(ETO_FILE);
eto.note = 'Az ETO FC mind a 35 projektbeli 2025/26-os szezonrekordja játékosonkénti MLSZ-, HLSZ- és hivatalos klubforrásos ellenőrzést kapott. Valamennyi pontos születési dátum, nemzetiség és poszt rögzített. Kulcsár Martin védő, Mascoe Lawrenzo támadó, Ouro Samsindin és Sahli Ouijdi középpályás, Szarka Bulcsú középpályás, Szép Márton támadó. Mascoe Lawrenzo kanadai nemzetiségét a HLSZ jelenlegi profilja támasztja alá. A már teljes 35/35 MLSZ-szezonstatisztika változatlan maradt.';
write(directoryPath, `${JSON.stringify(directory, null, 2)}\n`);

const packagePath = 'package.json';
const pkg = JSON.parse(read(packagePath));
const scripts = {};
for (const [key, original] of Object.entries(pkg.scripts)) {
  let value = original;
  if (key === 'test') {
    scripts['test:eto'] = 'node test/eto-complete.test.mjs';
    if (!value.startsWith('node test/eto-complete.test.mjs && ')) {
      value = `node test/eto-complete.test.mjs && ${value}`;
    }
  }
  if (key === 'test:all' && !value.includes('node test/eto-complete.test.mjs')) {
    value = value.replace(
      'node pipeline/test/transform.test.mjs && ',
      'node pipeline/test/transform.test.mjs && node test/eto-complete.test.mjs && ',
    );
  }
  scripts[key] = value;
}
pkg.scripts = scripts;
write(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

const staticPath = 'test/static.test.mjs';
let staticSource = read(staticPath);
const staticReplacements = [
  [
    "const zteCompletion = readJson('../data/club-official-enrichment-19-zte-completion.json');\n",
    "const zteCompletion = readJson('../data/club-official-enrichment-19-zte-completion.json');\nconst etoCompletion = readJson('../data/club-official-enrichment-21-eto-completion.json');\n",
  ],
  [
    "  'club-official-enrichment-19-zte-completion.json',\n",
    "  'club-official-enrichment-19-zte-completion.json',\n  'club-official-enrichment-21-eto-completion.json',\n",
  ],
  [
    'assert.match(serviceWorker, /fociskartyak-2026-v26/);',
    'assert.match(serviceWorker, /fociskartyak-2026-v28/);',
  ],
  [
    'assert.equal(zteCompletion.records.length, 43);\n',
    'assert.equal(zteCompletion.records.length, 43);\nassert.equal(etoCompletion.batch.playerCount, 35);\nassert.equal(etoCompletion.records.length, 35);\n',
  ],
  [
    "assert.equal(\n  directory.clubs.find(club => club.clubId === 'zte-fc').status,",
    "assert.equal(\n  directory.clubs.find(club => club.clubId === 'eto-fc').status,\n  'complete-35-of-35-player-review',\n);\nassert.equal(\n  directory.clubs.find(club => club.clubId === 'zte-fc').status,",
  ],
];
for (const [oldValue, newValue] of staticReplacements) {
  if (!staticSource.includes(oldValue)) throw new Error(`Hiányzó static teszt cserecél: ${oldValue.slice(0, 100)}`);
  staticSource = staticSource.replace(oldValue, newValue);
}
write(staticPath, staticSource);

const finalWorkflow = `name: Ellenőrzés és önálló build

on:
  push:
    branches:
      - main
      - ux/felhasznalobarat-jatekmenet
    paths-ignore:
      - Fociskartyak2026.html
      - data/enrichment-audit.json
      - data/players-reviewed.json
      - data/database-review.json
      - data/database-review.md
      - data/database-changelog.json
      - data/missing-player-data-reviewed.json
  pull_request:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: write

jobs:
  verify-and-build:
    runs-on: ubuntu-latest
    steps:
      - name: Forráskód letöltése
        uses: actions/checkout@v4
        with:
          ref: \${{ github.head_ref || github.ref_name }}

      - name: Node.js beállítása
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Szintaktikai ellenőrzés
        run: npm run lint

      - name: Önálló HTML és teljes adatfelülvizsgálat elkészítése
        run: npm run build

      - name: Adatbázis-felülvizsgálati parancs
        run: npm run review:database

      - name: Valódi Chrome mobilnézeti ellenőrzés
        id: mobile_layout
        continue-on-error: true
        run: npm run test:mobile-layout

      - name: Mobilnézeti riport mentése
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: mobile-layout-report
          path: mobile-layout-report.json
          if-no-files-found: warn
          retention-days: 14

      - name: Alkalmazástesztek
        run: npm test

      - name: Teljes tesztcsomag
        run: npm run test:all

      - name: Formázási hibák ellenőrzése
        run: git diff --check

      - name: Mobilnézeti eredmény érvényesítése
        if: steps.mobile_layout.outcome == 'failure'
        run: exit 1

      - name: Generált játékfájl és adatfelülvizsgálat mentése
        if: github.event_name == 'push'
        run: |
          GENERATED_FILES="Fociskartyak2026.html data/enrichment-audit.json data/players-reviewed.json data/database-review.json data/database-review.md data/database-changelog.json data/missing-player-data-reviewed.json"
          if git diff --quiet -- $GENERATED_FILES; then
            echo "Az önálló játékfájl és az adatfelülvizsgálati csomag naprakész."
            exit 0
          fi
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add $GENERATED_FILES
          git commit -m "Önálló játékfájl és teljes adatfelülvizsgálat frissítése [skip ci]"
          git push
`;
write('.github/workflows/verify-and-build.yml', finalWorkflow);

for (const obsolete of [
  '.github/workflows/apply-eto-wiring.yml',
  'test/eto-discovery.test.mjs',
  'scripts/apply-eto-wiring.mjs',
]) {
  if (fs.existsSync(obsolete)) fs.unlinkSync(obsolete);
}

console.log('✓ ETO FC végleges buildintegrációja alkalmazva');
