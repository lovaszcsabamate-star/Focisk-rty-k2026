from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'test/e2e/mobile-layout.spec.mjs'
text = path.read_text(encoding='utf-8')

old_helper = """async function commitFirstCard(page, double = false) {
  const inspect = page.locator('#player-hand .card--choice .card__inspect').first();
  await inspect.click();"""
new_helper = """async function commitFirstCard(page, double = false) {
  const inspect = page.locator('.pile__inspect').first();
  await expect(inspect).toBeVisible();
  await inspect.click();"""
if old_helper in text:
    text = text.replace(old_helper, new_helper, 1)
elif new_helper not in text:
    raise SystemExit('A commitFirstCard nagyítóútvonala nem frissíthető.')

old_direct = """  await firstCard.locator('.card__inspect').click();
  await expect(page.locator('#inspector')).toBeVisible();"""
new_direct = """  const handInspector = page.locator('.pile__inspect').first();
  await expect(handInspector).toBeVisible();
  await expect(page.locator('.pile__inspect')).toHaveCount(1);
  await handInspector.click();
  await expect(page.locator('#inspector')).toBeVisible();"""
if old_direct in text:
    text = text.replace(old_direct, new_direct, 1)
elif new_direct not in text:
    raise SystemExit('A közvetlen kártyanagyító tesztpontja nem frissíthető.')

if '.card__inspect' in text:
    raise SystemExit('Kártyánkénti nagyító selector maradt az E2E tesztben.')
if text.count("page.locator('.pile__inspect')") < 2:
    raise SystemExit('Az egyetlen kézszintű nagyító nincs mindkét útvonalon tesztelve.')

path.write_text(text, encoding='utf-8')
print('A Playwright E2E teszt az egyetlen kézszintű nagyítót használja.')
