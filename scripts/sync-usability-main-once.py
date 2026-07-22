import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def require_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'Nem található módosítási pont: {label}')
    return text.replace(old, new, 1)


def copy_main(path: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(subprocess.check_output(['git', 'show', f'origin/main:{path}']))


copy_main('js/usability-fixes.js')

# A névformázás a központi UI-modulban él. A külön inspector-réteg ugyanazokat a
# függvényeket importálja, így az összefűzött standalone-ban sincs névütközés.
usability_path = ROOT / 'js/usability-fixes.js'
text = usability_path.read_text(encoding='utf-8')
text = require_replace(
    text,
    "import { UI } from './ui.js';",
    "import { UI, cardNameInitials, cardPlayerDisplayName } from './ui.js';",
    'usability központi névsegéd import',
)
text = text.replace('INSPECTOR_SWIPE_DISTANCE', 'USABILITY_INSPECTOR_SWIPE_DISTANCE')
name_block_start = text.find('const NAME_PARTICLES = new Set([')
name_block_end = text.find('const usabilityFocusable = root =>', name_block_start)
if name_block_start < 0 or name_block_end < 0:
    raise SystemExit('Az inspector-modul helyi névsegédblokkja nem található.')
text = text[:name_block_start] + text[name_block_end:]
usability_path.write_text(text, encoding='utf-8')

index = ROOT / 'index.html'
text = index.read_text(encoding='utf-8')
if 'js/usability-fixes.js' not in text:
    text = require_replace(
        text,
        '  <script type="module" src="js/visual-system.js"></script>',
        '  <script type="module" src="js/usability-fixes.js"></script>\n'
        '  <script type="module" src="js/visual-system.js"></script>',
        'index usability modul',
    )
index.write_text(text, encoding='utf-8')

package_path = ROOT / 'package.json'
package = json.loads(package_path.read_text(encoding='utf-8'))
lint_command = 'node --check js/usability-fixes.js'
if lint_command not in package['scripts']['lint']:
    package['scripts']['lint'] += f' && {lint_command}'
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

build = ROOT / 'scripts/build-standalone.mjs'
text = build.read_text(encoding='utf-8')
if "'js/usability-fixes.js'" not in text:
    if "  'js/visual-system.js'," in text:
        text = text.replace(
            "  'js/visual-system.js',",
            "  'js/usability-fixes.js',\n  'js/visual-system.js',",
            1,
        )
    else:
        text = require_replace(
            text,
            "  'js/mobile-experience.js',\n  'js/main.js',",
            "  'js/mobile-experience.js',\n  'js/usability-fixes.js',\n  'js/main.js',",
            'standalone usability modul sorrend',
        )
output_marker = "  .replace('  <script type=\"module\" src=\"js/visual-system.js\"></script>\\n', '')"
if 'js/usability-fixes.js\"></script>' not in text.split("const output = read('index.html')", 1)[1]:
    text = require_replace(
        text,
        output_marker,
        "  .replace('  <script type=\"module\" src=\"js/usability-fixes.js\"></script>\\n', '')\n"
        + output_marker,
        'standalone usability külső script eltávolítás',
    )
build.write_text(text, encoding='utf-8')

sw = ROOT / 'sw.js'
text = sw.read_text(encoding='utf-8')
entry = "  './js/usability-fixes.js',"
if entry not in text:
    anchor = "  './js/visual-system.js'," if "  './js/visual-system.js'," in text else "  './js/main.js',"
    text = text.replace(anchor, entry + '\n' + anchor, 1)
sw.write_text(text, encoding='utf-8')

print('A friss inspector- és kéznagyító javítások integrációja elkészült.')
