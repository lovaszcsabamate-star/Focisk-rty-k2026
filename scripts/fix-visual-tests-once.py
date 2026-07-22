from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

path = ROOT / 'test/static.test.mjs'
text = path.read_text(encoding='utf-8')
old = """assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));"""
new = """const hasScalableInstallIcon = manifest.icons.some(icon => (
  icon.sizes === 'any' && icon.type === 'image/svg+xml' && String(icon.purpose ?? '').includes('maskable')
));
assert.ok(manifest.icons.some(icon => icon.sizes === '192x192') || hasScalableInstallIcon);
assert.ok(manifest.icons.some(icon => icon.sizes === '512x512') || hasScalableInstallIcon);"""
if old not in text:
    raise SystemExit('A manifest PNG-ikon tesztpontja nem található.')
path.write_text(text.replace(old, new, 1), encoding='utf-8')

runtime_files = [ROOT / 'index.html', ROOT / 'mobil.html']
runtime_files.extend((ROOT / 'js').rglob('*.js'))
runtime_files.extend((ROOT / 'css').rglob('*.css'))
replacements = {
    'Penalties mód': 'Büntetőpárbaj',
    'Tizenegyes mód': 'Büntetőpárbaj',
}
changed = []
for source_path in runtime_files:
    source = source_path.read_text(encoding='utf-8')
    updated = source
    for banned, preferred in replacements.items():
        updated = updated.replace(banned, preferred)
    if updated != source:
        source_path.write_text(updated, encoding='utf-8')
        changed.append(source_path.relative_to(ROOT).as_posix())

print('A manifest SVG-ikon tesztje és a Büntetőpárbaj forrásfeliratai frissítve.')
if changed:
    print('Módosított futó források:', ', '.join(changed))
