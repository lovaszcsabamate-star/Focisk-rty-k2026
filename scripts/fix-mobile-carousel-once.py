from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'css/mobile-experience.css'
text = path.read_text(encoding='utf-8')

old = """    width: 100%;
    max-width: none;
    gap: 12px;"""
new = """    width: 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    gap: 12px;"""
if old not in text:
    raise SystemExit('A mobil kategóriakarusszel szélességi blokkja nem található.')
text = text.replace(old, new, 1)

old = '    scroll-snap-type: x mandatory;'
new = '    scroll-snap-type: x proximity;'
if old not in text:
    raise SystemExit('A mobil kategóriakarusszel mandatory snap beállítása nem található.')
text = text.replace(old, new, 1)

old = """    scroll-snap-align: center;
    scroll-snap-stop: always;
  }"""
new = """    width: 100%;
    min-width: 0;
    scroll-snap-align: center;
    scroll-snap-stop: normal;
  }"""
if old not in text:
    raise SystemExit('A mobil kategóriagomb kényszerített snap-stop blokkja nem található.')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('A mobil kategóriakarusszel programozott és érintéses lapozása összehangolva.')
