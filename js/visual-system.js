(() => {
  const STORAGE_KEY = 'fociskartyak.visual-settings.v1';
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const DEFAULTS = Object.freeze({
    selectionCardWidth: 210,
    battleCardWidth: 330,
    cardGap: 18,
    battlefieldHeight: 440,
    animations: true,
    backgroundEffects: 72,
    textScale: 100,
    reducedMotion: prefersReducedMotion,
    highContrast: false,
  });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));

  function loadSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { ...DEFAULTS, ...parsed };
    } catch {
      return { ...DEFAULTS };
    }
  }

  let settings = loadSettings();

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage can be unavailable in private or embedded contexts; play still works.
    }
  }

  function applySettings() {
    const root = document.documentElement;
    const selection = clamp(settings.selectionCardWidth, 150, 280);
    const battle = clamp(settings.battleCardWidth, 220, 420);
    const gap = clamp(settings.cardGap, 6, 36);
    const field = clamp(settings.battlefieldHeight, 320, 680);
    const background = clamp(settings.backgroundEffects, 0, 100);
    const textScale = clamp(settings.textScale, 85, 135);
    const motionOff = !settings.animations || settings.reducedMotion;

    root.style.setProperty('--selection-card-width', `${selection}px`);
    root.style.setProperty('--mobile-selection-card-width', `${Math.round(clamp(selection * .66, 116, 170))}px`);
    root.style.setProperty('--battle-card-target', `${battle}px`);
    root.style.setProperty('--card-gap', `${gap}px`);
    root.style.setProperty('--battlefield-height', `${field}px`);
    root.style.setProperty('--background-effect-opacity', String(background / 100));
    root.style.setProperty('--ui-text-scale', String(textScale / 100));
    root.style.setProperty('--animation-speed', motionOff ? '1ms' : '260ms');
    root.classList.toggle('reduced-motion', motionOff);
    root.classList.toggle('high-contrast', Boolean(settings.highContrast));
  }

  function setSetting(key, value) {
    settings = { ...settings, [key]: value };
    applySettings();
    saveSettings();
  }

  function createElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function rangeControl({ key, label, min, max, step = 1, unit = '' }) {
    const wrapper = createElement('div', 'appearance-control');
    const heading = createElement('label');
    const labelText = createElement('span', null, label);
    const output = createElement('output');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(settings[key]);
    input.id = `appearance-${key}`;
    heading.htmlFor = input.id;
    heading.append(labelText, document.createTextNode(' '), output);

    const refresh = () => { output.value = `${input.value}${unit}`; };
    refresh();
    input.addEventListener('input', () => {
      setSetting(key, Number(input.value));
      refresh();
    });
    wrapper.append(heading, input);
    return wrapper;
  }

  function toggleControl({ key, label }) {
    const wrapper = createElement('div', 'appearance-control');
    const labelNode = createElement('label', 'appearance-toggle');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = Boolean(settings[key]);
    input.addEventListener('change', () => setSetting(key, input.checked));
    labelNode.append(input, createElement('span', null, label));
    wrapper.appendChild(labelNode);
    return wrapper;
  }

  function openDialog(dialog) {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen?.();
    } catch {
      // Fullscreen can be denied by the platform; this is not a game error.
    }
  }

  function createAppearanceDialog() {
    const dialog = createElement('dialog', 'appearance-dialog');
    dialog.id = 'appearance-dialog';
    dialog.setAttribute('aria-labelledby', 'appearance-title');

    const header = createElement('div', 'appearance-dialog__header');
    const title = createElement('h2', null, 'Megjelenés');
    title.id = 'appearance-title';
    const close = createElement('button', 'appearance-dialog__close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Megjelenési beállítások bezárása');
    close.addEventListener('click', () => closeDialog(dialog));
    header.append(title, close);

    const body = createElement('div', 'appearance-dialog__body');
    body.append(
      rangeControl({ key: 'selectionCardWidth', label: 'Választási kártyaméret', min: 150, max: 280, step: 5, unit: ' px' }),
      rangeControl({ key: 'battleCardWidth', label: 'Csatakártya-méret', min: 220, max: 420, step: 5, unit: ' px' }),
      rangeControl({ key: 'cardGap', label: 'Kártyák közötti távolság', min: 6, max: 36, step: 2, unit: ' px' }),
      rangeControl({ key: 'battlefieldHeight', label: 'Küzdőtér célmagassága', min: 320, max: 680, step: 10, unit: ' px' }),
      rangeControl({ key: 'backgroundEffects', label: 'Háttéreffektek erőssége', min: 0, max: 100, step: 5, unit: '%' }),
      rangeControl({ key: 'textScale', label: 'Feliratok mérete', min: 85, max: 135, step: 5, unit: '%' }),
      toggleControl({ key: 'animations', label: 'Animációk engedélyezése' }),
      toggleControl({ key: 'reducedMotion', label: 'Csökkentett mozgás' }),
      toggleControl({ key: 'highContrast', label: 'Nagy kontrasztú mód' }),
    );

    const actions = createElement('div', 'appearance-actions');
    const fullscreen = createElement('button', null, 'Teljes képernyő');
    fullscreen.type = 'button';
    fullscreen.addEventListener('click', toggleFullscreen);
    const reset = createElement('button', null, 'Alapértékek');
    reset.type = 'button';
    reset.addEventListener('click', () => {
      settings = { ...DEFAULTS };
      applySettings();
      saveSettings();
      dialog.remove();
      const replacement = createAppearanceDialog();
      document.body.appendChild(replacement);
      openDialog(replacement);
    });
    const done = createElement('button', 'primary', 'Kész');
    done.type = 'button';
    done.addEventListener('click', () => closeDialog(dialog));
    actions.append(fullscreen, reset, done);
    body.appendChild(actions);

    dialog.append(header, body);
    dialog.addEventListener('click', event => {
      if (event.target === dialog) closeDialog(dialog);
    });
    return dialog;
  }

  function ensureAppearanceButton() {
    const host = document.querySelector('#hud-settings');
    if (!host || host.querySelector('[data-appearance-button]')) return;
    const button = createElement('button', 'icon-toggle', '🎨 Megjelenés');
    button.type = 'button';
    button.dataset.appearanceButton = 'true';
    button.setAttribute('aria-haspopup', 'dialog');
    button.addEventListener('click', () => {
      let dialog = document.querySelector('#appearance-dialog');
      if (!dialog) {
        dialog = createAppearanceDialog();
        document.body.appendChild(dialog);
      }
      openDialog(dialog);
    });
    host.appendChild(button);
  }

  const COUNTRY_CODES = Object.freeze({
    magyarország: 'HU', hungary: 'HU',
    ausztria: 'AT', austria: 'AT',
    belgium: 'BE',
    bosznia: 'BA', 'bosnia and herzegovina': 'BA',
    brazil: 'BR', brazília: 'BR',
    bulgária: 'BG', bulgaria: 'BG',
    ciprus: 'CY', cyprus: 'CY',
    csehország: 'CZ', czechia: 'CZ',
    dánia: 'DK', denmark: 'DK',
    egyiptom: 'EG', egypt: 'EG',
    anglia: 'GB', england: 'GB', skócia: 'GB', scotland: 'GB', wales: 'GB',
    finland: 'FI', finnország: 'FI',
    franciaország: 'FR', france: 'FR',
    grúzia: 'GE', georgia: 'GE',
    ghána: 'GH', ghana: 'GH',
    görögország: 'GR', greece: 'GR',
    hollandia: 'NL', netherlands: 'NL',
    horvátország: 'HR', croatia: 'HR',
    ír: 'IE', ireland: 'IE',
    izrael: 'IL', israel: 'IL',
    japán: 'JP', japan: 'JP',
    kamerun: 'CM', cameroon: 'CM',
    kanada: 'CA', canada: 'CA',
    kolumbia: 'CO', colombia: 'CO',
    koszovó: 'XK', kosovo: 'XK',
    lengyelország: 'PL', poland: 'PL',
    mali: 'ML',
    marokkó: 'MA', morocco: 'MA',
    montenegró: 'ME', montenegro: 'ME',
    németország: 'DE', germany: 'DE',
    nigéria: 'NG', nigeria: 'NG',
    norvégia: 'NO', norway: 'NO',
    olaszország: 'IT', italy: 'IT',
    portugália: 'PT', portugal: 'PT',
    románia: 'RO', romania: 'RO',
    spanyolország: 'ES', spain: 'ES',
    svájc: 'CH', switzerland: 'CH',
    svédország: 'SE', sweden: 'SE',
    szerbia: 'RS', serbia: 'RS',
    szlovákia: 'SK', slovakia: 'SK',
    szlovénia: 'SI', slovenia: 'SI',
    törökország: 'TR', turkey: 'TR', türkiye: 'TR',
    ukrajna: 'UA', ukraine: 'UA',
    uruguay: 'UY',
  });

  function flagEmoji(country) {
    const code = COUNTRY_CODES[String(country || '').trim().toLocaleLowerCase('hu-HU')];
    if (!code || code.length !== 2) return '';
    return [...code].map(char => String.fromCodePoint(127397 + char.charCodeAt(0))).join('');
  }

  function enhanceCard(card) {
    if (!(card instanceof HTMLElement) || card.dataset.visualEnhanced === 'true') return;
    card.dataset.visualEnhanced = 'true';
    const name = card.querySelector('.card__name')?.textContent?.trim() || 'Játékoskártya';
    const clubNode = card.querySelector('.card__club');
    const clubText = clubNode?.textContent?.trim() || '';
    const portrait = card.querySelector('.card__portrait');

    card.setAttribute('aria-label', [name, clubText].filter(Boolean).join(', '));
    if (portrait) {
      portrait.setAttribute('role', 'img');
      portrait.setAttribute('aria-label', `${name} semleges játékosillusztrációja`);
    }

    if (clubNode && !clubNode.querySelector('.card__nation-flag')) {
      const parts = clubText.split('·').map(part => part.trim()).filter(Boolean);
      const nation = parts.length > 1 ? parts.at(-1) : '';
      const club = parts.length > 1 ? parts.slice(0, -1).join(' · ') : clubText;
      const flag = flagEmoji(nation);
      if (flag) {
        clubNode.replaceChildren(document.createTextNode(club));
        const flagNode = createElement('span', 'card__nation-flag', flag);
        flagNode.setAttribute('aria-hidden', 'true');
        const nationName = createElement('span', 'card__nation-name', nation);
        clubNode.append(flagNode, nationName);
      }
    }

    if (card.classList.contains('selectable') || card.classList.contains('card--choice')) {
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        card.click();
      });
    }
  }

  function enhanceInterface(root = document) {
    root.querySelectorAll?.('.card').forEach(enhanceCard);
    const verdict = document.querySelector('#verdict');
    if (verdict) {
      verdict.setAttribute('role', 'status');
      verdict.setAttribute('aria-live', 'polite');
    }
    const prompt = document.querySelector('#prompt');
    if (prompt) prompt.setAttribute('aria-live', 'polite');
  }

  function ensureIndependentNotice() {
    const host = document.querySelector('#banter');
    if (!host || host.querySelector('.independent-project-note')) return;
    const notice = createElement(
      'p',
      'independent-project-note',
      'A Fociskártyák 2026 független projekt. Nem áll hivatalos kapcsolatban a játékban megjelenített klubokkal, ligákkal vagy sportszövetségekkel.',
    );
    host.appendChild(notice);
  }

  let effectTimer = null;
  let lastEffectSignature = '';

  function pulseBodyClass(className, duration) {
    document.body.classList.remove('effect-goal', 'effect-foul');
    window.clearTimeout(effectTimer);
    // Force a fresh animation when consecutive rounds have the same event.
    void document.body.offsetWidth;
    document.body.classList.add(className);
    effectTimer = window.setTimeout(() => document.body.classList.remove(className), duration);
  }

  function updateResultEffects() {
    if (settings.reducedMotion || !settings.animations) return;
    const pub = document.querySelector('#pub');
    const verdict = document.querySelector('#verdict');
    const signature = `${verdict?.className || ''}:${verdict?.textContent || ''}`;
    if (!signature || signature === lastEffectSignature) return;
    lastEffectSignature = signature;

    if (pub?.classList.contains('mode-penalties') && verdict?.classList.contains('win')) {
      pulseBodyClass('effect-goal', 520);
      return;
    }
    const activeLabel = document.querySelector('#duel .stat.active .stat__label')?.textContent?.toLocaleLowerCase('hu-HU') || '';
    if (activeLabel.includes('piros') || activeLabel.includes('kiállítás')) {
      pulseBodyClass('effect-foul', 380);
    }
  }

  function initialiseVisualSystem() {
    applySettings();
    ensureAppearanceButton();
    ensureIndependentNotice();
    enhanceInterface();

    const observer = new MutationObserver(mutations => {
      ensureAppearanceButton();
      ensureIndependentNotice();
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          if (node.matches('.card')) enhanceCard(node);
          node.querySelectorAll?.('.card').forEach(enhanceCard);
        });
        if (mutation.target instanceof Element
          && (mutation.target.id === 'verdict' || mutation.target.id === 'duel')) updateResultEffects();
      }
      enhanceInterface();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    document.documentElement.dataset.visualSystem = 'ready';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialiseVisualSystem, { once: true });
  } else {
    initialiseVisualSystem();
  }
})();
