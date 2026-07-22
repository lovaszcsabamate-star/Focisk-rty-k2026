import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def require_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Nem található módosítási pont: {label}")
    return text.replace(old, new, 1)


def main_bytes(path: str) -> bytes:
    return subprocess.check_output(["git", "show", f"origin/main:{path}"])


def copy_main(path: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(main_bytes(path))


NEW_FILES = [
    "LEGAL_ASSETS.md",
    "css/legal-ui.css",
    "css/visual-system.css",
    "js/branding.js",
    "js/legal-ui.js",
    "js/visual-system.js",
    "scripts/audit-assets.mjs",
    "scripts/desktop-phase-previews.mjs",
    "scripts/runtime-browser-smoke.mjs",
    "src/assets/licenses/assets-licenses.json",
    "src/assets/placeholders/app-icon.svg",
    "src/assets/placeholders/club-badge.svg",
    "src/assets/placeholders/player-silhouette.svg",
    "src/config/branding.ts",
    "test/visual-system.test.mjs",
]
for relative in NEW_FILES:
    copy_main(relative)

# A mobilos belépő és a manifest nem ütközik a stabilizációs játékmenettel.
copy_main("mobil.html")
copy_main("manifest.webmanifest")

# A konszolidált indexbe csak az új jogtiszta assetek és vizuális rétegek kerülnek.
index = ROOT / "index.html"
text = index.read_text(encoding="utf-8")
text = text.replace(
    '  <link rel="icon" type="image/svg+xml" href="assets/icons/icon.svg">\n'
    '  <link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">',
    '  <link rel="icon" type="image/svg+xml" href="src/assets/placeholders/app-icon.svg">',
)
if 'css/visual-system.css' not in text:
    text = require_replace(
        text,
        '  <link rel="stylesheet" href="css/mobile-experience.css">',
        '  <link rel="stylesheet" href="css/mobile-experience.css">\n'
        '  <link rel="stylesheet" href="css/visual-system.css">\n'
        '  <link rel="stylesheet" href="css/legal-ui.css">',
        "index vizuális CSS",
    )
if 'js/branding.js' not in text:
    text = require_replace(
        text,
        '  <script type="module" src="js/ux.js"></script>',
        '  <script type="module" src="js/branding.js"></script>\n'
        '  <script type="module" src="js/ux.js"></script>',
        "index branding modul",
    )
if 'js/visual-system.js' not in text:
    text = require_replace(
        text,
        '  <script type="module" src="js/bootstrap.js"></script>',
        '  <script type="module" src="js/visual-system.js"></script>\n'
        '  <script type="module" src="js/legal-ui.js"></script>\n'
        '  <script type="module" src="js/bootstrap.js"></script>',
        "index vizuális modulok",
    )
text = text.replace(
    '<!-- ART: assets/pub/background.png is applied to #pub by ui.js when present -->',
    '<!-- ART: only license-approved backgrounds may be applied to #pub. -->',
)
index.write_text(text, encoding="utf-8")

# A stabil teszt- és Playwright-parancsok mellé kerülnek az új vizuális ellenőrzések.
package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
scripts = package["scripts"]
scripts["audit:assets"] = "node scripts/audit-assets.mjs"
scripts["build"] = "node scripts/audit-assets.mjs && node scripts/build-standalone.mjs"
scripts["build:standalone"] = scripts["build"]
scripts["mobile:prepare"] = "npm run build && node scripts/prepare-mobile.mjs"
scripts["test:runtime"] = "node scripts/runtime-browser-smoke.mjs"
scripts["preview:desktop"] = "node scripts/desktop-phase-previews.mjs"
scripts["preview:all"] = "node scripts/mobile-phase-smoke.mjs && node scripts/desktop-phase-previews.mjs"
scripts["test:visual"] = "node test/visual-system.test.mjs"
for name in ("test", "test:all"):
    command = scripts[name]
    prefix = "node scripts/audit-assets.mjs && node test/visual-system.test.mjs && "
    if "node scripts/audit-assets.mjs" not in command:
        scripts[name] = prefix + command
lint_additions = [
    "node --check js/branding.js",
    "node --check js/legal-ui.js",
    "node --check js/visual-system.js",
    "node --check scripts/audit-assets.mjs",
    "node --check scripts/desktop-phase-previews.mjs",
    "node --check scripts/runtime-browser-smoke.mjs",
    "node --check test/visual-system.test.mjs",
]
for command in lint_additions:
    if command not in scripts["lint"]:
        scripts["lint"] += f" && {command}"
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# Standalone build: licencellenőrzés, új modulok, új CSS és biztonságos helyettesítő portré.
build = ROOT / "scripts/build-standalone.mjs"
text = build.read_text(encoding="utf-8")
if "auditAssetLicenses" not in text:
    text = require_replace(
        text,
        "import { applyVerifiedPlayerCorrections } from '../js/data/verified-player-corrections.js';",
        "import { applyVerifiedPlayerCorrections } from '../js/data/verified-player-corrections.js';\n"
        "import { auditAssetLicenses } from './audit-assets.mjs';",
        "build assetaudit import",
    )
    text = require_replace(
        text,
        "const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');",
        "const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');\n"
        "const assetAudit = auditAssetLicenses();\n"
        "if (!assetAudit.ok) throw new Error('Az assetlicenc-ellenőrzés hibát talált; a kiadási build leállt.');",
        "build assetaudit indítás",
    )
if "'js/branding.js'" not in text:
    text = require_replace(text, "const moduleOrder = [", "const moduleOrder = [\n  'js/branding.js',", "build branding sorrend")
if "'js/visual-system.js'" not in text:
    text = require_replace(
        text,
        "  'js/mobile-experience.js',\n  'js/main.js',",
        "  'js/mobile-experience.js',\n  'js/visual-system.js',\n  'js/legal-ui.js',\n  'js/main.js',",
        "build vizuális modulok",
    )
text = text.replace(
    "let css = `${read('css/style.css')}\\n\\n${read('css/ux.css')}\\n\\n${read('css/matchday.css')}\\n\\n${read('css/opponents.css')}\\n\\n${read('css/pwa.css')}\\n\\n${read('css/mobile-experience.css')}`;",
    "let css = `${read('css/style.css')}\\n\\n${read('css/ux.css')}\\n\\n${read('css/matchday.css')}\\n\\n${read('css/opponents.css')}\\n\\n${read('css/pwa.css')}\\n\\n${read('css/mobile-experience.css')}\\n\\n${read('css/visual-system.css')}\\n\\n${read('css/legal-ui.css')}`;",
)
if "playerPlaceholder" not in text:
    text = require_replace(
        text,
        "const backgroundFiles = [",
        "const playerPlaceholder = fs.readFileSync(path.join(ROOT, 'src/assets/placeholders/player-silhouette.svg')).toString('base64');\n"
        "css = css.replaceAll('../src/assets/placeholders/player-silhouette.svg', `data:image/svg+xml;base64,${playerPlaceholder}`);\n\n"
        "const backgroundFiles = [",
        "build helyettesítő portré",
    )
text = text.replace(
    "const backgroundFile = backgroundFiles.find(([relative]) => fs.existsSync(path.join(ROOT, relative)));",
    "const backgroundFile = backgroundFiles.find(([relative]) => {\n"
    "  const license = assetAudit.byPath.get(relative);\n"
    "  return license?.approvedForRelease === true && fs.existsSync(path.join(ROOT, relative));\n"
    "});",
)
if "css/visual-system.css" not in text.split("const output = read('index.html')", 1)[1]:
    text = require_replace(
        text,
        "  .replace('\\n  <link rel=\"stylesheet\" href=\"css/mobile-experience.css\">', '')",
        "  .replace('\\n  <link rel=\"stylesheet\" href=\"css/mobile-experience.css\">', '')\n"
        "  .replace('\\n  <link rel=\"stylesheet\" href=\"css/visual-system.css\">', '')\n"
        "  .replace('\\n  <link rel=\"stylesheet\" href=\"css/legal-ui.css\">', '')",
        "build CSS eltávolítás",
    )
if "js/branding.js" not in text.split("const output = read('index.html')", 1)[1]:
    text = require_replace(
        text,
        "  .replace('  <script type=\"module\" src=\"js/ux.js\"></script>\\n', '')",
        "  .replace('  <script type=\"module\" src=\"js/branding.js\"></script>\\n', '')\n"
        "  .replace('  <script type=\"module\" src=\"js/ux.js\"></script>\\n', '')",
        "build branding script eltávolítás",
    )
if "js/visual-system.js" not in text.split("const output = read('index.html')", 1)[1]:
    text = require_replace(
        text,
        "  .replace('  <script type=\"module\" src=\"js/pwa.js\"></script>\\n', '')",
        "  .replace('  <script type=\"module\" src=\"js/pwa.js\"></script>\\n', '')\n"
        "  .replace('  <script type=\"module\" src=\"js/visual-system.js\"></script>\\n', '')\n"
        "  .replace('  <script type=\"module\" src=\"js/legal-ui.js\"></script>\\n', '')",
        "build vizuális script eltávolítás",
    )
build.write_text(text, encoding="utf-8")

# Offline csomag: csak a konszolidált és új fájlok, új cache-verzióval.
sw = ROOT / "sw.js"
text = sw.read_text(encoding="utf-8")
import re
text = re.sub(r"const PWA_CACHE = 'fociskartyak-2026-v\d+';", "const PWA_CACHE = 'fociskartyak-2026-v47';", text, count=1)
for item in [
    "  './css/visual-system.css',",
    "  './css/legal-ui.css',",
    "  './js/branding.js',",
    "  './js/visual-system.js',",
    "  './js/legal-ui.js',",
    "  './src/assets/placeholders/app-icon.svg',",
    "  './src/assets/placeholders/club-badge.svg',",
    "  './src/assets/placeholders/player-silhouette.svg',",
]:
    if item not in text:
        anchor = "  './css/mobile-experience.css'," if "/css/" in item else "  './js/main.js',"
        if "src/assets" in item:
            anchor = "  './manifest.webmanifest',"
        text = text.replace(anchor, anchor + "\n" + item, 1)
sw.write_text(text, encoding="utf-8")

# A cache-verzióra épülő regressziós állítások követik az új offline csomagot.
for test_file in (ROOT / "test").glob("*.mjs"):
    source = test_file.read_text(encoding="utf-8")
    source = re.sub(r"fociskartyak-2026-v(?:43|44|45|46)", "fociskartyak-2026-v47", source)
    test_file.write_text(source, encoding="utf-8")

# A normál CI is ellenőrzi az új jogi/vizuális rendszert és futásidejű nézeteket.
ci = ROOT / ".github/workflows/ci.yml"
text = ci.read_text(encoding="utf-8")
if "Assetlicenc-ellenőrzés" not in text:
    text = require_replace(
        text,
        "      - name: Standalone build\n        run: npm run build",
        "      - name: Assetlicenc-ellenőrzés\n        run: npm run audit:assets\n"
        "      - name: Standalone build\n        run: npm run build",
        "CI assetaudit",
    )
if "Futásidejű böngészőteszt" not in text:
    text = require_replace(
        text,
        "      - name: Git formázási ellenőrzés\n        run: git diff --check",
        "      - name: Futásidejű böngészőteszt\n        run: npm run test:runtime\n"
        "      - name: Asztali fáziselőnézetek\n        run: npm run preview:desktop\n"
        "      - name: Git formázási ellenőrzés\n        run: git diff --check",
        "CI vizuális futástesztek",
    )
ci.write_text(text, encoding="utf-8")

print("A grafikai és jogi assetrendszer portolása elkészült.")
