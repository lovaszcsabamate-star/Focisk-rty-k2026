import fs from 'node:fs';

const readJson = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const writeJson = (path, value) => fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

export const PROJECT_IDENTITY = Object.freeze({
  schemaVersion: 1,
  displayName: 'Fociskártyák 2026',
  shortName: 'Fociskártyák',
  packageName: 'fociskartyak-2026',
  version: '1.1.0',
  standaloneFile: 'Fociskartyak2026.html',
  androidAppId: 'hu.fociskartyak.game2026',
  repositoryOwner: 'lovaszcsabamate-star',
  canonicalRepositoryName: 'fociskartyak2026',
  currentRepositoryAlias: 'Focisk-rty-k2026',
  legacyProductNames: [
    'super-mega-fotbal-2026',
    'SUPER MEGA FOTBAL 2026',
  ],
});

export function normalizeProjectNaming(root = process.cwd()) {
  const at = relative => `${root}/${relative}`;
  writeJson(at('project-identity.json'), PROJECT_IDENTITY);

  const packagePath = at('package.json');
  const pkg = readJson(packagePath);
  pkg.name = PROJECT_IDENTITY.packageName;
  pkg.version = PROJECT_IDENTITY.version;
  pkg.description = 'Telepíthető magyar NB I 2025/26 összehasonlító fociskártya-játék';
  pkg.scripts['test:naming'] = 'node test/project-naming.test.mjs';
  if (!pkg.scripts.lint.includes('test/project-naming.test.mjs')) {
    pkg.scripts.lint += ' && node --check test/project-naming.test.mjs';
  }
  for (const scriptName of ['test', 'test:all']) {
    if (!pkg.scripts[scriptName].includes('test/project-naming.test.mjs')) {
      pkg.scripts[scriptName] = `node test/project-naming.test.mjs && ${pkg.scripts[scriptName]}`;
    }
  }
  writeJson(packagePath, pkg);

  const cssPath = at('css/style.css');
  const css = fs.readFileSync(cssPath, 'utf8')
    .replace('SUPER MEGA FOTBAL 2026 — pub card game', 'FOCISKÁRTYÁK 2026 — pub card game');
  fs.writeFileSync(cssPath, css);

  const mobilePath = at('mobil.html');
  let mobile = fs.readFileSync(mobilePath, 'utf8');
  mobile = mobile.replace(
    '<div class="address">https://lovaszcsabamate-star.github.io/Focisk-rty-k2026/</div>',
    '<div class="address" id="mobile-address"></div>',
  );
  if (!mobile.includes("document.querySelector('#mobile-address')")) {
    mobile = mobile.replace(
      '</body>',
      `  <script>\n    const mobileAddress = document.querySelector('#mobile-address');\n    if (mobileAddress) mobileAddress.textContent = new URL('./', window.location.href).href;\n  </script>\n</body>`,
    );
  }
  fs.writeFileSync(mobilePath, mobile);

  const readmePath = at('README.md');
  let readme = fs.readFileSync(readmePath, 'utf8');
  const identitySection = `\n## Projektazonosítók\n\n- Megjelenített név: **${PROJECT_IDENTITY.displayName}**\n- NPM-csomagnév: \`${PROJECT_IDENTITY.packageName}\`\n- Android alkalmazásazonosító: \`${PROJECT_IDENTITY.androidAppId}\`\n- Önálló játékfájl: \`${PROJECT_IDENTITY.standaloneFile}\`\n- Kanonikus repónév: \`${PROJECT_IDENTITY.canonicalRepositoryName}\`\n\nA jelenlegi GitHub-technikai útvonal a korábbi hibás karakterátalakítás miatt még \`${PROJECT_IDENTITY.currentRepositoryAlias}\`. Az alkalmazáskód és a kiadási csomagok már kizárólag a kanonikus Fociskártyák-neveket használják; a technikai útvonal külön kompatibilitási alias.\n`;
  if (!readme.includes('## Projektazonosítók')) {
    const introEnd = readme.indexOf('\n## Letöltés');
    readme = introEnd >= 0
      ? `${readme.slice(0, introEnd)}${identitySection}${readme.slice(introEnd)}`
      : `${readme}${identitySection}`;
  }
  fs.writeFileSync(readmePath, readme);

  const test = `import assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');\nconst json = relative => JSON.parse(read(relative));\n\nconst identity = json('../project-identity.json');\nconst pkg = json('../package.json');\nconst lock = json('../package-lock.json');\nconst manifest = json('../manifest.webmanifest');\nconst capacitor = json('../capacitor.config.json');\nconst css = read('../css/style.css');\nconst index = read('../index.html');\nconst mobile = read('../mobil.html');\nconst readme = read('../README.md');\n\nassert.equal(identity.displayName, 'Fociskártyák 2026');\nassert.equal(identity.packageName, 'fociskartyak-2026');\nassert.equal(identity.version, pkg.version);\nassert.equal(pkg.name, identity.packageName);\nassert.equal(lock.name, pkg.name);\nassert.equal(lock.version, pkg.version);\nassert.equal(lock.packages[''].name, pkg.name);\nassert.equal(lock.packages[''].version, pkg.version);\nassert.equal(manifest.name, identity.displayName);\nassert.equal(manifest.short_name, identity.shortName);\nassert.equal(capacitor.appName, identity.displayName);\nassert.equal(capacitor.appId, identity.androidAppId);\nassert.match(index, /Fociskártyák 2026/);\nassert.match(readme, /## Projektazonosítók/);\nassert.match(readme, /fociskartyak-2026/);\nassert.match(mobile, /id=\"mobile-address\"/);\nassert.equal(mobile.includes(\"new URL('./', window.location.href)\"), true);\nfor (const legacy of identity.legacyProductNames) {\n  assert.equal(pkg.name.toLowerCase().includes(legacy.toLowerCase()), false);\n  assert.equal(css.toLowerCase().includes(legacy.toLowerCase()), false);\n}\n\nconsole.log('✓ A Fociskártyák projekt nevei és verziói egységesek');\n`;
  fs.writeFileSync(at('test/project-naming.test.mjs'), test);

  return PROJECT_IDENTITY;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const identity = normalizeProjectNaming();
  console.log(`Projektazonosítók egységesítve: ${identity.displayName} (${identity.packageName}@${identity.version})`);
}
