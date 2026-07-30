import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readJson = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const readText = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const flatten = (value, prefix = '', output = new Map()) => {
  for (const [key, entry] of Object.entries(value ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) flatten(entry, path, output);
    else output.set(path, entry);
  }
  return output;
};

const [hu, en, service, bootstrap, index, styles] = await Promise.all([
  readJson('locales/hu.json'),
  readJson('locales/en.json'),
  readText('js/i18n.js'),
  readText('js/bootstrap.js'),
  readText('index.html'),
  readText('css/i18n.css'),
]);

const huKeys = flatten(hu);
const enKeys = flatten(en);
const missingEnglish = [...huKeys.keys()].filter(key => !enKeys.has(key));
const missingHungarian = [...enKeys.keys()].filter(key => !huKeys.has(key));

assert.deepEqual(missingEnglish, [], `Missing English keys: ${missingEnglish.join(', ')}`);
assert.deepEqual(missingHungarian, [], `Missing Hungarian keys: ${missingHungarian.join(', ')}`);

for (const [key, value] of huKeys) {
  assert.equal(typeof value, 'string', `Hungarian value must be a string: ${key}`);
  assert.ok(value.trim(), `Hungarian value must not be empty: ${key}`);
}
for (const [key, value] of enKeys) {
  assert.equal(typeof value, 'string', `English value must be a string: ${key}`);
  assert.ok(value.trim(), `English value must not be empty: ${key}`);
}

for (const [source, value] of Object.entries(hu.automatic)) {
  assert.equal(value, source, `Hungarian automatic entry must preserve its source text: ${source}`);
  assert.ok(Object.prototype.hasOwnProperty.call(en.automatic, source), `English automatic entry missing: ${source}`);
}

const requiredTranslations = {
  'modes.quickMatch': 'Quick Match',
  'modes.classic': 'Classic Mode',
  'modes.penalties': 'Penalty Shootout',
  'modes.aiOpponent': 'AI Opponent',
  'selection.selectTeam': 'Select Team',
  'selection.selectOpponent': 'Select Opponent',
  'selection.randomTeam': 'Random Team',
  'selection.nationalTeams': 'National Teams',
  'gameplay.suddenDeath': 'Sudden Death',
  'results.victory': 'Victory',
  'results.defeat': 'Defeat',
  'results.draw': 'Draw',
  'categories.youngerPlayer': 'Younger Player',
  'categories.tallerPlayer': 'Taller Player',
  'categories.goals': 'More Goals',
  'categories.assists': 'More Assists',
  'categories.yellowCards': 'More Yellow Cards',
  'categories.redCards': 'More Red Cards',
};
for (const [key, expected] of Object.entries(requiredTranslations)) {
  assert.equal(enKeys.get(key), expected, `Unexpected translation for ${key}`);
}

assert.match(service, /fociskartyak:language:v1/, 'Language preference must use a versioned storage key');
assert.match(service, /SUPPORTED_LANGUAGES[\s\S]*'hu'[\s\S]*'en'/, 'Hungarian and English must be supported');
assert.match(service, /MutationObserver/, 'Dynamic UI localization observer is required');
assert.match(service, /Intl\.NumberFormat/, 'Locale-aware number formatting is required');
assert.match(service, /Intl\.DateTimeFormat/, 'Locale-aware date formatting is required');
assert.match(bootstrap, /await initializeI18n\(\)/, 'Localization must initialize before the application');
assert.match(index, /css\/i18n\.css/, 'Localization layout stylesheet must be loaded');
assert.match(styles, /\.language-select/, 'Visible text-based language selector styling is required');
assert.match(styles, /html\[data-language="en"\]/, 'English overflow safeguards are required');

console.log(`i18n catalogue test passed: ${huKeys.size} keys, hu/en parity confirmed`);
