from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def require_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Nem található módosítási pont: {label}")
    return text.replace(old, new, 1)


# README letöltési hivatkozások
readme = ROOT / "README.md"
text = readme.read_text(encoding="utf-8")
if "## Letöltés" not in text:
    marker = "## Indítás"
    block = """## Letöltés

### [⬇️ Legújabb önálló játék letöltése](https://github.com/lovaszcsabamate-star/Focisk-rty-k2026/raw/refs/heads/main/Fociskartyak2026.html)

A letöltött `Fociskartyak2026.html` fájl közvetlenül, dupla kattintással megnyitható a böngészőben. A hivatkozás mindig a `main` ág legfrissebb, beágyazott adatbázist tartalmazó változatát tölti le.

### [📦 Teljes projekt letöltése ZIP-ben](https://github.com/lovaszcsabamate-star/Focisk-rty-k2026/archive/refs/heads/main.zip)

A teljes csomag tartalmazza a forráskódot, az adatfájlokat, az önálló játékfájlt és a Windows-indítót.

"""
    text = require_replace(text, marker, block + marker, "README / Indítás")
    readme.write_text(text, encoding="utf-8")


# Teljes, olvasható kártyanevek és kétirányú érintéses lapozás
ui = ROOT / "js/ui.js"
text = ui.read_text(encoding="utf-8")
if "export function cardPlayerDisplayName" not in text:
    old = "const initials = name => name.split(' ').filter(Boolean).map(word => word[0]).join('').slice(0, 2).toUpperCase();"
    new = r"""const NAME_PARTICLES = new Set([
  'a', 'al', 'ap', 'da', 'das', 'de', 'del', 'della', 'der', 'di', 'do', 'dos',
  'du', 'el', 'la', 'le', 'van', 'von',
]);
const NAME_SUFFIXES = new Set(['ii', 'iii', 'iv', 'jr', 'jr.', 'sr', 'sr.']);
const INSPECTOR_SWIPE_DISTANCE = 44;

const cleanNameText = value => String(value ?? '')
  .normalize('NFKC')
  .replace(/[…]+/gu, ' ')
  .replace(/\.{2,}/gu, ' ')
  .replace(/[,_]+/gu, ' ')
  .replace(/\s+/gu, ' ')
  .trim();

const titleCaseName = value => {
  const words = cleanNameText(value).toLocaleLowerCase('hu-HU').split(' ').filter(Boolean);
  return words.map((word, index) => {
    if (NAME_SUFFIXES.has(word)) return word.replace('.', '').toLocaleUpperCase('hu-HU');
    if (index > 0 && NAME_PARTICLES.has(word)) return word;
    return word.replace(/(^|[-'’])(\p{L})/gu, (_, prefix, letter) => (
      `${prefix}${letter.toLocaleUpperCase('hu-HU')}`
    ));
  }).join(' ');
};

const profileSlugName = card => {
  const candidates = [card?.meta?.profileUrl, card?.meta?.birthDateSource, card?.meta?.sourceUrl]
    .filter(value => typeof value === 'string' && value.trim());
  for (const candidate of candidates) {
    try {
      const segments = new URL(candidate).pathname.split('/').filter(Boolean);
      const profileIndex = segments.findIndex(segment => segment.toLocaleLowerCase('hu-HU') === 'profil');
      if (profileIndex <= 0 || segments[profileIndex + 1]?.toLocaleLowerCase('hu-HU') !== 'spieler') continue;
      const slug = decodeURIComponent(segments[profileIndex - 1]).replace(/[-_]+/gu, ' ');
      const words = cleanNameText(slug).split(' ').filter(Boolean);
      if (words.length >= 1 && words.length <= 3) return slug;
    } catch {
      // A hibás vagy relatív forrás-URL nem akadályozhatja a kártya megjelenítését.
    }
  }
  return '';
};

export function cardPlayerDisplayName(card = {}) {
  const explicit = cleanNameText(
    card.shortName ?? card.displayName ?? card.knownAs
      ?? card.meta?.shortName ?? card.meta?.displayName ?? card.meta?.knownAs,
  );
  const original = cleanNameText(card.name);
  const originalWords = original.split(' ').filter(Boolean);
  let selected = explicit || original;
  if (!explicit && originalWords.length > 2) {
    const profileName = profileSlugName(card);
    if (profileName) selected = profileName;
  }
  return titleCaseName(selected) || 'Ismeretlen játékos';
}

export function cardNameInitials(value) {
  return cardPlayerDisplayName({ name: value })
    .split(' ')
    .filter(word => !NAME_PARTICLES.has(word.toLocaleLowerCase('hu-HU')))
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase('hu-HU');
}"""
    text = require_replace(text, old, new, "ui.js névsegédek")

    old = """    const node = el('article', 'card');
    node.dataset.cardId = card.id;
    const portrait = el('div', 'card__portrait');
    portrait.dataset.initials = initials(card.name);
    tryArt(portrait, [...ART.portrait(card.id), ...(card.meta?.imageUrl ? [card.meta.imageUrl] : [])]);
    if (card.position) portrait.appendChild(el('span', 'card__position', card.position));
    node.appendChild(portrait);
    node.appendChild(el('div', 'card__name', card.name));"""
    new = """    const node = el('article', 'card');
    node.dataset.cardId = card.id;
    const displayName = cardPlayerDisplayName(card);
    node.dataset.displayName = displayName;
    const portrait = el('div', 'card__portrait');
    portrait.dataset.initials = cardNameInitials(displayName);
    tryArt(portrait, [...ART.portrait(card.id), ...(card.meta?.imageUrl ? [card.meta.imageUrl] : [])]);
    if (card.position) portrait.appendChild(el('span', 'card__position', card.position));
    node.appendChild(portrait);
    const nameNode = el('div', 'card__name', displayName);
    nameNode.title = cleanNameText(card.name) || displayName;
    nameNode.setAttribute('aria-label', displayName);
    nameNode.classList.toggle('card__name--compact', displayName.length > 20 || displayName.split(' ').length > 2);
    node.appendChild(nameNode);"""
    text = require_replace(text, old, new, "ui.js kártyanév")

    old = "    const centre = el('div', 'inspector__centre');\n    centre.appendChild(this.renderCard(card, { activeAttribute: opts.attribute, large: true }));"
    new = """    const centre = el('div', 'inspector__centre');
    let swipeStart = null;
    centre.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' || event.button !== 0) return;
      swipeStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    }, { passive: true });
    centre.addEventListener('pointerup', event => {
      if (!swipeStart || swipeStart.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - swipeStart.x;
      const deltaY = event.clientY - swipeStart.y;
      swipeStart = null;
      if (Math.abs(deltaX) < INSPECTOR_SWIPE_DISTANCE) return;
      if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;
      this._inspectorStep(deltaX < 0 ? 1 : -1);
    }, { passive: true });
    centre.addEventListener('pointercancel', () => { swipeStart = null; }, { passive: true });
    centre.appendChild(this.renderCard(card, { activeAttribute: opts.attribute, large: true }));"""
    text = require_replace(text, old, new, "ui.js inspector swipe")
    text = text.replace(
        "'← → kártyaváltás · Enter kijátszás · Esc bezárás'",
        "'Húzd oldalra vagy használd a ← → gombokat · Enter kijátszás · Esc bezárás'",
        1,
    )
    ui.write_text(text, encoding="utf-8")


