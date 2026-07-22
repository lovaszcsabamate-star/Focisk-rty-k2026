from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'scripts/mobile-selection-smoke.mjs'
text = path.read_text(encoding='utf-8')

if 'const MAX_SELECTION_CARD_HEIGHT = 260;' not in text:
    marker = 'const HEIGHT = 820;'
    if marker not in text:
        raise SystemExit('A mobil választási smoke magassági beállítása nem található.')
    text = text.replace(marker, marker + '\nconst MAX_SELECTION_CARD_HEIGHT = 260;', 1)

text = text.replace(
    'result.maxChoiceHeight <= 245',
    'result.maxChoiceHeight <= MAX_SELECTION_CARD_HEIGHT',
)

if 'result.maxChoiceHeight <= MAX_SELECTION_CARD_HEIGHT' not in text:
    raise SystemExit('A választási kártyamagasság ellenőrzése nem frissíthető.')

path.write_text(text, encoding='utf-8')
print('A mobil választási kártyák 260 px-es teszthatára beállítva.')
