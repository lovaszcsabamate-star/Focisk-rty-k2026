import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const replaceRequired = (source, search, replacement, label) => {
  if (!source.includes(search)) throw new Error(`Hiányzó integrációs minta: ${label}`);
  return source.replace(search, replacement);
};

let main = read('js/main.js');
main = replaceRequired(
  main,
  "import { GameRuntime } from './game/game-runtime.js';",
  "import { GameRuntime } from './game/game-runtime.js';\nimport { TURN_DELAY, createTurnTimingService } from './services/turn-timing-service.js';",
  'main timing import',
);
main = replaceRequired(
  main,
  "const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));\n",
  '',
  'legacy wait helper',
);
main = replaceRequired(
  main,
  '    this.runtime = new GameRuntime({ players: deck });\n',
  '    this.runtime = new GameRuntime({ players: deck });\n    this.timing = createTurnTimingService();\n',
  'Session timing instance',
);
main = replaceRequired(
  main,
  '  delay(milliseconds) {\n    return wait(this.settings.animations ? milliseconds : Math.min(milliseconds, 90));\n  }',
  '  delay(delayOrKey) {\n    return this.timing.wait(delayOrKey, { animations: this.settings.animations });\n  }',
  'Session delay delegation',
);
main = replaceRequired(main, 'await this.delay(550);', 'await this.delay(TURN_DELAY.AI_CHOOSE_ATTRIBUTE);', 'AI attribute delay');
main = replaceRequired(main, 'await this.delay(500);', 'await this.delay(TURN_DELAY.AI_CHOOSE_CARD);', 'AI card delay');
write('js/main.js', main);

let mobile = read('js/mobile-experience.js');
const timerPatch = /export const FAST_AI_TURN_DELAYS = Object\.freeze\([\s\S]*?\nconst installAiTurnRecovery =/;
if (!timerPatch.test(mobile)) throw new Error('A globális AI timerpatch blokk nem található.');
mobile = mobile.replace(timerPatch, 'const installAiTurnRecovery =');
mobile = replaceRequired(mobile, 'installFastAiTurnTimer();\n', '', 'timerpatch installer');
write('js/mobile-experience.js', mobile);

const packageJson = JSON.parse(read('package.json'));
const scripts = packageJson.scripts;
if (!scripts.lint.includes('js/services/turn-timing-service.js')) {
  scripts.lint = scripts.lint.replace(
    'node --check js/services/save-service.js',
    'node --check js/services/save-service.js && node --check js/services/turn-timing-service.js',
  );
}
if (!scripts.lint.includes('test/turn-timing-service.test.mjs')) {
  scripts.lint = scripts.lint.replace(
    'node --check test/save-service.test.mjs',
    'node --check test/save-service.test.mjs && node --check test/turn-timing-service.test.mjs',
  );
}
scripts['test:turn-timing'] = 'node test/turn-timing-service.test.mjs';
for (const key of ['test', 'test:all']) {
  if (!scripts[key].includes('test/turn-timing-service.test.mjs')) {
    scripts[key] = scripts[key].replace(
      'node test/save-service.test.mjs',
      'node test/save-service.test.mjs && node test/turn-timing-service.test.mjs',
    );
  }
}
write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

let build = read('scripts/build-standalone.mjs');
build = replaceRequired(
  build,
  "  'js/services/save-service.js',\n",
  "  'js/services/save-service.js',\n  'js/services/turn-timing-service.js',\n",
  'standalone timing order',
);
write('scripts/build-standalone.mjs', build);

let sw = read('sw.js');
sw = replaceRequired(sw, 'Korábbi cache-verziók: fociskartyak-2026-v30 ... fociskartyak-2026-v55', 'Korábbi cache-verziók: fociskartyak-2026-v30 ... fociskartyak-2026-v56', 'cache history');
sw = replaceRequired(sw, "const PWA_CACHE = 'fociskartyak-2026-v56';", "const PWA_CACHE = 'fociskartyak-2026-v57';", 'cache version');
sw = replaceRequired(
  sw,
  "  './js/services/save-service.js',\n",
  "  './js/services/save-service.js',\n  './js/services/turn-timing-service.js',\n",
  'PWA timing module',
);
write('sw.js', sw);

fs.rmSync('scripts/apply-step-11-ai-timing.mjs');
fs.rmSync('.github/workflows/apply-step-11-ai-timing.yml');
console.log('✓ A 11. lépés timing service integrációja elkészült.');
