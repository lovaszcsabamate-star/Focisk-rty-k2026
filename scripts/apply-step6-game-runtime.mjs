import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const write = (path, content) => fs.writeFileSync(new URL(path, root), content);

const replace = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Nem található refaktorálási részlet: ${label}`);
  return source.replace(before, after);
};

let main = read('js/main.js');
main = replace(main,
`import { Game, PHASE, HUMAN, AI, GAME_DECK_SIZE } from './engine.js';
import { PenaltyGame } from './penalties.js';
import { OpponentAI, DIFFICULTY } from './ai.js';`,
`import { PHASE, HUMAN, AI, GAME_DECK_SIZE } from './engine.js';
import { DIFFICULTY } from './ai.js';
import { GameRuntime } from './game/game-runtime.js';`,
'importok');

main = replace(main,
`    this.meta = meta;
    this.settings = { ...DEFAULT_SETTINGS, ...loadSettings() };`,
`    this.meta = meta;
    this.runtime = new GameRuntime({ players: deck });
    this.settings = { ...DEFAULT_SETTINGS, ...loadSettings() };`,
'runtime létrehozása');

main = replace(main,
`    this.busy = false;
    this.game = null;
    this.overlayReturn = null;`,
`    this.busy = false;
    this.overlayReturn = null;`,
'közvetlen game mező eltávolítása');

main = replace(main,
`  delay(milliseconds) {`,
`  get game() { return this.runtime.game; }
  get mode() { return this.runtime.mode; }
  get difficulty() { return this.runtime.difficulty; }
  get pendingAttribute() { return this.runtime.pendingAttribute; }
  get awaitingChooserCard() { return this.runtime.awaitingChooserCard; }

  delay(milliseconds) {`,
'runtime getterek');

main = replace(main,
`    this.game = null;
    this.pendingAttribute = null;
    this.awaitingChooserCard = false;`,
`    this.runtime.reset();`,
'főmenü runtime reset');

main = replace(main,
`  start(mode, difficulty) {
    clearSavedMatch();
    this.mode = mode;
    this.difficulty = validDifficulty(difficulty) ? difficulty : selectedOpponentDifficulty();
    this.busy = false;
    this.pendingAttribute = null;
    this.awaitingChooserCard = false;
    this.ui.resetTable();
    this.ui.setMode(mode);
    this.game = mode === 'penalties'
      ? new PenaltyGame({ players: this.deck })
      : new Game({ players: this.deck });
    this.prepareAI();

    if (mode === 'penalties') this.showPenaltyIntro();
    else this._beginMatch();
  }

  prepareAI() {
    const aiDeck = this.mode === 'penalties'
      ? [...this.game.teams[HUMAN], ...this.game.teams[AI]]
      : this.game.players;
    this.ai = new OpponentAI(this.difficulty, aiDeck);
  }`,
`  start(mode, difficulty) {
    clearSavedMatch();
    this.runtime.start(mode, validDifficulty(difficulty) ? difficulty : selectedOpponentDifficulty());
    this.busy = false;
    this.ui.resetTable();
    this.ui.setMode(this.mode);

    if (this.mode === 'penalties') this.showPenaltyIntro();
    else this._beginMatch();
  }`,
'játékindítás');

main = replace(main,
`    this.pendingAttribute = attributeKey;
    this.ui.hideAttributePicker();`,
`    this.runtime.selectHumanAttribute(attributeKey);
    this.ui.hideAttributePicker();`,
'emberi kategóriaválasztás');
main = replace(main,
`    this.awaitingChooserCard = true;
    this.saveCurrentGame();`,
`    this.saveCurrentGame();`,
'emberi várakozási állapot');

main = replace(main,
`    const choice = this.ai.chooseAttribute(game.hands[AI], game.availableAttributeKeys());
    game.chooseAttribute(choice.attribute, choice.cardId);`,
`    const choice = this.runtime.chooseAiAttribute();`,
'AI kategóriaválasztás');
main = replace(main,
`    this.awaitingChooserCard = false;
    this.busy = false;`,
`    this.busy = false;`,
'AI várakozási állapot');

main = replace(main,
`      if (this.awaitingChooserCard) {
        this.game.chooseAttribute(this.pendingAttribute, card.id);
        this.awaitingChooserCard = false;
        this.ui.showDuel(this.game, { opponentHidden: true });
        this.ui.renderHands(this.game, { selectable: false });
        this.ui.setPrompt('A gép kártyát választ…');
        await this.delay(500);
        const aiCardId = this.ai.chooseCard(this.game.hands[AI], this.game.attribute);
        result = this.game.playCard(AI, aiCardId);
      } else {
        result = this.game.playCard(HUMAN, card.id);`,
`      if (this.awaitingChooserCard) {
        this.runtime.commitHumanChooserCard(card.id);
        this.ui.showDuel(this.game, { opponentHidden: true });
        this.ui.renderHands(this.game, { selectable: false });
        this.ui.setPrompt('A gép kártyát választ…');
        await this.delay(500);
        result = this.runtime.playAiCard();
      } else {
        result = this.runtime.playHumanCard(card.id);`,
'kártyakijátszás');

main = replace(main,
`      if (this.mode === 'penalties') {
        const { reshuffled } = this.game.nextDuel();
        if (reshuffled) this.ui.say(getLine('reshuffle'));
      } else {
        this.game.nextRound();
        this.ui.say(getIdleChatter());
      }`,
`      const { reshuffled } = this.runtime.advance();
      if (this.mode === 'penalties') {
        if (reshuffled) this.ui.say(getLine('reshuffle'));
      } else {
        this.ui.say(getIdleChatter());
      }`,
'következő kör');

main = replace(main,
`    return writeSavedMatch({
      game: this.game,
      mode: this.mode,
      difficulty: this.difficulty,
      pendingAttribute: this.pendingAttribute,
      awaitingChooserCard: this.awaitingChooserCard,
      uxStats: this.ui.uxStats,
    });`,
`    return writeSavedMatch(this.runtime.toSavePayload(this.ui.uxStats));`,
'mentés');

main = replace(main,
`      this.mode = saved.mode;
      this.difficulty = validDifficulty(saved.difficulty) ? saved.difficulty : selectedOpponentDifficulty();
      this.pendingAttribute = saved.pendingAttribute;
      this.awaitingChooserCard = Boolean(saved.awaitingChooserCard);
      this.game = saved.mode === 'penalties'
        ? hydrateGame(new PenaltyGame({ players: this.deck }), saved.game)
        : hydrateGame(new Game({ players: this.deck }), saved.game);
      this.ui.resetTable();
      this.ui.setMode(this.mode);
      if (saved.uxStats) this.ui.uxStats = saved.uxStats;
      this.prepareAI();`,
`      this.runtime.restore({
        ...saved,
        difficulty: validDifficulty(saved.difficulty) ? saved.difficulty : selectedOpponentDifficulty(),
      }, hydrateGame);
      this.ui.resetTable();
      this.ui.setMode(this.mode);
      if (saved.uxStats) this.ui.uxStats = saved.uxStats;`,
'mentés visszaállítása');

main = replace(main,
`        this.awaitingChooserCard = false;`,
`        this.runtime.clearPendingChoice();`,
'visszaállított választás lezárása');

main = replace(main,
`    const aiCardId = this.ai.chooseCard(this.game.hands[AI], this.game.attribute);
    const result = this.game.playCard(AI, aiCardId);`,
`    const result = this.runtime.playAiCard();`,
'félbemaradt AI-lépés');
main = replace(main,
`    const result = this.game.result();`,
`    const result = this.runtime.result();`,
'végeredmény');

const forbidden = [
  /this\.(game|mode|difficulty|pendingAttribute|awaitingChooserCard)\s*=/,
  /this\.ai\./,
  /this\.game\.(chooseAttribute|playCard|nextRound|nextDuel|result)\(/,
  /new (Game|PenaltyGame)\(/,
];
for (const pattern of forbidden) {
  if (pattern.test(main)) throw new Error(`A main.js még közvetlen motorvezérlést tartalmaz: ${pattern}`);
}
write('js/main.js', main);

const packagePath = 'package.json';
const packageJson = JSON.parse(read(packagePath));
packageJson.scripts['test:game-runtime'] = 'node test/game-runtime.test.mjs';
packageJson.scripts.lint = packageJson.scripts.lint
  .replace('node --check js/engine.js', 'node --check js/game/game-runtime.js && node --check js/engine.js')
  .replace('node --check test/deck-selection.test.mjs', 'node --check test/game-runtime.test.mjs && node --check test/deck-selection.test.mjs');
for (const key of ['test', 'test:all']) {
  packageJson.scripts[key] = packageJson.scripts[key]
    .replace('node test/rules.test.mjs', 'node test/game-runtime.test.mjs && node test/rules.test.mjs');
}
write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

let serviceWorker = read('sw.js');
serviceWorker = serviceWorker
  .replace('fociskartyak-2026-v30 ... fociskartyak-2026-v50', 'fociskartyak-2026-v30 ... fociskartyak-2026-v51')
  .replace("const PWA_CACHE = 'fociskartyak-2026-v51';", "const PWA_CACHE = 'fociskartyak-2026-v52';")
  .replace("  './js/engine.js',", "  './js/game/game-runtime.js',\n  './js/engine.js',");
write('sw.js', serviceWorker);

let staticTest = read('test/static.test.mjs');
staticTest = replace(staticTest,
`const main = read('../js/main.js');`,
`const main = read('../js/main.js');
const gameRuntime = read('../js/game/game-runtime.js');`,
'statikus runtime forrás');
staticTest = replace(staticTest,
`assert.match(main, /Klasszikus mód/);`,
`assert.match(main, /Klasszikus mód/);
assert.match(main, /new GameRuntime/);
assert.match(main, /runtime\.start/);
assert.match(main, /runtime\.playHumanCard/);
assert.match(main, /runtime\.playAiCard/);
assert.doesNotMatch(main, /new (Game|PenaltyGame)\(/);
assert.doesNotMatch(main, /this\.game\.(chooseAttribute|playCard|nextRound|nextDuel|result)\(/);
assert.doesNotMatch(gameRuntime, /\\bdocument\\b|\\bwindow\\b|querySelector|innerHTML|from ['\"]\.\.\\/ui\.js/);`,
'statikus runtime szerződés');
write('test/static.test.mjs', staticTest);

for (const path of [
  'scripts/apply-step6-game-runtime.mjs',
  '.github/workflows/step6-refactor.yml',
]) {
  const url = new URL(path, root);
  if (fs.existsSync(url)) fs.unlinkSync(url);
}

console.log('✓ A Session közvetlen motorvezérlése GameRuntime-hívásokra cserélve.');
