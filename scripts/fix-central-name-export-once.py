from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'js/ui.js'
text = path.read_text(encoding='utf-8')

if 'export const cleanNameText = value =>' not in text:
    marker = 'const cleanNameText = value =>'
    if marker not in text:
        raise SystemExit('A központi cleanNameText segéd nem található a ui.js-ben.')
    text = text.replace(marker, 'export const cleanNameText = value =>', 1)

path.write_text(text, encoding='utf-8')
print('A központi cleanNameText segéd exportálva.')
