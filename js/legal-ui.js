/** Hungarian UI wording, independent-project notice and responsive category tiles. */
(() => {
  const NOTICE = 'A Fociskártyák 2026 független projekt. Nem áll hivatalos kapcsolatban a játékban megjelenített klubokkal, ligákkal vagy sportszövetségekkel.';
  const REPLACEMENTS = new Map([
    ['Penalties mód', 'Büntetőpárbaj'],
    ['Tizenegyes mód', 'Büntetőpárbaj'],
  ]);
  const STYLE_ID = 'category-tile-grid-styles';
  let selectedKey = null;
  let committing = false;

  const setAttr = (node, name, value) => {
    if (node && node.getAttribute(name) !== value) node.setAttribute(name, value);
  };
  const removeAttr = (node, name) => {
    if (node?.hasAttribute(name)) node.removeAttribute(name);
  };
  const setText = (node, value) => {
    if (node && node.textContent !== value) node.textContent = value;
  };
  const setDisabled = (node, value) => {
    if (node && node.disabled !== value) node.disabled = value;
  };
  const toggleClass = (node, name, value) => {
    if (node && node.classList.contains(name) !== value) node.classList.toggle(name, value);
  };

  function localiseText(root) {
    if (!(root instanceof Node)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const replacement = REPLACEMENTS.get(node.nodeValue?.trim());
      if (replacement) node.nodeValue = node.nodeValue.replace(node.nodeValue.trim(), replacement);
    }
  }

  function ensureTitleNotice(root = document) {
    const panel = root.matches?.('.mobile-home') ? root : root.querySelector?.('.mobile-home');
    if (!panel || panel.querySelector('.menu-independent-project-note')) return;
    const notice = document.createElement('p');
    notice.className = 'menu-independent-project-note';
    notice.textContent = NOTICE;
    panel.appendChild(notice);
  }

  function preserveInspectorBackdrop() {
    const inspector = document.querySelector('#inspector');
    const backdrop = document.querySelector('#inspector-stable-backdrop');
    if (inspector && backdrop && !backdrop.classList.contains('is-visible')) backdrop.classList.add('is-visible');
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#pub.is-category-selection #felt{justify-content:flex-start;align-items:stretch;overflow:hidden}
#pub.is-category-selection #prompt,#pub.is-category-selection .game-steps{align-self:center}
#pub.is-category-selection #attribute-picker{display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr) auto!important;width:min(100%,980px)!important;max-width:980px!important;min-width:0!important;min-height:0;max-height:min(58dvh,560px);flex:1 1 auto;gap:10px!important;padding:2px!important;overflow:hidden!important;align-self:center}
#attribute-picker>.category-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-content:start;gap:10px;width:100%;min-width:0;min-height:0;padding:2px 4px 10px;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:rgba(232,195,122,.72) rgba(0,0,0,.16);touch-action:pan-y}
#attribute-picker>.category-grid::-webkit-scrollbar{width:7px}
#attribute-picker>.category-grid::-webkit-scrollbar-thumb{border-radius:999px;background:rgba(232,195,122,.72)}
#attribute-picker>.category-grid .category-tile{position:relative;display:grid!important;grid-template-columns:minmax(0,1fr);grid-template-areas:'title' 'direction' 'value';align-content:center;gap:4px!important;width:100%!important;min-width:0!important;max-width:none!important;min-height:88px!important;margin:0!important;padding:11px 12px!important;border:2px solid rgba(201,162,39,.42)!important;border-radius:14px!important;background:linear-gradient(145deg,rgba(42,81,66,.96),rgba(20,48,39,.98))!important;color:var(--cream,#f2e6d0)!important;text-align:left!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 5px 14px rgba(0,0,0,.24);transform:none!important;transition:border-color .14s ease,background .14s ease,box-shadow .14s ease!important;white-space:normal!important;overflow:hidden;box-sizing:border-box;cursor:pointer;touch-action:manipulation;scroll-snap-align:none!important}
#attribute-picker>.category-grid .category-tile:hover{border-color:rgba(232,195,122,.86)!important;background:linear-gradient(145deg,rgba(49,96,77,.98),rgba(25,59,47,.98))!important;color:#fff7df!important;transform:none!important}
#attribute-picker>.category-grid .category-tile:focus-visible{outline:3px solid #fff3bd!important;outline-offset:3px!important;border-color:#e8c37a!important}
#attribute-picker>.category-grid .category-tile.is-selected{border-color:#f3d487!important;background:linear-gradient(145deg,rgba(74,112,88,.99),rgba(34,72,57,.99))!important;box-shadow:inset 0 0 0 1px rgba(255,247,223,.16),0 0 0 2px rgba(201,162,39,.18),0 8px 20px rgba(0,0,0,.34)!important}
#attribute-picker>.category-grid .category-tile:disabled{cursor:not-allowed;opacity:.58;filter:grayscale(.35)}
#attribute-picker>.category-grid .category-tile.is-selected:disabled{opacity:1;filter:none}
#attribute-picker>.category-grid .attr-btn__label{grid-area:title;display:-webkit-box!important;min-width:0;max-width:100%;overflow:hidden;color:inherit;font-size:clamp(14px,3.9vw,18px)!important;font-weight:850;line-height:1.2!important;letter-spacing:.01em;white-space:normal!important;overflow-wrap:normal!important;word-break:normal!important;hyphens:auto;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2}
#attribute-picker>.category-grid .attr-btn__direction{grid-area:direction;display:block!important;min-width:0;max-width:100%;padding:0!important;border:0!important;background:transparent!important;color:rgba(255,247,223,.78)!important;font-size:clamp(10px,2.7vw,12px)!important;font-weight:650;line-height:1.25;white-space:normal!important;overflow-wrap:normal!important;word-break:normal!important;hyphens:auto}
#attribute-picker>.category-grid .attr-btn__value{grid-area:value;display:block!important;min-width:0;max-width:100%;margin-top:2px;padding-right:34px;color:rgba(232,195,122,.86)!important;font-size:clamp(9px,2.35vw,11px)!important;font-weight:650;line-height:1.2;white-space:nowrap!important;overflow:hidden;text-overflow:ellipsis}
.category-tile__check{position:absolute;right:10px;bottom:10px;width:28px;height:28px;display:grid;place-items:center;border:2px solid rgba(232,195,122,.42);border-radius:50%;background:rgba(0,0,0,.22);color:transparent;font-size:17px;font-weight:950;line-height:1;transform:scale(.92);transition:color .14s ease,background .14s ease,border-color .14s ease,transform .14s ease;pointer-events:none}
.category-tile.is-selected .category-tile__check{border-color:#fff3bd;background:#e8c37a;color:#21150e;transform:scale(1)}
#attribute-picker>.category-picker__actions{position:sticky;bottom:0;z-index:4;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;min-width:0;padding:10px;border:1px solid rgba(201,162,39,.3);border-radius:13px;background:rgba(24,43,35,.97);box-shadow:0 -6px 20px rgba(0,0,0,.26);backdrop-filter:blur(7px)}
.category-picker__status{min-width:0;color:rgba(242,230,208,.76);font-size:clamp(10px,2.65vw,12px);font-weight:650;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.category-picker__next{min-width:44px;min-height:44px;padding:10px 15px;border:2px solid #e8c37a;border-radius:12px;background:#c9a227;color:#21150e;font:inherit;font-size:clamp(11px,2.8vw,13px);font-weight:900;line-height:1.15;cursor:pointer;transition:filter .14s ease,box-shadow .14s ease}
.category-picker__next:hover:not(:disabled){filter:brightness(1.1);box-shadow:0 5px 14px rgba(0,0,0,.32)}
.category-picker__next:focus-visible{outline:3px solid #fff3bd;outline-offset:3px}
.category-picker__next:disabled{border-color:rgba(160,141,114,.42);background:rgba(0,0,0,.3);color:rgba(242,230,208,.48);box-shadow:none;cursor:not-allowed}
@media(max-width:900px){#pub.is-category-selection #felt{min-height:280px;max-height:none;padding:8px!important}#pub.is-category-selection #attribute-picker{width:100%!important;max-height:min(57dvh,510px)}#attribute-picker>.category-grid{gap:10px;padding-inline:2px}}
@media(max-width:430px){#attribute-picker>.category-grid .attr-btn__label{font-size:clamp(12.5px,3.4vw,14px)!important;letter-spacing:0}#attribute-picker>.category-grid .category-tile{min-height:88px!important;padding:10px!important}#attribute-picker>.category-picker__actions{grid-template-columns:minmax(0,1fr);gap:7px;padding:8px}.category-picker__next{width:100%}}
@media(max-width:340px){#attribute-picker>.category-grid{grid-template-columns:minmax(0,1fr)}}
@media(min-width:768px){#attribute-picker>.category-grid{grid-template-columns:repeat(3,minmax(0,1fr))}#attribute-picker>.category-grid .attr-btn__label{font-size:16px!important}}
@media(min-width:1100px){#attribute-picker>.category-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(prefers-reduced-motion:reduce){#attribute-picker>.category-grid .category-tile,.category-tile__check,.category-picker__next{transition-duration:1ms!important}}
@media(forced-colors:active){#attribute-picker>.category-grid .category-tile,#attribute-picker>.category-grid .category-tile.is-selected,#attribute-picker>.category-picker__actions,.category-picker__next{border-color:ButtonText!important;background:Canvas!important;color:CanvasText!important;forced-color-adjust:auto}}
`;
    document.head.appendChild(style);
  }

  const tiles = picker => [...(picker?.querySelectorAll('.category-grid .attr-btn--mobile[data-attribute]') ?? [])];

  function directionText(key, raw = '') {
    if (key === 'birthDate') return 'Fiatalabb játékos nyer';
    if (key === 'birthDateOlder') return 'Idősebb játékos nyer';
    return /(kevesebb|alacsonyabb|kisebb)/i.test(raw) ? 'Alacsonyabb érték nyer' : 'Magasabb érték nyer';
  }

  function decorate(button, index) {
    const key = button.dataset.attribute || `category-${index}`;
    button.dataset.key = key;
    button.classList.add('category-tile');
    button.type = 'button';
    setAttr(button, 'aria-pressed', 'false');
    const direction = button.querySelector('.attr-btn__direction');
    if (direction) {
      setText(direction, directionText(key, direction.textContent));
      direction.id ||= `category-direction-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
      setAttr(button, 'aria-describedby', direction.id);
      const label = button.querySelector('.attr-btn__label')?.textContent?.trim() || 'Kategória';
      setAttr(button, 'aria-label', `${label}; ${direction.textContent}`);
    }
    if (!button.querySelector('.category-tile__check')) {
      const check = document.createElement('span');
      check.className = 'category-tile__check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = '✓';
      button.appendChild(check);
    }
  }

  function ensureActions(picker) {
    if (picker.querySelector(':scope>.category-picker__actions')) return;
    const actions = document.createElement('div');
    actions.className = 'category-picker__actions';
    const status = document.createElement('span');
    status.className = 'category-picker__status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.textContent = 'Válassz egy kategóriát a folytatáshoz.';
    const next = document.createElement('button');
    next.className = 'category-picker__next';
    next.type = 'button';
    next.disabled = true;
    next.setAttribute('aria-disabled', 'true');
    next.textContent = 'Tovább a 2. Kártya fázisra';
    actions.append(status, next);
    picker.appendChild(actions);
  }

  function select(picker, selected, focus = false) {
    if (!picker || !selected || committing) return;
    selectedKey = selected.dataset.attribute || null;
    picker.dataset.selectedAttribute = selectedKey ?? '';
    for (const button of tiles(picker)) {
      const active = button === selected;
      toggleClass(button, 'is-selected', active);
      setAttr(button, 'aria-pressed', String(active));
    }
    const next = picker.querySelector('.category-picker__next');
    setDisabled(next, !selectedKey);
    setAttr(next, 'aria-disabled', String(!selectedKey));
    const label = selected.querySelector('.attr-btn__label')?.textContent?.trim() || 'Kategória';
    setText(picker.querySelector('.category-picker__status'), `Kiválasztva: ${label}`);
    if (focus) selected.focus({ preventScroll: true });
  }

  function commit(picker) {
    if (!picker || committing) return;
    const selected = picker.querySelector('.category-tile.is-selected[data-attribute]');
    if (!selected || selected.disabled) return;
    committing = true;
    setAttr(picker, 'aria-busy', 'true');
    const next = picker.querySelector('.category-picker__next');
    setDisabled(next, true);
    setAttr(next, 'aria-disabled', 'true');
    setText(next, 'Továbblépés…');
    setText(picker.querySelector('.category-picker__status'), 'Kategória rögzítve. Kártyaválasztás következik.');
    for (const button of tiles(picker)) if (button !== selected) setDisabled(button, true);
    selected.dataset.categoryCommit = 'true';
    selected.click();
  }

  function enhancePicker() {
    const picker = document.querySelector('#attribute-picker');
    const pub = document.querySelector('#pub');
    if (!picker || !pub) return;
    const verdict = document.querySelector('#verdict');
    if (verdict?.matches('.win,.lose,.tie') && verdict.textContent.trim()) {
      selectedKey = null;
      committing = false;
    }
    let grid = picker.querySelector(':scope>.category-grid');
    const direct = [...picker.querySelectorAll(':scope>.attr-btn--mobile[data-attribute]')];
    if (direct.length) {
      committing = false;
      if (!grid) {
        grid = document.createElement('div');
        grid.className = 'category-grid';
        grid.setAttribute('role', 'group');
        grid.setAttribute('aria-label', 'Választható összehasonlítási kategóriák');
        picker.prepend(grid);
      }
      direct.forEach((button, index) => {
        decorate(button, index);
        grid.appendChild(button);
      });
      ensureActions(picker);
    }
    const currentTiles = tiles(picker);
    const active = Boolean(grid && currentTiles.length);
    toggleClass(pub, 'is-category-selection', active);
    if (!active) {
      removeAttr(picker, 'aria-busy');
      return;
    }
    ensureStyles();
    setAttr(picker, 'aria-label', 'Összehasonlítási kategória kiválasztása');
    if (committing) return;
    removeAttr(picker, 'aria-busy');
    const remembered = selectedKey && currentTiles.find(button => button.dataset.attribute === selectedKey);
    if (remembered) select(picker, remembered);
    else {
      delete picker.dataset.selectedAttribute;
      for (const button of currentTiles) {
        toggleClass(button, 'is-selected', false);
        setAttr(button, 'aria-pressed', 'false');
      }
      const next = picker.querySelector('.category-picker__next');
      setDisabled(next, true);
      setAttr(next, 'aria-disabled', 'true');
      setText(next, 'Tovább a 2. Kártya fázisra');
      setText(picker.querySelector('.category-picker__status'), 'Válassz egy kategóriát a folytatáshoz.');
    }
  }

  function onPickerClick(event) {
    const picker = event.currentTarget;
    const next = event.target.closest('.category-picker__next');
    if (next && picker.contains(next)) {
      event.preventDefault();
      event.stopPropagation();
      commit(picker);
      return;
    }
    const button = event.target.closest('.category-grid .attr-btn--mobile[data-attribute]');
    if (!button || !picker.contains(button)) return;
    if (button.dataset.categoryCommit === 'true') {
      delete button.dataset.categoryCommit;
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (!button.disabled) select(picker, button);
  }

  function onPickerKeydown(event) {
    const picker = event.currentTarget;
    const current = event.target.closest('.category-grid .attr-btn--mobile[data-attribute]');
    if (!current || !picker.contains(current)) return;
    const available = tiles(picker).filter(button => !button.disabled);
    const index = available.indexOf(current);
    if (index < 0) return;
    let target = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target = (index + 1) % available.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target = (index - 1 + available.length) % available.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = available.length - 1;
    if (target == null) return;
    event.preventDefault();
    select(picker, available[target], true);
  }

  function enhance(root = document) {
    localiseText(root);
    ensureTitleNotice(root);
    preserveInspectorBackdrop();
    enhancePicker();
  }

  function start() {
    ensureStyles();
    const picker = document.querySelector('#attribute-picker');
    picker?.addEventListener('click', onPickerClick, true);
    picker?.addEventListener('keydown', onPickerKeydown);
    enhance(document);
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (node instanceof Element) enhance(node);
          else if (node instanceof Text) localiseText(node.parentNode);
        });
      }
      preserveInspectorBackdrop();
      enhancePicker();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
