/** DOM rendering shared by Classic and Penalties modes. */

import {
  ATTRIBUTES, ATTRIBUTE_BY_KEY, CARD_ATTRIBUTE_KEYS, formatAttribute, hasAttributeData,
} from './data/players.js';
import { HUMAN, AI } from './engine.js';
import { DEFAULT_PLAYER_NAME, loadPlayerName, normalizePlayerName } from './player-profile.js';

const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const withExtensions = base => EXTENSIONS.map(extension => `${base}.${extension}`);

export const ART = {
  portrait: id => withExtensions(`assets/portraits/${id}`),
  cardBack: () => withExtensions('assets/cards/back'),
  friend: id => withExtensions(`assets/friends/${id}`),
  pub: () => withExtensions('assets/pub/background'),
};

export const $ = selector => document.querySelector(selector);
export const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

function tryArt(node, candidates, loadedClass = 'has-art', overlay = null) {
  const urls = Array.isArray(candidates) ? candidates : [candidates];
  const attempt = index => {
    if (index >= urls.length) return;
    const probe = new Image();
    probe.onload = () => {
      node.style.backgroundImage = overlay ? `${overlay}, url("${urls[index]}")` : `url("${urls[index]}")`;
      node.classList.add(loadedClass);
    };
    probe.onerror = () => attempt(index + 1);
    probe.src = urls[index];
  };
  attempt(0);
}

const PUB_SCRIM = 'linear-gradient(rgba(18,11,5,.36), rgba(18,11,5,.64))';
const initials = name => name.split(' ').filter(Boolean).map(word => word[0]).join('').slice(0, 2).toUpperCase();
const finiteDetail = value => typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
const focusableElements = root => [...(root?.querySelectorAll?.(
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
) ?? [])].filter(node => !node.hidden && node.getAttribute('aria-hidden') !== 'true');

export class UI {
  constructor(handlers, settings = {}) {
    this.handlers = handlers;
    this.settings = { sounds: true, commentary: true, ...settings };
    this.mode = 'classic';
    this.playerName = loadPlayerName();
    this.interactionBusy = false;
    this.dom = {
      pub: $('#pub'), hudScores: $('#hud-scores'), hudMeta: $('#hud-meta'), hudSettings: $('#hud-settings'),
      opponentHand: $('#opponent-hand'), opponentPile: $('#opponent-pile'), playerHand: $('#player-hand'),
      playerPile: $('#player-pile'), prompt: $('#prompt'), picker: $('#attribute-picker'), duel: $('#duel'),
      verdict: $('#verdict'), pot: $('#pot-indicator'), feed: $('#banter-feed'), penaltyBoard: $('#penalty-board'),
      suddenDeath: $('#sudden-death-banner'), overlay: $('#overlay'), overlayBody: $('#overlay-body'),
    };
    tryArt(this.dom.pub, ART.pub(), 'has-art', PUB_SCRIM);
    this._renderSettings();
  }

  setMode(mode) {
    this.mode = mode;
    this.dom.pub.classList.toggle('mode-penalties', mode === 'penalties');
    this.dom.penaltyBoard.hidden = mode !== 'penalties';
    this.dom.suddenDeath.hidden = true;
  }

  setSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    this._renderSettings();
  }

  setPlayerName(value) {
    this.playerName = normalizePlayerName(value) || DEFAULT_PLAYER_NAME;
    for (const node of document.querySelectorAll('[data-player-name]')) {
      const upper = node.dataset.playerName === 'upper';
      node.textContent = upper ? this.playerName.toLocaleUpperCase('hu-HU') : this.playerName;
      node.title = this.playerName;
      node.setAttribute('aria-label', this.playerName);
    }
  }

  setInteractionBusy(busy) {
    this.interactionBusy = Boolean(busy);
    this.dom.pub.classList.toggle('is-processing', this.interactionBusy);
    for (const node of this.dom.pub.querySelectorAll('#attribute-picker button, #player-hand .card--direct-play, #inspector button')) {
      if ('disabled' in node) node.disabled = this.interactionBusy;
      node.setAttribute('aria-disabled', String(this.interactionBusy));
    }
  }

  showToast(message, tone = 'info', duration = 2200) {
    document.querySelector('#ux-toast')?.remove();
    const toast = el('div', `ux-toast ux-toast--${tone}`, message);
    toast.id = 'ux-toast';
    toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    window.setTimeout(() => {
      toast.classList.remove('is-visible');
      window.setTimeout(() => toast.remove(), 220);
    }, duration);
  }

  vibrate(pattern) {
    if (!this.settings.vibration || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(pattern);
  }

  setPhaseState(phase) {
    const selection = phase === 'selection';
    const battle = phase === 'battle';
    this.dom.pub.classList.toggle('is-card-selection', selection);
    this.dom.pub.classList.toggle('is-battle-active', battle);
    this.dom.pub.classList.toggle('is-duel-focus', battle);
    this.dom.playerHand.classList.toggle('hand--selection', selection);
    if (!selection) this.dom.playerHand.querySelectorAll('.is-selected').forEach(card => card.classList.remove('is-selected'));
    if (!battle) this.dom.pub.classList.remove('is-battle-transition');
  }

  beginBattleTransition(cardId) {
    const card = [...this.dom.playerHand.querySelectorAll('.card')].find(node => node.dataset.cardId === cardId);
    for (const choice of this.dom.playerHand.querySelectorAll('.card--choice')) {
      const selected = choice === card;
      choice.classList.toggle('is-selected', selected);
      choice.setAttribute('aria-pressed', String(selected));
    }
    const reducedMotion = document.documentElement.classList.contains('ux-reduced-motion')
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!this.settings.animations || reducedMotion) return 0;
    this.dom.pub.classList.add('is-battle-transition');
    return 250;
  }

  finishBattleTransition() {
    this.dom.pub.classList.remove('is-battle-transition', 'is-card-selection');
    this.dom.playerHand.classList.remove('hand--selection');
    this.dom.pub.classList.add('is-battle-active', 'is-duel-focus');
  }

  recoverInteraction() {
    this.setInteractionBusy(false);
    this.dom.pub.classList.remove('is-battle-transition');
    this.closeInspector();
  }

  _renderSettings() {
    this.dom.hudSettings.replaceChildren();
    const sound = el('button', 'icon-toggle', this.settings.sounds ? '🔊 Hang' : '🔇 Hang');
    sound.type = 'button';
    sound.setAttribute('aria-pressed', String(this.settings.sounds));
    sound.addEventListener('click', () => this.handlers.onToggleSounds?.());
    const comments = el('button', 'icon-toggle', this.settings.commentary ? '💬 Kommentár' : '🚫 Kommentár');
    comments.type = 'button';
    comments.setAttribute('aria-pressed', String(this.settings.commentary));
    comments.addEventListener('click', () => this.handlers.onToggleCommentary?.());
    this.dom.hudSettings.append(sound, comments);
  }

  resetTable() {
    this.closeInspector();
    this.setPhaseState('idle');
    this.setInteractionBusy(false);
    for (const node of [this.dom.opponentHand, this.dom.playerHand, this.dom.duel, this.dom.verdict,
      this.dom.picker, this.dom.feed, this.dom.penaltyBoard]) node.replaceChildren();
    this.dom.prompt.textContent = '';
    this.dom.pot.textContent = '';
    this.dom.suddenDeath.hidden = true;
  }

  _cardRows(card, activeAttributeKey) {
    const rows = CARD_ATTRIBUTE_KEYS
      .map(key => ATTRIBUTE_BY_KEY[key])
      .filter(attribute => attribute && hasAttributeData(card, attribute.key));

    if (!activeAttributeKey) return rows;
    const active = ATTRIBUTE_BY_KEY[activeAttributeKey];
    if (!active || !hasAttributeData(card, activeAttributeKey)) return rows;
    const existingIndex = rows.findIndex(attribute => attribute.key === active.cardStatKey);
    if (existingIndex >= 0) {
      rows[existingIndex] = active;
      return rows;
    }
    return [active, ...rows];
  }

  renderCard(card, opts = {}) {
    if (opts.faceDown) {
      const back = el('div', 'card card--back');
      tryArt(back, ART.cardBack());
      return back;
    }

    const node = el('article', 'card');
    node.dataset.cardId = card.id;
    const portrait = el('div', 'card__portrait');
    portrait.dataset.initials = initials(card.name);
    tryArt(portrait, [...ART.portrait(card.id), ...(card.meta?.imageUrl ? [card.meta.imageUrl] : [])]);
    if (card.position) portrait.appendChild(el('span', 'card__position', card.position));
    node.appendChild(portrait);
    node.appendChild(el('div', 'card__name', card.name));
    node.appendChild(el('div', 'card__club', [card.club, card.nation].filter(Boolean).join(' · ')));

    const stats = el('div', 'card__stats');
    for (const attribute of this._cardRows(card, opts.activeAttribute)) {
      const active = attribute.key === opts.activeAttribute;
      const row = el('div', `stat${active ? ' active' : ''}`);
      row.appendChild(el('span', 'stat__label', `${attribute.icon} ${attribute.cardLabel ?? attribute.shortLabel ?? attribute.label}`));
      row.appendChild(el('span', 'stat__value', formatAttribute(card, attribute.key)));
      stats.appendChild(row);
    }
    if (stats.childElementCount) node.appendChild(stats);

    if (opts.onClick) {
      node.classList.add('selectable');
      node.addEventListener('click', () => opts.onClick(card));
    }
    if (opts.dimmed) node.classList.add('card--dim');
    if (opts.unavailable) {
      node.classList.add('card--unavailable');
      node.title = 'Ez a kártya nem használható a kiválasztott kategóriában.';
    }
    if (opts.large) node.classList.add('card--large');
    return node;
  }

  openInspector(hand, index, opts = {}) {
    const active = document.activeElement;
    this._inspectorReturnFocus = active instanceof HTMLElement && active !== document.body ? active : null;
    this.inspector = { hand, index, opts };
    this._renderInspector();
  }

  closeInspector() {
    const returnFocus = this._inspectorReturnFocus;
    this._inspectorReturnFocus = null;
    this.inspector = null;
    $('#inspector')?.remove();
    if (this._inspectorKeys) document.removeEventListener('keydown', this._inspectorKeys);
    this._inspectorKeys = null;
    queueMicrotask(() => {
      if (returnFocus?.isConnected && typeof returnFocus.focus === 'function') returnFocus.focus({ preventScroll: true });
    });
  }

  _inspectorStep(delta) {
    if (!this.inspector) return;
    this.inspector.index = (this.inspector.index + delta + this.inspector.hand.length) % this.inspector.hand.length;
    this._renderInspector();
  }

  _renderInspector() {
    if (!this.inspector) return;
    if (this._inspectorKeys) document.removeEventListener('keydown', this._inspectorKeys);
    this._inspectorKeys = null;

    const { hand, index, opts } = this.inspector;
    const card = hand[index];
    const canPlay = opts.playable && (!opts.attribute || hasAttributeData(card, opts.attribute));
    $('#inspector')?.remove();

    const layer = el('div');
    layer.id = 'inspector';
    layer.addEventListener('click', event => { if (event.target === layer) this.closeInspector(); });
    const shell = el('div', 'inspector__shell');
    shell.setAttribute('role', 'dialog');
    shell.setAttribute('aria-modal', 'true');
    shell.setAttribute('aria-label', 'Játékoskártya részletei');
    const previous = el('button', 'inspector__nav', '‹');
    previous.type = 'button';
    previous.title = 'Előző kártya';
    previous.setAttribute('aria-label', 'Előző kártya');
    previous.addEventListener('click', () => this._inspectorStep(-1));
    const next = el('button', 'inspector__nav', '›');
    next.type = 'button';
    next.title = 'Következő kártya';
    next.setAttribute('aria-label', 'Következő kártya');
    next.addEventListener('click', () => this._inspectorStep(1));

    const centre = el('div', 'inspector__centre');
    centre.appendChild(this.renderCard(card, { activeAttribute: opts.attribute, large: true }));
    centre.appendChild(el('div', 'inspector__counter', `${index + 1}/${hand.length} kártya`));

    const detailLines = [
      ['🟥 Egyenes piros / MLSZ piros', finiteDetail(card.stats.redCards)],
      ['🟨🟥 Második sárga miatti kiállítás', finiteDetail(card.stats.secondYellowRedCards)],
    ].filter(([, value]) => value != null);
    if (detailLines.length) {
      const details = el('div', 'inspector__details');
      details.append(...detailLines.map(([label, value]) => el('span', null, `${label}: ${value}`)));
      centre.appendChild(details);
    }

    const actions = el('div', 'inspector__actions');
    if (opts.playable) {
      const play = el('button', 'btn', canPlay ? 'Kijátszom ezt a lapot' : 'Ez a lap nem használható');
      play.type = 'button';
      play.disabled = !canPlay;
      play.addEventListener('click', () => {
        if (!canPlay || this.interactionBusy || !this.inspector) return;
        const chosen = hand[this.inspector.index];
        this.closeInspector();
        opts.onPlay(chosen);
      });
      actions.appendChild(play);
    }
    const close = el('button', 'btn btn--ghost', opts.playable ? 'Vissza' : 'Bezárás');
    close.type = 'button';
    close.addEventListener('click', () => this.closeInspector());
    actions.appendChild(close);
    centre.appendChild(actions);
    centre.appendChild(el('div', 'inspector__hint', '← → kártyaváltás · Enter kijátszás · Esc bezárás'));
    shell.append(previous, centre, next);
    layer.appendChild(shell);
    document.body.appendChild(layer);

    this._inspectorKeys = event => {
      if (!this.inspector) return;
      if (event.key === 'Tab') {
        const focusable = focusableElements(layer);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        return;
      }
      if (event.key === 'Escape') { event.preventDefault(); this.closeInspector(); return; }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        this._inspectorStep(event.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      if (event.key !== 'Enter' || event.target.closest?.('button, a, input, select, textarea, [role="button"]')) return;
      const current = this.inspector.hand[this.inspector.index];
      const playable = this.inspector.opts.playable
        && (!this.inspector.opts.attribute || hasAttributeData(current, this.inspector.opts.attribute));
      if (!playable || this.interactionBusy) return;
      event.preventDefault();
      const onPlay = this.inspector.opts.onPlay;
      this.closeInspector();
      onPlay(current);
    };
    document.addEventListener('keydown', this._inspectorKeys);
    const preferred = actions.querySelector('.btn:not(:disabled)') ?? previous;
    preferred.focus({ preventScroll: true });
  }

  renderHands(game, { selectable = false, inspectAttribute = null } = {}) {
    this.dom.opponentHand.replaceChildren(...game.hands[AI].map(() => this.renderCard(null, { faceDown: true })));
    const hand = game.hands[HUMAN];
    const attribute = game.attribute ?? inspectAttribute;
    this.dom.playerHand.replaceChildren(...hand.map((card, index) => {
      const unavailable = Boolean(attribute) && !hasAttributeData(card, attribute);
      return this.renderCard(card, {
        activeAttribute: attribute,
        dimmed: !selectable || unavailable,
        unavailable,
        onClick: () => this.openInspector(hand, index, {
          attribute, playable: selectable, onPlay: chosen => this.handlers.onCard(chosen),
        }),
      });
    }));
  }

  renderScores(game) {
    if (game.mode === 'penalties') this._renderPenaltyScores(game);
    else this._renderClassicScores(game);
  }

  _renderClassicScores(game) {
    const { [HUMAN]: human, [AI]: ai } = game.scores;
    this.dom.hudScores.replaceChildren(this._scoreChip(this.playerName, human, human > ai), this._scoreChip('Gép', ai, ai > human));
    this.dom.hudMeta.textContent = `${game.round}. kör · ${game.deck.length} lap a pakliban`;
    this._renderPiles(human, ai);
    this.dom.pot.textContent = game.pot.length ? `🃏 ${game.pot.length} lap a döntetlenpakliban` : '';
  }

  _renderPenaltyScores(game) {
    const human = game.scores[HUMAN];
    const ai = game.scores[AI];
    this.dom.hudScores.replaceChildren(el('div', 'penalty-score', `${this.playerName.toLocaleUpperCase('hu-HU')} ${human}–${ai} GÉP`));
    this.dom.hudMeta.textContent = game.suddenDeath
      ? `Hirtelen halál · ${game.log.length} lejátszott párbaj`
      : `Rendes párbajok: ${game.regularPlayed}/5 · hátra ${game.regularRemaining}`;
    this._renderPiles(game.used[HUMAN].length, game.used[AI].length);
    this.dom.pot.textContent = game.cycle > 1 ? `🔀 ${game.cycle}. kör a változatlan tizeneggyel` : '';

    const row = side => {
      const wrapper = el('div', 'attempt-row');
      wrapper.appendChild(el('strong', null, side === HUMAN ? this.playerName.toLocaleUpperCase('hu-HU') : 'GÉP'));
      const marks = el('div', 'attempt-marks');
      for (let index = 0; index < 11; index += 1) {
        const outcome = game.attempts[side][index];
        const symbol = outcome === 'win' ? '⚽' : outcome === 'loss' ? '✕' : outcome === 'tie' ? '—' : '○';
        const marker = el('span', `attempt attempt--${outcome ?? 'empty'}`, symbol);
        marker.title = outcome === 'win' ? 'Megnyert párbaj' : outcome === 'loss' ? 'Elveszített párbaj' : outcome === 'tie' ? 'Döntetlen' : 'Hátralévő lap';
        marks.appendChild(marker);
      }
      wrapper.appendChild(marks);
      return wrapper;
    };
    this.dom.penaltyBoard.replaceChildren(row(HUMAN), row(AI));
  }

  _renderPiles(human, ai) {
    this.dom.playerPile.replaceChildren(el('span', 'pile__label', this.mode === 'penalties' ? 'Használt lapok' : 'Megnyert lapok'), document.createTextNode(human ? ` ${human}` : ''));
    this.dom.opponentPile.replaceChildren(el('span', 'pile__label', this.mode === 'penalties' ? 'Gép használt lapjai' : 'Gép nyereménye'), document.createTextNode(ai ? ` ${ai}` : ''));
    this.dom.playerPile.classList.toggle('filled', human > 0);
    this.dom.opponentPile.classList.toggle('filled', ai > 0);
  }

  _scoreChip(label, value, leading) {
    const chip = el('div', `score${leading ? ' leading' : ''}`);
    chip.append(el('span', null, label), el('b', null, String(value)));
    return chip;
  }

  showAttributePicker(game) {
    this.dom.duel.replaceChildren();
    this.dom.verdict.replaceChildren();
    this.dom.verdict.className = '';
    this.setPrompt('Te választasz kategóriát');
    const available = new Set(game.availableAttributeKeys());
    const playableAttributes = ATTRIBUTES.filter(attribute => available.has(attribute.key));

    this.dom.picker.replaceChildren(...playableAttributes.map(attribute => {
      const button = el('button', 'attr-btn');
      button.appendChild(document.createTextNode(`${attribute.icon} ${attribute.label}`));
      button.appendChild(el('small', null, attribute.hint));
      button.addEventListener('click', () => this.handlers.onAttribute(attribute.key));
      return button;
    }));
    if (!playableAttributes.length) {
      this.dom.picker.appendChild(el('div', 'picker-hint', 'Ehhez a leosztáshoz nincs közös, hiteles összehasonlítási adat.'));
    }
  }

  hideAttributePicker() { this.dom.picker.replaceChildren(); }

  setPrompt(text, highlight) {
    this.dom.prompt.replaceChildren(document.createTextNode(text));
    if (highlight) this.dom.prompt.append(document.createTextNode(' '), el('span', 'highlight', highlight));
  }

  showDuel(game, { opponentHidden = false, result = null } = {}) {
    const attribute = game.attribute;
    const mine = el('div', 'duel-slot');
    mine.append(el('div', 'duel-slot__who', this.playerName), game.played[HUMAN]
      ? this.renderCard(game.played[HUMAN], { activeAttribute: attribute }) : this._emptySlot());
    const theirs = el('div', 'duel-slot');
    theirs.append(el('div', 'duel-slot__who', 'Gép'), opponentHidden || !game.played[AI]
      ? this.renderCard(null, { faceDown: true }) : this.renderCard(game.played[AI], { activeAttribute: attribute }));
    if (result?.winner === HUMAN) { mine.classList.add('winner'); theirs.classList.add('loser'); }
    if (result?.winner === AI) { theirs.classList.add('winner'); mine.classList.add('loser'); }
    this.dom.duel.replaceChildren(mine, el('div', 'versus', 'VS'), theirs);
  }

  _emptySlot() { return el('div', 'card card--empty'); }

  showVerdict(result, game) {
    const attribute = ATTRIBUTE_BY_KEY[result.attribute];
    const detail = `${attribute.icon} ${attribute.label}: ${formatAttribute(result.humanCard, result.attribute)} – ${formatAttribute(result.aiCard, result.attribute)}`;
    const node = this.dom.verdict;
    node.replaceChildren();
    const isPenalty = game.mode === 'penalties';

    if (result.winner === 'tie') {
      node.className = 'tie';
      node.append('DÖNTETLEN', el('small', null, `${detail}${isPenalty ? ' · nincs gól' : ' · a lapok az asztalon maradnak'}`));
      this.playSound('tie');
    } else if (result.winner === HUMAN) {
      node.className = 'win';
      const pot = result.potScooped ? ` · +${result.potScooped} lap a döntetlenpakliból` : '';
      node.append(isPenalty ? `GÓL: ${this.playerName.toLocaleUpperCase('hu-HU')}` : 'A TIÉD A KÖR', el('small', null, detail + pot));
      this.playSound('win');
    } else {
      node.className = 'lose';
      const pot = result.potScooped ? ` · +${result.potScooped} lap a döntetlenpakliból` : '';
      node.append(isPenalty ? 'GÓL A GÉPNEK' : 'A GÉPÉ A KÖR', el('small', null, detail + pot));
      this.playSound('loss');
    }
  }

  async showSuddenDeath() {
    this.dom.suddenDeath.hidden = false;
    this.dom.suddenDeath.textContent = '⚠ HIRTELEN HALÁL ⚠';
    this.playSound('sudden');
    await new Promise(resolve => setTimeout(resolve, 1200));
    this.dom.suddenDeath.hidden = true;
  }

  say(line) {
    if (!line || !this.settings.commentary) return;
    const bubble = el('div', 'bubble');
    const avatar = el('div', 'avatar', line.speaker.name[0]);
    avatar.style.background = line.speaker.colour;
    tryArt(avatar, ART.friend(line.speaker.id));
    const body = el('div', 'bubble__body');
    const name = el('div', 'bubble__name', line.speaker.name);
    name.style.color = line.speaker.colour;
    body.append(name, el('div', 'bubble__text', line.text));
    bubble.append(avatar, body);
    this.dom.feed.appendChild(bubble);
    this.dom.feed.scrollTop = this.dom.feed.scrollHeight;
    while (this.dom.feed.children.length > 40) this.dom.feed.firstChild.remove();
  }

  playSound(kind) {
    if (!this.settings.sounds) return;
    try {
      this.audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
      const context = this.audioContext;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const frequencies = { win: 520, loss: 160, tie: 280, sudden: 110 };
      oscillator.frequency.value = frequencies[kind] ?? 320;
      oscillator.type = kind === 'sudden' ? 'sawtooth' : 'triangle';
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (kind === 'sudden' ? 0.55 : 0.22));
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + (kind === 'sudden' ? 0.6 : 0.25));
    } catch {
      // Audio is an optional enhancement; blocked browser audio never blocks play.
    }
  }

  showOverlay(node) {
    this.dom.overlayBody.replaceChildren(node);
    this.dom.overlay.hidden = false;
  }

  hideOverlay() { this.dom.overlay.hidden = true; }
}
