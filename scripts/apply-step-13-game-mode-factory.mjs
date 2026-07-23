import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const replaceRequired = (source, search, replacement, label) => {
  if (!source.includes(search)) throw new Error(`Nem található integrációs minta: ${label}`);
  return source.replace(search, replacement);
};

let runtime = read('js/game/game-runtime.js');
runtime = replaceRequired(
  runtime,
  "import { AI, Game, HUMAN, PHASE } from '../engine.js';\nimport { PenaltyGame } from '../penalties.js';\n\nexport const GAME_MODE = Object.freeze({\n  CLASSIC: 'classic',\n  PENALTIES: 'penalties',\n});\n\nconst validMode = mode => Object.values(GAME_MODE).includes(mode);",
  "import { AI, HUMAN, PHASE } from '../engine.js';\nimport { GAME_MODE, createGameModeFactory } from './game-mode-factory.js';\n\nexport { GAME_MODE } from './game-mode-factory.js';",
  'runtime importok és GAME_MODE',
);
runtime = replaceRequired(
  runtime,
  "    aiFactory = (difficulty, deck) => new OpponentAI(difficulty, deck),\n    gameFactory = null,\n  } = {}) {",
  "    aiFactory = (difficulty, deck) => new OpponentAI(difficulty, deck),\n    gameFactory = null,\n    modeFactory = null,\n  } = {}) {",
  'runtime konstruktor paraméterek',
);
runtime = replaceRequired(
  runtime,
  "    this.aiFactory = aiFactory;\n    this.gameFactory = gameFactory;",
  "    this.aiFactory = aiFactory;\n    this.modeFactory = modeFactory ?? createGameModeFactory({ gameFactory });\n    if (typeof this.modeFactory?.normalize !== 'function'\n      || typeof this.modeFactory?.create !== 'function'\n      || typeof this.modeFactory?.aiDeck !== 'function') {\n      throw new TypeError('A GameRuntime modeFactory mezője nem érvényes játékmód-factory.');\n    }",
  'runtime factory beállítás',
);
runtime = replaceRequired(
  runtime,
  "  _createGame(mode) {\n    if (!validMode(mode)) throw new GameRuntimeError('UNKNOWN_MODE', `Ismeretlen játékmód: ${mode}`);\n    if (this.gameFactory) return this.gameFactory({ mode, players: this.players, rng: this.rng });\n    return mode === GAME_MODE.PENALTIES\n      ? new PenaltyGame({ players: this.players, rng: this.rng })\n      : new Game({ players: this.players, rng: this.rng });\n  }",
  "  _createGame(mode) {\n    return this.modeFactory.create(mode, { players: this.players, rng: this.rng });\n  }",
  'runtime motorlétrehozás',
);
runtime = replaceRequired(
  runtime,
  "    const aiDeck = this.mode === GAME_MODE.PENALTIES\n      ? [...this.game.teams[HUMAN], ...this.game.teams[AI]]\n      : this.game.players;",
  "    const aiDeck = this.modeFactory.aiDeck(this.mode, this.game);",
  'runtime AI-pakli',
);
runtime = runtime.replace(
  "this.mode = validMode(mode) ? mode : GAME_MODE.CLASSIC;",
  "this.mode = this.modeFactory.normalize(mode);",
);
runtime = runtime.replace(
  "this.mode = validMode(saved.mode) ? saved.mode : GAME_MODE.CLASSIC;",
  "this.mode = this.modeFactory.normalize(saved.mode);",
);
if (runtime.includes('validMode(') || runtime.includes('new PenaltyGame') || runtime.includes('new Game(')) {
  throw new Error('A GameRuntime közvetlen játékmód-függősége nem tűnt el teljesen.');
}
write('js/game/game-runtime.js', runtime);

let build = read('scripts/build-standalone.mjs');
build = replaceRequired(
  build,
  "  'js/app/session-lifecycle-service.js',\n  'js/game/game-runtime.js',",
  "  'js/app/session-lifecycle-service.js',\n  'js/game/game-mode-factory.js',\n  'js/game/game-runtime.js',",
  'standalone modulrend',
);
write('scripts/build-standalone.mjs', build);

let sw = read('sw.js');
sw = sw.replace(
  /\/\/ Korábbi cache-verziók: fociskartyak-2026-v30 \.\.\. fociskartyak-2026-v\d+/,
  '// Korábbi cache-verziók: fociskartyak-2026-v30 ... fociskartyak-2026-v58',
);
sw = sw.replace(/const PWA_CACHE = 'fociskartyak-2026-v\d+';/, "const PWA_CACHE = 'fociskartyak-2026-v59';");
sw = replaceRequired(
  sw,
  "  './js/data/players.js',\n  './js/game/game-runtime.js',",
  "  './js/data/players.js',\n  './js/game/game-mode-factory.js',\n  './js/game/game-runtime.js',",
  'PWA shell',
);
write('sw.js', sw);

let pkg = read('package.json');
pkg = replaceRequired(
  pkg,
  'node --check js/game/game-runtime.js',
  'node --check js/game/game-mode-factory.js && node --check js/game/game-runtime.js',
  'lint factory modul',
);
pkg = replaceRequired(
  pkg,
  'node --check test/game-runtime.test.mjs',
  'node --check test/game-mode-factory.test.mjs && node --check test/game-runtime.test.mjs',
  'lint factory teszt',
);
pkg = pkg.replaceAll(
  'node test/ui-components.test.mjs && node test/game-runtime.test.mjs',
  'node test/ui-components.test.mjs && node test/game-mode-factory.test.mjs && node test/game-runtime.test.mjs',
);
pkg = replaceRequired(
  pkg,
  '"test:game-runtime": "node test/game-runtime.test.mjs",',
  '"test:game-mode-factory": "node test/game-mode-factory.test.mjs",\n    "test:game-runtime": "node test/game-runtime.test.mjs",',
  'factory npm tesztparancs',
);
write('package.json', pkg);

console.log('A 13. lépés játékmód-factory integrációja elkészült.');
