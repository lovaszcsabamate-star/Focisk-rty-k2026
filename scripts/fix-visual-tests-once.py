from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'test/static.test.mjs'
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
print('A manifest telepíthető SVG-ikon tesztje frissítve.')
