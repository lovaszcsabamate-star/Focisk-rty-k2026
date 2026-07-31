import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../js/tournament-rapid-upgrade.js', import.meta.url), 'utf8');
const bootstrap = readFileSync(new URL('../js/bootstrap.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../css/tournament-rapid-upgrade.css', import.meta.url), 'utf8');

assert.match(bootstrap, /import\('\.\/tournament-rapid-upgrade\.js'\)/, 'A bootstrap töltse be a fejlesztést.');
assert.match(source, /GROUP_KNOCKOUT[\s\S]*state\.phase === 'group'[\s\S]*return null;/, 'A csoportkör ne ígérjen hibás győzelemszámot.');
assert.ok(
  source.indexOf("label.includes('elodont')") < source.indexOf("label === 'donto'"),
  'Az elődöntőt a döntő előtt, külön kell felismerni.',
);
assert.match(source, /fold\(round\.label\) === 'donto'/, 'Csak a valódi döntő kapjon kupameccs címet.');
assert.match(source, /gyűjts pontokat a továbbjutáshoz/i, 'A csoportkör kapjon releváns felvezetést.');
assert.match(styles, /\.tournament-roadmap/, 'A tornahaladás vizuális elemei legyenek formázva.');
assert.match(styles, /\.tournament-match-summary/, 'A meccsösszefoglaló legyen formázva.');
assert.match(styles, /@media\(max-width:620px\)/, 'A fejlesztés maradjon mobilbarát.');

console.log('Tournament rapid upgrade regression checks passed.');
