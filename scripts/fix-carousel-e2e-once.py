from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'test/e2e/mobile-layout.spec.mjs'
text = path.read_text(encoding='utf-8')

new_helper = """async function activateAttribute(page, attributeName = 'appearances') {
  const changeCategory = page.getByText(/másik kategória/i).first();
  if (await changeCategory.isVisible().catch(() => false)) {
    await changeCategory.click();
  }

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

  const diagnostic = await attribute.evaluate(node => {
    const describe = element => {
      if (!(element instanceof Element)) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        tag: element.tagName,
        id: element.id,
        className: element.className,
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        position: style.position,
        overflow: `${style.overflowX}/${style.overflowY}`,
        transform: style.transform,
      };
    };
    const ancestors = [];
    let current = node;
    while (current && ancestors.length < 8) {
      ancestors.push(describe(current));
      current = current.parentElement;
    }
    return {
      viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY },
      ancestors,
      matchingTexts: [...document.querySelectorAll('button, [role="button"], a')]
        .filter(element => /másik kategória/i.test(element.textContent ?? ''))
        .map(describe),
    };
  });
  console.log(`ATTRIBUTE_DIAGNOSTIC ${JSON.stringify(diagnostic)}`);

  await expect(attribute).toBeInViewport({ ratio: 0.5 });
  await attribute.click();
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
if 'ATTRIBUTE_DIAGNOSTIC' not in text:
    raise SystemExit('A kategóriaválasztó geometriai diagnosztikája nem került a tesztbe.')

path.write_text(text, encoding='utf-8')
print('A Playwright E2E teszt naplózza a kategóriaválasztó teljes geometriáját.')
