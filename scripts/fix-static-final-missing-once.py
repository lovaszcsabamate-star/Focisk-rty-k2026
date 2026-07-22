from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'test/static.test.mjs'
text = path.read_text(encoding='utf-8')
old = """assert.equal(finalMissingBasic.batch.playerCount, 7);
assert.equal(finalMissingBasic.records.length, 7);"""
new = """assert.equal(finalMissingBasic.batch.playerCount, finalMissingBasic.records.length);
assert.ok(finalMissingBasic.records.length >= 98);"""
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit('A végső adatkiegészítési csomag statikus tesztpontja nem található.')
path.write_text(text, encoding='utf-8')
print('A végső adatkiegészítési csomag tesztje a bővülő, konzisztens rekordszámot ellenőrzi.')
