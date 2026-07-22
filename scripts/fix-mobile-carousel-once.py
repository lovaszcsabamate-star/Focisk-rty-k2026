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
if old in text:
    text = text.replace(old, new)
elif new not in text:
    raise SystemExit('A mobil kategóriakarusszel szélességi blokkja nem található.')

mandatory = '    scroll-snap-type: x mandatory;'
proximity = '    scroll-snap-type: x proximity;'
if mandatory in text:
    text = text.replace(mandatory, proximity)
elif proximity not in text:
    raise SystemExit('A mobil kategóriakarusszel snap beállítása nem található.')

always_block = """    scroll-snap-align: center;
    scroll-snap-stop: always;
  }"""
normal_block = """    width: 100%;
    min-width: 0;
    scroll-snap-align: center;
    scroll-snap-stop: normal;
  }"""
if always_block in text:
    text = text.replace(always_block, normal_block)
elif normal_block not in text:
    raise SystemExit('A mobil kategóriagomb snap-stop blokkja nem található.')

path.write_text(text, encoding='utf-8')
print('Minden mobil kategóriakarusszel proximity/normal lapozást használ.')
