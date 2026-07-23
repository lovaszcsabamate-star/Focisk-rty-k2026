import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

const mainPath = 'js/main.js';
let main = read(mainPath);

const lifecycleImport = "import { createSessionLifecycleService } from './app/session-lifecycle-service.js';";
if (!main.includes(lifecycleImport)) {
  const timingImport = "import { TURN_DELAY, createTurnTimingService } from './services/turn-timing-service.js';";
  if (!main.includes(timingImport)) throw new Error('Nem található a timing service importja.');
  main = main.replace(timingImport, `${timingImport}\n${lifecycleImport}`);
}

if (!main.includes('this.lifecycle = createSessionLifecycleService();')) {
  const timingAssignment = '    this.timing = createTurnTimingService();';
  if (!main.includes(timingAssignment)) throw new Error('Nem található a timing service példányosítása.');
  main = main.replace(timingAssignment, `${timingAssignment}\n    this.lifecycle = createSessionLifecycleService();`);
}
main = main.replace('    this.exitTapAt = 0;\n', '');

const lifecycleMethodPattern = /  installLifecycleHandlers\(\) \{.*?\n  \}\n\n  handleBackAction\(\) \{/s;
const lifecycleMethodReplacement = `  installLifecycleHandlers() {
    return this.lifecycle.install({
      onSave: () => this.saveCurrentGame(),
      onToast: (message, tone, duration) => this.ui.showToast(message, tone, duration),
      onBackAction: () => this.handleBackAction(),
    });
  }

  disposeLifecycleHandlers() {
    return this.lifecycle.dispose();
  }

  handleBackAction() {`;
if (!lifecycleMethodPattern.test(main)) throw new Error('Nem található egyértelműen a lifecycle metódusblokk.');
main = main.replace(lifecycleMethodPattern, lifecycleMethodReplacement);

const exitBlockPattern = /\n    const now = Date\.now\(\);.*?this\.ui\.showToast\('A kilépéshez nyomd meg újra a Vissza gombot'\);\n/s;
if (!exitBlockPattern.test(main)) throw new Error('Nem található a Session kilépési időablak blokkja.');
main = main.replace(exitBlockPattern, '\n    this.lifecycle.requestExit();\n');

for (const forbidden of ['this.exitTapAt', 'this._popStateHandler', "window.addEventListener('pagehide'", "window.addEventListener('error'", "window.addEventListener('unhandledrejection'"]) {
  if (main.includes(forbidden)) throw new Error(`A Sessionben maradt közvetlen lifecycle felelősség: ${forbidden}`);
}
write(mainPath, main);

const buildPath = 'scripts/build-standalone.mjs';
let build = read(buildPath);
if (!build.includes("'js/app/session-lifecycle-service.js'")) {
  const marker = "  'js/services/turn-timing-service.js',";
  if (!build.includes(marker)) throw new Error('Nem található a standalone timing service bejegyzése.');
  build = build.replace(marker, `${marker}\n  'js/app/session-lifecycle-service.js',`);
}
write(buildPath, build);

const swPath = 'sw.js';
let sw = read(swPath);
sw = sw.replace(
  "// Korábbi cache-verziók: fociskartyak-2026-v30 ... fociskartyak-2026-v56\nconst PWA_CACHE = 'fociskartyak-2026-v57';",
  "// Korábbi cache-verziók: fociskartyak-2026-v30 ... fociskartyak-2026-v57\nconst PWA_CACHE = 'fociskartyak-2026-v58';",
);
if (!sw.includes("'./js/app/session-lifecycle-service.js'")) {
  const marker = "  './js/services/turn-timing-service.js',";
  if (!sw.includes(marker)) throw new Error('Nem található a PWA timing service bejegyzése.');
  sw = sw.replace(marker, `${marker}\n  './js/app/session-lifecycle-service.js',`);
}
write(swPath, sw);

const packagePath = 'package.json';
const packageJson = JSON.parse(read(packagePath));
const scripts = packageJson.scripts;
const lifecycleCheck = 'node --check js/app/session-lifecycle-service.js';
if (!scripts.lint.includes(lifecycleCheck)) {
  scripts.lint = scripts.lint.replace(
    'node --check js/services/turn-timing-service.js',
    `node --check js/services/turn-timing-service.js && ${lifecycleCheck}`,
  );
}
const lifecycleTest = 'node test/session-lifecycle-service.test.mjs';
for (const key of ['test', 'test:all']) {
  if (!scripts[key].includes(lifecycleTest)) {
    scripts[key] = scripts[key].replace(
      'node test/turn-timing-service.test.mjs',
      `node test/turn-timing-service.test.mjs && ${lifecycleTest}`,
    );
  }
}
scripts['test:session-lifecycle'] = lifecycleTest;
write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log('✓ A Session lifecycle szolgáltatás integrációja elkészült');
