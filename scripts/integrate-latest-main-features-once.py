import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

package_path = ROOT / 'package.json'
package = json.loads(package_path.read_text(encoding='utf-8'))
scripts = package['scripts']
postprocess = 'node scripts/postprocess-standalone.mjs'
for name in ('build', 'build:standalone', 'audit:data', 'review:database'):
    if postprocess not in scripts[name]:
        scripts[name] = f'{scripts[name]} && {postprocess}'

for check in (
    'node --check js/deck-selection.js',
    'node --check scripts/postprocess-standalone.mjs',
    'node --check test/deck-selection.test.mjs',
):
    if check not in scripts['lint']:
        scripts['lint'] += f' && {check}'

for name in ('test', 'test:all'):
    deck_test = 'node test/deck-selection.test.mjs'
    if deck_test not in scripts[name]:
        marker = 'node test/rules.test.mjs'
        scripts[name] = scripts[name].replace(marker, f'{deck_test} && {marker}', 1)

package['version'] = '1.1.0'
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

lock_path = ROOT / 'package-lock.json'
lock = json.loads(lock_path.read_text(encoding='utf-8'))
lock['version'] = '1.1.0'
if isinstance(lock.get('packages', {}).get(''), dict):
    lock['packages']['']['version'] = '1.1.0'
lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

sw_path = ROOT / 'sw.js'
sw = sw_path.read_text(encoding='utf-8')
entry = "  './js/deck-selection.js',"
if entry not in sw:
    marker = "  './js/main.js',"
    if marker not in sw:
        raise SystemExit('A service worker main.js bejegyzése nem található.')
    sw = sw.replace(marker, entry + '\n' + marker, 1)
sw_path.write_text(sw, encoding='utf-8')

static_path = ROOT / 'test/static.test.mjs'
static_test = static_path.read_text(encoding='utf-8')
old_static = """assert.equal(finalMissingBasic.batch.playerCount, 7);
assert.equal(finalMissingBasic.records.length, 7);"""
new_static = """assert.equal(finalMissingBasic.batch.playerCount, finalMissingBasic.records.length);
assert.ok(finalMissingBasic.records.length >= 98);"""
if old_static in static_test:
    static_test = static_test.replace(old_static, new_static, 1)
elif new_static not in static_test:
    raise SystemExit('A végső adatkiegészítési csomag statikus szerződése nem található.')
static_path.write_text(static_test, encoding='utf-8')

stabilization_path = ROOT / 'test/stabilization.test.mjs'
stabilization = stabilization_path.read_text(encoding='utf-8')
if "const deckSelectionSource = text('js/deck-selection.js');" not in stabilization:
    stabilization += """

const deckSelectionSource = text('js/deck-selection.js');
assert.match(deckSelectionSource, /MIN_FILTERED_DECK_SIZE = 11/);
assert.match(text('js/bootstrap.js'), /applyDeckSelectionToPayload/);
assert.match(text('js/penalties.js'), /PENALTY_TEAM_SIZE = 11/);
assert.match(text('scripts/postprocess-standalone.mjs'), /standalone deck selection bootstrap/);
assert.match(text('sw.js'), /js\\/deck-selection\\.js/);
assert.match(text('package.json'), /test\\/deck-selection\\.test\\.mjs/);
"""
    stabilization_path.write_text(stabilization, encoding='utf-8')

print('A pakliválasztás, a friss main-adatok és a bővülő adatcsomag tesztje bekötve.')
