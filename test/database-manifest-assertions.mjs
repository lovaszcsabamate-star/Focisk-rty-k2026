import assert from 'node:assert/strict';
import fs from 'node:fs';

const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const readText = relative => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

export function activeDatabaseManifest() {
  const registry = readJson('../data/databases/registry.json');
  const entry = registry.databases.find(item => item.id === registry.defaultDatabaseId && item.enabled !== false);
  assert.ok(entry?.manifest, `Nincs aktív alapértelmezett adatbázis: ${registry.defaultDatabaseId}`);
  const manifest = readJson(`../${entry.manifest}`);
  assert.equal(manifest.id, entry.id);
  return manifest;
}

export function assertRegisteredDataFile(fileName, group) {
  const manifest = activeDatabaseManifest();
  const files = manifest.files?.[group];
  assert.ok(Array.isArray(files), `A manifestben nincs ${group} fájllista.`);
  assert.ok(files.some(file => file.endsWith(fileName)), `${fileName} nincs a manifest ${group} listájában.`);

  assert.match(readText('../js/bootstrap.js'), /loadDatabase/);
  assert.match(readText('../js/database/database-service.js'), /getRegisteredDefaultDatabase/);
  assert.match(readText('../scripts/build-standalone.mjs'), /databaseManifestFile/);
  assert.match(readText('../sw.js'), new RegExp(fileName.replaceAll('.', '\.')));
  return manifest;
}