# Mobil kategóriakarusszel, kompakt kijelölés és tördelhető nevek
css = ROOT / "css/mobile-experience.css"
text = css.read_text(encoding="utf-8")
marker = "/* ===== Main ág: mobil lapozás és teljes kártyanevek ===== */"
if marker not in text:
    block = r'''

/* ===== Main ág: mobil lapozás és teljes kártyanevek ===== */
#player-hand.hand--selection .card--choice.is-selected::before {
  content: none;
}

#player-hand.hand--selection .card--choice.is-selected::after {
  content: '✓ KIVÁLASZTVA';
  position: absolute;
  z-index: 9;
  top: 7px;
  left: 50%;
  width: max-content;
  height: auto;
  min-width: 0;
  max-width: calc(100% - 16px);
  padding: 4px 8px;
  border: 1px solid rgba(42, 28, 18, .48);
  border-radius: 999px;
  background: var(--brass-light);
  color: #2a1c12;
  font-size: 8px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: .08em;
  white-space: nowrap;
  box-shadow: 0 3px 9px rgba(0, 0, 0, .38);
  transform: translateX(-50%);
  pointer-events: none;
}

@media (max-width: 900px) {
  #attribute-picker:has(> .attr-btn--mobile) {
    display: grid;
    grid-template-columns: none;
    grid-auto-flow: column;
    grid-auto-columns: min(86%, 330px);
    align-items: stretch;
    width: 100%;
    max-width: none;
    gap: 12px;
    padding: 8px 14px 14px;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    scroll-padding-inline: 14px;
    scroll-snap-type: x mandatory;
    scrollbar-width: thin;
    scrollbar-color: rgba(201, 162, 39, .58) transparent;
    touch-action: pan-x;
  }

  #attribute-picker:has(> .attr-btn--mobile) .attr-btn--mobile {
    min-height: 132px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 10px;
    padding: 18px;
    border-radius: 16px;
    scroll-snap-align: center;
    scroll-snap-stop: always;
  }

  #attribute-picker:has(> .attr-btn--mobile) .attr-btn__label {
    font-size: clamp(17px, 5vw, 21px);
    line-height: 1.08;
  }

  #attribute-picker:has(> .attr-btn--mobile) .attr-btn__value {
    font-size: clamp(13px, 3.8vw, 16px);
  }

  #attribute-picker:has(> .attr-btn--mobile) .attr-btn__direction {
    padding: 5px 9px;
    font-size: 10px;
  }
}

@media (max-width: 620px) {
  #inspector {
    padding-inline: max(6px, env(safe-area-inset-left, 0px));
  }

  #inspector .inspector__shell {
    width: 100%;
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    align-items: center;
    gap: 4px;
  }

  #inspector .inspector__centre {
    width: 100%;
    min-width: 0;
    touch-action: pan-y;
  }

  #inspector .card--large {
    --card-w: min(300px, calc(100vw - 116px));
    width: var(--card-w);
    max-width: 100%;
  }

  #inspector .inspector__nav {
    width: 44px;
    min-width: 44px;
    max-width: 44px;
    justify-self: center;
  }

  #inspector .inspector__actions {
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(0, .9fr);
    gap: 8px;
  }
}

.card__name {
  display: block !important;
  min-height: 0;
  max-height: none !important;
  overflow: visible !important;
  white-space: normal !important;
  text-overflow: clip !important;
  overflow-wrap: anywhere;
  word-break: normal;
  hyphens: auto;
  -webkit-line-clamp: unset !important;
  line-clamp: unset !important;
}

.card__name--compact {
  font-size: 11px;
  letter-spacing: .2px;
  line-height: 1.02;
}

#player-hand.hand--selection .card--choice .card__name--compact {
  font-size: clamp(9.5px, 2.75vw, 11.5px);
}

#pub.is-card-selection #duel .card__name--compact {
  font-size: 7.5px;
}

#pub.is-battle-active #duel .card__name--compact {
  font-size: clamp(10px, 2.9vw, 17px);
}

#inspector .card--large .card__name--compact {
  font-size: clamp(19px, 5vw, 25px);
}
'''
    css.write_text(text + block, encoding="utf-8")


