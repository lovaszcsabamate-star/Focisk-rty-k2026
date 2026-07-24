import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const json = relative => JSON.parse(read(relative));

const identity = json('../project-identity.json');
const pkg = json('../package.json');
const lock = json('../package-lock.json');
const manifest = json('../manifest.webmanifest');
const capacitor = json('../capacitor.config.json');
const css = read('../css/style.css');
const index = read('../index.html');
const mobile = read('../mobil.html');
const readme = read('../README.md');

assert.equal(identity.displayName, 'Fociskártyák 2026');
assert.equal(identity.packageName, 'fociskartyak-2026');
assert.equal(identity.version, pkg.version);
assert.equal(pkg.name, identity.packageName);
assert.equal(lock.name, pkg.name);
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].name, pkg.name);
assert.equal(lock.packages[''].version, pkg.version);
assert.equal(manifest.name, identity.displayName);
assert.equal(manifest.short_name, identity.shortName);
assert.equal(capacitor.appName, identity.displayName);
assert.equal(capacitor.appId, identity.androidAppId);
assert.match(index, /Fociskártyák 2026/);
assert.match(readme, /## Projektazonosítók/);
assert.match(readme, /fociskartyak-2026/);
assert.match(mobile, /id="mobile-address"/);
assert.equal(mobile.includes("new URL('./', window.location.href)"), true);
for (const legacy of identity.legacyProductNames) {
  assert.equal(pkg.name.toLowerCase().includes(legacy.toLowerCase()), false);
  assert.equal(css.toLowerCase().includes(legacy.toLowerCase()), false);
}

console.log('✓ A Fociskártyák projekt nevei és verziói egységesek');
