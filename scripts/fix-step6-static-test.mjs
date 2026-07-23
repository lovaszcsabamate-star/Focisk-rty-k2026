import fs from 'node:fs';

const file = new URL('../test/static.test.mjs', import.meta.url);
let source = fs.readFileSync(file, 'utf8');

const replacements = [
  [
    "assert.doesNotMatch(main, /new (Game|PenaltyGame)(/);",
    "assert.doesNotMatch(main, /new (Game|PenaltyGame)\\(/);",
  ],
  [
    "assert.doesNotMatch(main, /this.game.(chooseAttribute|playCard|nextRound|nextDuel|result)(/);",
    "assert.doesNotMatch(main, /this\\.game\\.(chooseAttribute|playCard|nextRound|nextDuel|result)\\(/);",
  ],
  [
    "assert.doesNotMatch(gameRuntime, /\\bdocument\\b|\\bwindow\\b|querySelector|innerHTML|from ['\"]..\\/ui.js/);",
    "assert.doesNotMatch(gameRuntime, /\\bdocument\\b|\\bwindow\\b|querySelector|innerHTML|from ['\"]\\.\\.\\/ui\\.js/);",
  ],
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) throw new Error(`A javítandó statikus tesztrészlet nem található: ${before}`);
  source = source.replace(before, after);
}

fs.writeFileSync(file, source);
console.log('✓ A Step 6 statikus szerződésteszt reguláris kifejezései javítva.');
