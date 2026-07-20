import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const readJson = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));

const reviewed = readJson('data/players-reviewed.json');
const audit = readJson('data/database-review.json');
const changeLog = readJson('data/database-changelog.json');
const missing = readJson('data/missing-player-data-reviewed.json');
const players = reviewed.players;

assert.ok(Array.isArray(players), 'A felülvizsgált adatfájl játékoslistája hiányzik.');
assert.equal(players.length, 440, 'A teljes 2025/26-os játékoskészletnek 440 egyedi kártyát kell tartalmaznia.');
assert.equal(new Set(players.map(player => player.id)).size, players.length, 'Duplikált játékosazonosító maradt az adatbázisban.');
assert.equal(new Set(players.map(player => player.meta?.personKey)).size, players.length, 'Duplikált vagy hiányzó personKey maradt az adatbázisban.');
assert.ok(players.every(player => Number.isFinite(player.stats?.goals)), 'Minden játékoshoz végleges gólösszeg szükséges.');

assert.equal(audit.summary.players, players.length);
assert.equal(audit.summary.uniqueIds, players.length);
assert.equal(audit.summary.uniquePersonKeys, players.length);
assert.equal(audit.summary.errorCount, 0, 'Az automatikus adatminőségi audit kritikus hibát jelzett.');
assert.ok(audit.summary.exactBirthDates >= 265, 'A hivatalos kiegészítések után legalább 265 pontos születési dátumnak kell rendelkezésre állnia.');
assert.equal(audit.coverage.goals, players.length);
assert.equal(audit.sourceReview.length, 12, 'Mind a 12 NB I-es klubhoz forrásjegyzék szükséges.');

for (const [field, known] of Object.entries(audit.coverage)) {
  assert.equal(missing.missingCounts[field], players.length - known, `Hibás hiányszám: ${field}`);
  assert.equal(missing.missingByField[field].length, missing.missingCounts[field], `Hibás hiánylista: ${field}`);
}

assert.equal(changeLog.changes.length, audit.summary.changeCount, 'A változásnapló és az audit összesítése eltér.');
assert.equal(changeLog.conflicts.length, audit.summary.conflictCount, 'A konfliktusnapló és az audit összesítése eltér.');

console.log(`Adatbázis-audit rendben: ${players.length} játékos, ${audit.summary.changeCount} naplózott kiegészítés, ${audit.summary.warningCount} figyelmeztetés.`);
