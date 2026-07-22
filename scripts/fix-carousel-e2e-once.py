from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'test/e2e/mobile-layout.spec.mjs'
text = path.read_text(encoding='utf-8')

old_helper = """async function activateAttribute(page, attributeName = 'appearances') {
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
new_helper = """async function activateAttribute(page, attributeName = 'appearances') {
  const attribute = page.locator(`#attribute-picker [data-attribute="${attributeName}"]`);
  await expect(attribute).toBeVisible();
  await attribute.evaluate(node => {
    node.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const scroller = node.closest('#attribute-picker');
    if (!scroller) return;
    const nodeRect = node.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const delta = nodeRect.left - scrollerRect.left - (scrollerRect.width - nodeRect.width) / 2;
    scroller.scrollLeft += delta;
  });
  await expect(attribute).toBeInViewport({ ratio: 0.75 });
  await attribute.click();
}

"""

if old_helper in text:
    text = text.replace(old_helper, new_helper, 1)
elif 'async function activateAttribute' not in text:
    marker = 'async function startClassicSelection(page) {'
    if marker not in text:
        raise SystemExit('A klasszikus kiválasztási segéd beszúrási pontja nem található.')
    text = text.replace(marker, new_helper + marker, 1)
elif new_helper not in text:
    start = text.find('async function activateAttribute')
    end = text.find('async function startClassicSelection', start)
    if start < 0 or end < 0:
        raise SystemExit('A meglévő kategóriaaktiváló segéd nem cserélhető.')
    text = text[:start] + new_helper + text[end:]

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
if "toBeInViewport({ ratio: 0.75 })" not in text:
    raise SystemExit('A kategória viewport-ellenőrzése nem került be a tesztbe.')

path.write_text(text, encoding='utf-8')
print('A Playwright E2E teszt függőlegesen és vízszintesen is lapozza a kategóriaválasztót.')
