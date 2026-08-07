/** Audit the service-worker shell against real startup dependencies and files. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const sw = read('sw.js');
const errors = [];
const warnings = [];

const extractArray = name => {
  const marker = `const ${name} = Object.freeze([`;
  const start = sw.indexOf(marker);
  const end = sw.indexOf(']);', start);
  if (start < 0 || end < 0) throw new Error(`Hiányzó PWA-lista: ${name}`);
  return [...sw.slice(start + marker.length, end).matchAll(/'([^']+)'/g)].map(match => match[1]);
};

const core = extractArray('CORE_SHELL');
const optional = extractArray('OPTIONAL_ASSETS');
const combined = [...core, ...optional];
const duplicates = combined.filter((value, index) => combined.indexOf(value) !== index);
if (duplicates.length) errors.push(`Duplikált PWA útvonalak: ${[...new Set(duplicates)].join(', ')}`);

const validatePath = (entry, required) => {
  if (!entry.startsWith('./')) errors.push(`Nem relatív PWA útvonal: ${entry}`);
  const relative = entry.replace(/^\.\//, '');
  const resolved = path.resolve(ROOT, relative);
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) errors.push(`A repositoryn kívülre mutató PWA útvonal: ${entry}`);
  if (!fs.existsSync(resolved)) (required ? errors : warnings).push(`${required ? 'Hiányzó CORE' : 'Hiányzó opcionális'} fájl: ${entry}`);
};
core.forEach(entry => validatePath(entry, true));
optional.forEach(entry => validatePath(entry, false));

if (combined.filter(entry => entry === './js/focus-experience.js').length !== 1) {
  errors.push('A focus-experience.js pontosan egyszer szerepelhet a PWA-listákban.');
}
if (/fociskartyak-2026-v\d+/i.test(sw)) errors.push('Kézzel növelt vNN cache-verzió maradt a service workerben.');
if (!/cache\.addAll\(CORE_SHELL\)/.test(sw)) errors.push('A CORE_SHELL nem atomikus cache.addAll() művelettel települ.');
if (!/Promise\.allSettled\(OPTIONAL_ASSETS\.map/.test(sw)) errors.push('Az opcionális assetek best-effort előtöltése hiányzik.');
if (!/SHA-256/.test(sw) || !/CACHE_PREFIX/.test(sw)) errors.push('A determinisztikus build-hash cache-név hiányzik.');

const coreSet = new Set(core);
const corePath = relative => `./${relative.replace(/^\.\//, '')}`;
const requireCore = (relative, reason) => {
  const entry = corePath(relative);
  if (!coreSet.has(entry)) errors.push(`Hiányzó CORE függőség (${reason}): ${entry}`);
};

const index = read('index.html');
for (const match of index.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"[^>]*>/g)) {
  const value = match[1];
  if (/^(?:https?:|data:|#)/i.test(value)) continue;
  requireCore(value, 'index.html');
}

const manifest = JSON.parse(read('manifest.webmanifest'));
for (const icon of manifest.icons ?? []) requireCore(icon.src, 'manifest ikon');

const registry = JSON.parse(read('data/databases/registry.json'));
const entry = registry.databases?.find(item => item.id === registry.defaultDatabaseId && item.enabled !== false);
if (!entry?.manifest) errors.push('Az aktív adatbázis manifestje nem oldható fel.');
else {
  requireCore(entry.manifest, 'aktív adatbázis manifest');
  const databaseManifest = JSON.parse(read(entry.manifest));
  const normalized = databaseManifest.files?.normalizedPlayers;
  if (!normalized) errors.push('Az aktív adatbázis normalizált játékosfájlja hiányzik a manifestből.');
  else requireCore(normalized, 'aktív normalizált játékosadatbázis');
}

const discovered = new Set();
const queue = [...index.matchAll(/<script\b[^>]*src="([^"]+\.js)"[^>]*>/g)].map(match => match[1]);
const importPatterns = [
  /(?:import|export)\s+(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/g,
  /import\(\s*['"]([^'"]+)['"]\s*\)/g,
];
while (queue.length) {
  const relative = path.posix.normalize(queue.shift().replace(/^\.\//, ''));
  if (discovered.has(relative) || !relative.endsWith('.js')) continue;
  discovered.add(relative);
  const absolute = path.join(ROOT, relative);
  if (!fs.existsSync(absolute)) continue;
  const source = fs.readFileSync(absolute, 'utf8');
  for (const pattern of importPatterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (!specifier.startsWith('.')) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier));
      if (resolved.endsWith('.js')) queue.push(resolved);
    }
  }
}
for (const module of discovered) requireCore(module, 'JavaScript importgráf');

const pipeline = read('js/ui/ui-enhancement-pipeline.js');
for (const match of pipeline.matchAll(/['"](\.\.\/[^'"]+\.js)['"]/g)) {
  const resolved = path.posix.normalize(path.posix.join('js/ui', match[1]));
  requireCore(resolved, 'UI enhancement pipeline');
}

if (warnings.length) console.warn(`[pwa-audit] ${warnings.length} figyelmeztetés:\n- ${warnings.join('\n- ')}`);
if (errors.length) {
  console.error(`[pwa-audit] ${errors.length} hiba:\n- ${errors.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`✓ PWA shell audit: ${core.length} CORE + ${optional.length} opcionális erőforrás, duplikáció és hiányzó indulási függőség nélkül`);
}
