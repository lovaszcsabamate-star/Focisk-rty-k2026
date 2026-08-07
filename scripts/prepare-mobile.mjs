/** Build the dependency-free game and prepare Capacitor's mobile web directory. */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const MOBILE_DIR = path.join(ROOT, 'mobile-www');
const STANDALONE_FILE = path.join(ROOT, 'Fociskartyak2026.html');

execFileSync(process.execPath, [path.join(HERE, 'build-standalone-with-settings.mjs')], {
  cwd: ROOT,
  stdio: 'inherit',
});
execFileSync(process.execPath, [path.join(HERE, 'postprocess-standalone.mjs')], {
  cwd: ROOT,
  stdio: 'inherit',
});

fs.rmSync(MOBILE_DIR, { recursive: true, force: true });
fs.mkdirSync(MOBILE_DIR, { recursive: true });

function convertStandaloneModuleForAndroidWebView(html) {
  // A standalone csomagban minden alkalmazásmodul már be van ágyazva. A bent maradó
  // külső module src hivatkozások az APK-ban nem létező fájlokra mutatnának.
  let mobileHtml = html.replace(
    /\s*<script\s+type=["']module["']\s+src=["'][^"']+["']\s*><\/script>/giu,
    '',
  );

  const moduleOpening = '<script type="module">';
  const moduleStart = mobileHtml.lastIndexOf(moduleOpening);
  const moduleEnd = mobileHtml.lastIndexOf('</script>');

  if (moduleStart < 0 || moduleEnd <= moduleStart) {
    throw new Error('A mobilcsomag fő alkalmazásmodulja nem található.');
  }

  const beforeModule = mobileHtml.slice(0, moduleStart);
  const moduleBody = mobileHtml.slice(moduleStart + moduleOpening.length, moduleEnd);
  const afterModule = mobileHtml.slice(moduleEnd + '</script>'.length);

  const startupFailureHandler = `
})().catch(error => {
  console.error('[android-startup] A játék indítása meghiúsult:', error);
  document.documentElement.dataset.appStartupError = 'true';
  const loading = document.querySelector('#app-loading');
  if (loading) {
    loading.hidden = false;
    loading.innerHTML = '<div class="app-loading__error" role="alert"><strong>A játék nem tudott elindulni.</strong><span>Zárd be teljesen az alkalmazást, majd indítsd újra.</span></div>';
  }
});
`;

  mobileHtml = `${beforeModule}<script>\n(async () => {\n'use strict';\n${moduleBody}${startupFailureHandler}</script>${afterModule}`;

  if (/<script\b[^>]*\bsrc=/iu.test(mobileHtml)) {
    throw new Error('A mobilcsomag külső JavaScript-hivatkozást tartalmaz.');
  }
  if (/<script\b[^>]*\btype=["']module["']/iu.test(mobileHtml)) {
    throw new Error('A mobilcsomagban WebView-kompatibilitást rontó module script maradt.');
  }

  return mobileHtml;
}

const standaloneSource = fs.readFileSync(STANDALONE_FILE, 'utf8');
const standalone = convertStandaloneModuleForAndroidWebView(standaloneSource)
  .replace(
    '</head>',
    '  <meta name="application-name" content="Fociskártyák 2026">\n' +
      '  <meta name="format-detection" content="telephone=no">\n' +
      '  <meta name="mobile-webview-compatible" content="true">\n' +
      '</head>',
  )
  .replace(/[ \t]+$/gm, '');

fs.writeFileSync(path.join(MOBILE_DIR, 'index.html'), standalone);

const optionalCopies = [
  ['manifest.webmanifest', 'manifest.webmanifest'],
  ['src/assets/placeholders', 'src/assets/placeholders'],
];

for (const [sourceRelative, targetRelative] of optionalCopies) {
  const source = path.join(ROOT, sourceRelative);
  if (!fs.existsSync(source)) continue;
  fs.cpSync(source, path.join(MOBILE_DIR, targetRelative), { recursive: true });
}

console.log(`Mobil webcsomag elkészült: ${MOBILE_DIR}`);
