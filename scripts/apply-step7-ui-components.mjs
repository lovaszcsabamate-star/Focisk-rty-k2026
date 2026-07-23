import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const write = (path, content) => fs.writeFileSync(new URL(path, root), content);

const replaceSection = (source, startMarker, endMarker, replacement, label) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Nem található UI-refaktorálási szakasz: ${label}`);
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
};

let ui = read('js/ui.js');
const classMarker = 'export class UI {';
const classIndex = ui.indexOf(classMarker);
if (classIndex < 0) throw new Error('A UI osztály nem található.');
ui = `/** DOM rendering shared by Classic and Penalties modes. */\n\nimport { ATTRIBUTE_BY_KEY, formatAttribute, hasAttributeData } from './data/players.js';\nimport { HUMAN, AI } from './engine.js';\nimport { renderAttributePickerComponent } from './ui/attribute-picker-component.js';\nimport { createCardComponent } from './ui/card-component.js';\nimport { $, ART, el, finiteDetail, PUB_SCRIM, tryArt } from './ui/dom-primitives.js';\nimport { renderScoreboardComponent } from './ui/scoreboard-component.js';\n\nexport { $, ART, el };\n\n${ui.slice(classIndex)}`;

ui = replaceSection(
  ui,
  '  _cardRows(card, activeAttributeKey) {',
  '  openInspector(hand, index, opts = {}) {',
  `  renderCard(card, opts = {}) {\n    return createCardComponent(card, opts);\n  }\n\n`,
  'kártyakomponens',
);

ui = replaceSection(
  ui,
  '  renderScores(game) {',
  '  showAttributePicker(game) {',
  `  renderScores(game) {\n    renderScoreboardComponent(this.dom, game, this.mode);\n  }\n\n`,
  'eredményjelző-komponens',
);

ui = replaceSection(
  ui,
  '  showAttributePicker(game) {',
  '  hideAttributePicker() {',
  `  showAttributePicker(game) {\n    this.dom.duel.replaceChildren();\n    this.dom.verdict.replaceChildren();\n    this.dom.verdict.className = '';\n    this.setPrompt('Te választasz kategóriát');\n    renderAttributePickerComponent(\n      this.dom.picker,\n      game,\n      attributeKey => this.handlers.onAttribute(attributeKey),\n    );\n  }\n\n`,
  'kategóriaválasztó-komponens',
);

for (const forbidden of [
  'CARD_ATTRIBUTE_KEYS',
  '_cardRows(',
  '_renderClassicScores(',
  '_renderPenaltyScores(',
  '_scoreChip(',
]) {
  if (ui.includes(forbidden)) throw new Error(`A ui.js még régi renderelő részletet tartalmaz: ${forbidden}`);
}
write('js/ui.js', ui);

let build = read('scripts/build-standalone.mjs');
const buildNeedle = `  'js/banter.js',\n  'js/ui.js',`;
const buildReplacement = `  'js/banter.js',\n  'js/ui/dom-primitives.js',\n  'js/ui/card-component.js',\n  'js/ui/scoreboard-component.js',\n  'js/ui/attribute-picker-component.js',\n  'js/ui.js',`;
if (!build.includes(buildNeedle)) throw new Error('Az önálló build UI-modulrendjének helye nem található.');
build = build.replace(buildNeedle, buildReplacement);
write('scripts/build-standalone.mjs', build);

let serviceWorker = read('sw.js');
serviceWorker = serviceWorker
  .replace('fociskartyak-2026-v30 ... fociskartyak-2026-v51', 'fociskartyak-2026-v30 ... fociskartyak-2026-v52')
  .replace("const PWA_CACHE = 'fociskartyak-2026-v52';", "const PWA_CACHE = 'fociskartyak-2026-v53';")
  .replace(
    "  './js/ui.js',",
    "  './js/ui/dom-primitives.js',\n  './js/ui/card-component.js',\n  './js/ui/scoreboard-component.js',\n  './js/ui/attribute-picker-component.js',\n  './js/ui.js',",
  );
for (const file of [
  './js/ui/dom-primitives.js',
  './js/ui/card-component.js',
  './js/ui/scoreboard-component.js',
  './js/ui/attribute-picker-component.js',
]) {
  if (!serviceWorker.includes(file)) throw new Error(`A PWA-cache-ből hiányzik: ${file}`);
}
write('sw.js', serviceWorker);

const packagePath = 'package.json';
const packageJson = JSON.parse(read(packagePath));
packageJson.scripts['test:ui-components'] = 'node test/ui-components.test.mjs';
packageJson.scripts.lint = packageJson.scripts.lint
  .replace(
    'node --check js/ui.js',
    'node --check js/ui/dom-primitives.js && node --check js/ui/card-component.js && node --check js/ui/scoreboard-component.js && node --check js/ui/attribute-picker-component.js && node --check js/ui.js',
  )
  .replace(
    'node --check test/game-runtime.test.mjs',
    'node --check test/ui-components.test.mjs && node --check test/game-runtime.test.mjs',
  );
for (const key of ['test', 'test:all']) {
  packageJson.scripts[key] = packageJson.scripts[key]
    .replace(
      'node test/game-runtime.test.mjs',
      'node test/ui-components.test.mjs && node test/game-runtime.test.mjs',
    );
}
write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

for (const path of [
  'scripts/apply-step7-ui-components.mjs',
  '.github/workflows/step7-ui-components.yml',
]) {
  const url = new URL(path, root);
  if (fs.existsSync(url)) fs.unlinkSync(url);
}

console.log('✓ A UI façade stabil vizuális komponensekre delegál.');
