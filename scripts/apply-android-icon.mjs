/** Generate Android legacy and adaptive launcher icons from the approved FK26 image. */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SOURCE_BASE64 = path.join(ROOT, 'assets', 'icons', 'fociskartyak-app-icon.base64');
const RES_DIR = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const MANIFEST = path.join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const BACKGROUND = '#031c18';

const legacySizes = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

const adaptiveSizes = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
};

function findImageMagick() {
  for (const command of ['magick', 'convert']) {
    const probe = spawnSync(command, ['-version'], { stdio: 'ignore' });
    if (probe.status === 0) return command;
  }
  throw new Error('Az alkalmazásikon generálásához ImageMagick szükséges (magick vagy convert).');
}

function run(command, args) {
  execFileSync(command, args, { cwd: ROOT, stdio: 'inherit' });
}

function ensureDir(relative) {
  const target = path.join(RES_DIR, relative);
  fs.mkdirSync(target, { recursive: true });
  return target;
}

if (!fs.existsSync(SOURCE_BASE64)) {
  throw new Error(`Hiányzó ikonforrás: ${SOURCE_BASE64}`);
}
if (!fs.existsSync(RES_DIR)) {
  throw new Error('Az Android projekt még nem létezik. Előbb futtasd: npx cap add android');
}

const imageMagick = findImageMagick();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fk26-icon-'));
const sourcePng = path.join(tempDir, 'fociskartyak-app-icon.png');

try {
  const encoded = fs.readFileSync(SOURCE_BASE64, 'utf8').replace(/\s+/g, '');
  const decoded = Buffer.from(encoded, 'base64');
  if (decoded.length < 1000 || decoded.subarray(1, 4).toString('ascii') !== 'PNG') {
    throw new Error('Az ikonforrás nem érvényes PNG-adat.');
  }
  fs.writeFileSync(sourcePng, decoded);

  for (const [density, size] of Object.entries(legacySizes)) {
    const targetDir = ensureDir(`mipmap-${density}`);
    const contentSize = Math.max(1, Math.round(size * 0.88));
    const launcher = path.join(targetDir, 'ic_launcher.png');

    run(imageMagick, [
      sourcePng,
      '-resize', `${contentSize}x${contentSize}`,
      '-gravity', 'center',
      '-background', BACKGROUND,
      '-extent', `${size}x${size}`,
      '-strip',
      launcher,
    ]);
    fs.copyFileSync(launcher, path.join(targetDir, 'ic_launcher_round.png'));
  }

  for (const [density, size] of Object.entries(adaptiveSizes)) {
    const targetDir = ensureDir(`mipmap-${density}`);
    // Keep all important artwork inside Android's adaptive-icon safe zone.
    const contentSize = Math.max(1, Math.round(size * 0.62));
    run(imageMagick, [
      sourcePng,
      '-resize', `${contentSize}x${contentSize}`,
      '-gravity', 'center',
      '-background', 'none',
      '-extent', `${size}x${size}`,
      '-strip',
      path.join(targetDir, 'ic_launcher_foreground.png'),
    ]);
  }

  const valuesDir = ensureDir('values');
  fs.writeFileSync(
    path.join(valuesDir, 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BACKGROUND}</color>\n</resources>\n`,
  );

  const adaptiveDir = ensureDir('mipmap-anydpi-v26');
  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background" />\n    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n</adaptive-icon>\n`;
  fs.writeFileSync(path.join(adaptiveDir, 'ic_launcher.xml'), adaptiveXml);
  fs.writeFileSync(path.join(adaptiveDir, 'ic_launcher_round.xml'), adaptiveXml);

  if (fs.existsSync(MANIFEST)) {
    let manifest = fs.readFileSync(MANIFEST, 'utf8');
    manifest = manifest
      .replace(/android:icon="[^"]+"/, 'android:icon="@mipmap/ic_launcher"')
      .replace(/android:roundIcon="[^"]+"/, 'android:roundIcon="@mipmap/ic_launcher_round"');
    fs.writeFileSync(MANIFEST, manifest);
  }

  console.log('FK26 Android alkalmazásikon elkészült: legacy, round és adaptive változatok.');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
