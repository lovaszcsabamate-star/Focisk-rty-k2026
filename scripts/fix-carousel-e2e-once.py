from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'test/e2e/mobile-layout.spec.mjs'
text = path.read_text(encoding='utf-8')

if 'async function activateAttribute' not in text:
    marker = 'async function startClassicSelection(page) {'
    helper = """async function activateAttribute(page, attributeName = 'appearances') {
  const attribute = page.locator(`#attribute-picker [data-attribute="${attributeName}"]`);
  await expect(attribute).toBeVisible();
  await attribute.evaluate(node => {
    const scroller = node.closest('#attribute-picker');
    if (!scroller) return;
    const targetLeft = node.offsetLeft - Math.max(0, (scroller.clientWidth - node.offsetWidth) / 2);
    scroller.scrollLeft = Math.max(0, targetLeft);
  });
  await expect.poll(() => attribute.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1;
  })).toBeTruthy();
  await attribute.click();
}

"""
    if marker not in text:
        raise SystemExit('A klasszikus kiválasztási segéd beszúrási pontja nem található.')
    text = text.replace(marker, helper + marker, 1)

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

path.write_text(text, encoding='utf-8')
print('A Playwright E2E teszt a lapozható kategóriaválasztót modellezi.')
