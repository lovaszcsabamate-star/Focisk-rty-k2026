import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const REGISTRY_PATH = path.join(ROOT, 'src/assets/licenses/assets-licenses.json');
const REQUIRED_FIELDS = [
  'assetId', 'filePath', 'assetType', 'sourceType', 'commercialUseAllowed',
  'modificationAllowed', 'attributionRequired', 'approvedForRelease',
];
const ASSET_EXTENSIONS = new Set([
  '.avif', '.gif', '.jpeg', '.jpg', '.mp3', '.ogg', '.otf', '.png', '.svg',
  '.ttf', '.wav', '.webm', '.webp', '.woff', '.woff2',
]);
const CODE_EXTENSIONS = new Set(['.css', '.html', '.js', '.mjs', '.ts']);

const relative = absolute => path.relative(ROOT, absolute).split(path.sep).join('/');

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function readRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) throw new Error('Hiányzik: src/assets/licenses/assets-licenses.json');
  const parsed = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('Az assetlicenc-nyilvántartásnak tömbnek kell lennie.');
  return parsed;
}

function findRemoteBrandingReferences() {
  const files = [
    ...walk(path.join(ROOT, 'js')),
    ...walk(path.join(ROOT, 'css')),
    path.join(ROOT, 'index.html'),
    path.join(ROOT, 'mobil.html'),
  ].filter(file => fs.existsSync(file) && CODE_EXTENSIONS.has(path.extname(file).toLowerCase()));

  const patterns = [
    /(?:imageUrl|photoUrl|portraitUrl|playerPhoto|logoUrl|clubLogo|crestUrl)\s*[:=]\s*['"`]https?:\/\//gi,
    /<img\b[^>]*\bsrc\s*=\s*['"]https?:\/\//gi,
    /url\(\s*['"]?https?:\/\//gi,
  ];

  return files.flatMap(file => {
    const source = fs.readFileSync(file, 'utf8');
    return patterns.flatMap(pattern => [...source.matchAll(pattern)].map(match => ({
      file: relative(file),
      snippet: match[0].slice(0, 120),
    })));
  });
}

export function auditAssetLicenses({ log = true } = {}) {
  const warnings = [];
  const errors = [];
  let registry;
  try {
    registry = readRegistry();
  } catch (error) {
    errors.push(error.message);
    registry = [];
  }

  const byPath = new Map();
  const seenIds = new Set();
  for (const asset of registry) {
    const label = asset?.assetId || asset?.filePath || 'ismeretlen asset';
    for (const field of REQUIRED_FIELDS) {
      if (!(field in (asset || {}))) errors.push(`${label}: hiányzó mező: ${field}`);
    }
    if (asset?.assetId && seenIds.has(asset.assetId)) errors.push(`Duplikált assetId: ${asset.assetId}`);
    seenIds.add(asset?.assetId);
    if (asset?.filePath) byPath.set(asset.filePath.replace(/^\.\//, ''), asset);

    const officialType = ['club-logo', 'league-logo'].includes(asset?.assetType)
      && asset?.sourceType !== 'placeholder';
    if (officialType && asset?.approvedForRelease !== true) {
      warnings.push(`${label}: hivatalos arculati elem nincs kiadásra jóváhagyva.`);
    }
    if (asset?.approvedForRelease === true && asset?.commercialUseAllowed !== true) {
      errors.push(`${label}: kiadásra jóváhagyott, de a kereskedelmi használat nincs engedélyezve.`);
    }
    if (asset?.approvedForRelease === true && !asset?.proofOfPermission) {
      errors.push(`${label}: jóváhagyott assethez hiányzik a proofOfPermission.`);
    }
  }

  const assetFiles = [
    ...walk(path.join(ROOT, 'assets')),
    ...walk(path.join(ROOT, 'src/assets/placeholders')),
  ].filter(file => ASSET_EXTENSIONS.has(path.extname(file).toLowerCase()));

  for (const file of assetFiles) {
    const filePath = relative(file);
    const entry = byPath.get(filePath);
    if (!entry) {
      warnings.push(`${filePath}: nincs a licencnyilvántartásban.`);
    } else if (entry.approvedForRelease !== true) {
      warnings.push(`${filePath}: nincs kiadásra jóváhagyva; helyettesítő/CSS fallback szükséges.`);
    }

    const looksOfficial = /(?:^|\/)(?:logos?|clubs?|leagues?)(?:\/|$)/i.test(filePath)
      || /(?:logo|crest|címer|badge)/i.test(path.basename(filePath));
    const safePlaceholder = entry?.sourceType === 'placeholder' && entry?.approvedForRelease === true;
    if (looksOfficial && !safePlaceholder && entry?.approvedForRelease !== true) {
      errors.push(`${filePath}: logó/címer jellegű asset megfelelő engedély nélkül kerülne a projektbe.`);
    }
  }

  for (const reference of findRemoteBrandingReferences()) {
    errors.push(`${reference.file}: külső játékosfotó- vagy logóhivatkozás: ${reference.snippet}`);
  }

  if (log) {
    warnings.forEach(message => console.warn(`[asset-audit] FIGYELEM: ${message}`));
    errors.forEach(message => console.error(`[asset-audit] HIBA: ${message}`));
    console.log(`[asset-audit] ${registry.length} nyilvántartott asset, ${assetFiles.length} fájl, ${warnings.length} figyelmeztetés, ${errors.length} hiba.`);
  }

  return { registry, byPath, warnings, errors, ok: errors.length === 0 };
}

const executedDirectly = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (executedDirectly) {
  const result = auditAssetLicenses();
  process.exitCode = result.ok ? 0 : 1;
}
