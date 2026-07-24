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

function findJava() {
  const probe = spawnSync('java', ['-version'], { stdio: 'ignore' });
  if (probe.status === 0) return 'java';
  throw new Error('Az alkalmazásikon generálásához Java 11 vagy újabb szükséges.');
}

function run(command, args) {
  execFileSync(command, args, { cwd: ROOT, stdio: 'inherit' });
}

function ensureDir(relative) {
  const target = path.join(RES_DIR, relative);
  fs.mkdirSync(target, { recursive: true });
  return target;
}

const JAVA_RENDERER = String.raw`
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.File;
import javax.imageio.ImageIO;

class IconRenderer {
    private static Color parseColor(String value) {
        if ("transparent".equalsIgnoreCase(value)) return new Color(0, 0, 0, 0);
        String hex = value.startsWith("#") ? value.substring(1) : value;
        int rgb = Integer.parseInt(hex, 16);
        return new Color((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, 255);
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 5 || (args.length - 1) % 4 != 0) {
            throw new IllegalArgumentException("Használat: source.png canvas content background output.png [...]");
        }
        BufferedImage source = ImageIO.read(new File(args[0]));
        if (source == null) throw new IllegalArgumentException("A PNG ikonforrás nem olvasható.");

        for (int index = 1; index < args.length; index += 4) {
            int canvasSize = Integer.parseInt(args[index]);
            int contentSize = Integer.parseInt(args[index + 1]);
            Color background = parseColor(args[index + 2]);
            File output = new File(args[index + 3]);

            BufferedImage canvas = new BufferedImage(canvasSize, canvasSize, BufferedImage.TYPE_INT_ARGB);
            Graphics2D graphics = canvas.createGraphics();
            try {
                graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                graphics.setColor(background);
                graphics.fillRect(0, 0, canvasSize, canvasSize);

                double scale = Math.min(
                    (double) contentSize / source.getWidth(),
                    (double) contentSize / source.getHeight()
                );
                int width = Math.max(1, (int) Math.round(source.getWidth() * scale));
                int height = Math.max(1, (int) Math.round(source.getHeight() * scale));
                int x = (canvasSize - width) / 2;
                int y = (canvasSize - height) / 2;
                graphics.drawImage(source, x, y, width, height, null);
            } finally {
                graphics.dispose();
            }

            output.getParentFile().mkdirs();
            if (!ImageIO.write(canvas, "png", output)) {
                throw new IllegalStateException("A PNG kimenet nem írható: " + output);
            }
        }
    }
}
`;

if (!fs.existsSync(SOURCE_BASE64)) {
  throw new Error(`Hiányzó ikonforrás: ${SOURCE_BASE64}`);
}
if (!fs.existsSync(RES_DIR)) {
  throw new Error('Az Android projekt még nem létezik. Előbb futtasd: npx cap add android');
}

const java = findJava();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fk26-icon-'));
const sourcePng = path.join(tempDir, 'fociskartyak-app-icon.png');
const rendererFile = path.join(tempDir, 'IconRenderer.java');

try {
  const encoded = fs.readFileSync(SOURCE_BASE64, 'utf8').replace(/\s+/g, '');
  const decoded = Buffer.from(encoded, 'base64');
  if (decoded.length < 1000 || decoded.subarray(1, 4).toString('ascii') !== 'PNG') {
    throw new Error('Az ikonforrás nem érvényes PNG-adat.');
  }
  fs.writeFileSync(sourcePng, decoded);
  fs.writeFileSync(rendererFile, JAVA_RENDERER);

  const renderArguments = [
    '-Djava.awt.headless=true',
    rendererFile,
    sourcePng,
  ];
  const legacyLaunchers = [];

  for (const [density, size] of Object.entries(legacySizes)) {
    const targetDir = ensureDir(`mipmap-${density}`);
    const contentSize = Math.max(1, Math.round(size * 0.88));
    const launcher = path.join(targetDir, 'ic_launcher.png');
    legacyLaunchers.push({ launcher, round: path.join(targetDir, 'ic_launcher_round.png') });
    renderArguments.push(String(size), String(contentSize), BACKGROUND, launcher);
  }

  for (const [density, size] of Object.entries(adaptiveSizes)) {
    const targetDir = ensureDir(`mipmap-${density}`);
    // Keep all important artwork inside Android's adaptive-icon safe zone.
    const contentSize = Math.max(1, Math.round(size * 0.62));
    renderArguments.push(
      String(size),
      String(contentSize),
      'transparent',
      path.join(targetDir, 'ic_launcher_foreground.png'),
    );
  }

  run(java, renderArguments);
  for (const { launcher, round } of legacyLaunchers) fs.copyFileSync(launcher, round);

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

  console.log('FK26 Android alkalmazásikon elkészült: Java-alapú legacy, round és adaptive változatok.');
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
