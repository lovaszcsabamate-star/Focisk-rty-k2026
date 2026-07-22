from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'test/e2e/mobile-layout.spec.mjs'
text = path.read_text(encoding='utf-8')

new_helper = """async function activateAttribute(page, attributeName = 'appearances') {
  const attribute = page.locator(`#attribute-picker [data-attribute="${attributeName}"]`);
  await expect(attribute).toBeVisible();
  await attribute.focus();
  await expect(attribute).toBeFocused();
  await page.keyboard.press('Enter');
}

"""

start = text.find('async function activateAttribute')
end = text.find('async function startClassicSelection', start)
if start >= 0 and end > start:
    text = text[:start] + new_helper + text[end:]
else:
    marker = 'async function startClassicSelection(page) {'
    if marker not in text:
        raise SystemExit('A klasszikus kiválasztási segéd beszúrási pontja nem található.')
    text = text.replace(marker, new_helper + marker, 1)

classic_old = """  const attribute = page.locator('#attribute-picker [data-attribute="appearances"]');
  await expect(attribute).toBeVisible();
  await attribute.click();"""
classic_new = """  await activateAttribute(page, 'appearances');"""
if classic_old in text:
    text = text.replace(classic_old, classic_new, 1)

penalty_old = """    const button = page.locator('#attribute-picker [data-attribute="appearances"]');
    await expect(button).toBeVisible();
    await button.click();"""
penalty_new = """    await activateAttribute(page, 'appearances');"""
if penalty_old in text:
    text = text.replace(penalty_old, penalty_new, 1)

if text.count("await activateAttribute(page, 'appearances');") < 2:
    raise SystemExit('Nem sikerült mindkét kategóriakiválasztási útvonalat frissíteni.')
if "await expect(attribute).toBeFocused();" not in text or "page.keyboard.press('Enter')" not in text:
    raise SystemExit('Az akadálymentes kategóriaválasztási útvonal nem került a tesztbe.')

path.write_text(text, encoding='utf-8')
print('A Playwright E2E teszt fókusz és Enter segítségével választ kategóriát.')