# PWA frissítés
sw = ROOT / "sw.js"
text = sw.read_text(encoding="utf-8")
text = text.replace("const PWA_CACHE = 'fociskartyak-2026-v43';", "const PWA_CACHE = 'fociskartyak-2026-v44';")
if "fociskartyak-2026-v43" not in text.splitlines()[0]:
    text = text.replace(
        "fociskartyak-2026-v41",
        "fociskartyak-2026-v41, fociskartyak-2026-v42, fociskartyak-2026-v43",
        1,
    )
sw.write_text(text, encoding="utf-8")
for test_file in (ROOT / "test").glob("*.mjs"):
    source = test_file.read_text(encoding="utf-8")
    if "fociskartyak-2026-v43" in source:
        test_file.write_text(source.replace("fociskartyak-2026-v43", "fociskartyak-2026-v44"), encoding="utf-8")


# Stabilizációs regressziós ellenőrzések
regression_test = ROOT / "test/stabilization.test.mjs"
text = regression_test.read_text(encoding="utf-8")
if "const uiSource = text('js/ui.js');" not in text:
    contract = r"""const uiSource = text('js/ui.js');
const mobileCssContract = text('css/mobile-experience.css');
const readmeSource = text('README.md');
assert.match(uiSource, /export function cardPlayerDisplayName/);
assert.match(uiSource, /INSPECTOR_SWIPE_DISTANCE\s*=\s*44/);
assert.match(uiSource, /pointerup/);
assert.match(uiSource, /el\('div', 'card__name', displayName\)/);
assert.match(mobileCssContract, /grid-auto-flow:\s*column/);
assert.match(mobileCssContract, /\.card__name--compact/);
assert.match(mobileCssContract, /text-overflow:\s*clip\s*!important/);
assert.match(readmeSource, /Legújabb önálló játék letöltése/);
assert.match(serviceWorker, /fociskartyak-2026-v44/);

"""
    insertion_markers = [
        "console.log('✓ A közvetlen játékosprofil, magyar feliratok és konszolidált fájllánc rendben');",
        "console.log('✓ A közvetlen profil, teljes kártyanevek, mobil lapozás és konszolidált fájllánc rendben');",
        "console.log('✓ A konszolidált kártyanézet, profil, offline mód és fázisváltás regressziós ellenőrzése rendben');",
    ]
    for insertion_marker in insertion_markers:
        if insertion_marker in text:
            text = text.replace(insertion_marker, contract + insertion_marker, 1)
            break
    else:
        text = text.rstrip() + "\n\n" + contract
    regression_test.write_text(text, encoding="utf-8")

print("A main fejlesztéseinek célzott portolása elkészült.")
