/** DOM rendering shared by Classic and Penalties modes. */

import { ATTRIBUTE_BY_KEY, formatAttribute, hasAttributeData } from './data/players.js';
import { HUMAN, AI } from './engine.js';
import { renderAttributePickerComponent } from './ui/attribute-picker-component.js';
import { createCardComponent } from './ui/card-component.js';
import { $, ART, el, finiteDetail, PUB_SCRIM, tryArt } from './ui/dom-primitives.js';
import { renderScoreboardComponent } from './ui/scoreboard-component.js';

export { $, ART, el };

export class UI {
  constructor(handlers, settings = {}) {
    this.handlers = handlers;
    this.settings = { sounds: true, commentary: true, ...settings };
    this.mode = 'classic';
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
    for (const node of [this.dom.opponentHand, this.dom.playerHand, this.dom.duel, this.dom.verdict,
      this.dom.picker, this.dom.feed, this.dom.penaltyBoard]) node.replaceChildren();
    this.dom.prompt.textContent = '';
    this.dom.pot.textContent = '';
    this.dom.suddenDeath.hidden = true;
  }

  renderCard(card, opts = {}) {
    return createCardComponent(card, opts);
  }

  openInspector(hand, index, opts = {}) {
    this.inspector = { hand, index, opts };
    this._renderInspector();
  }

  closeInspector() {
    this.inspector = null;
    $('#inspector')?.remove();
    if (this._inspectorKeys) document.removeEventListener('keydown', this._inspectorKeys);
    this._inspectorKeys = null;
  }

  _inspectorStep(delta) {
    if (!this.inspector) return;
    this.inspector.index = (this.inspector.index + delta + this.inspector.hand.length) % this.inspector.hand.length;
    this._renderInspector();
  }

  _renderInspector() {
    const { hand, index, opts } = this.inspector;
    const card = hand[index];
    const canPlay = opts.playable && (!opts.attribute || hasAttributeData(card, opts.attribute));
    $('#inspector')?.remove();

    const layer = el('div');
    layer.id = 'inspector';
    layer.addEventListener('click', event => { if (event.target === layer) this.closeInspector(); });
    const shell = el('div', 'inspector__shell');
    const previous = el('button', 'inspector__nav', '‹');
    previous.title = 'Előző kártya';
    previous.addEventListener('click', () => this._inspectorStep(-1));
    const next = el('button', 'inspector__nav', '›');
    next.title = 'Következő kártya';
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
      play.disabled = !canPlay;
      play.addEventListener('click', () => {
        if (!canPlay) return;
        const chosen = hand[this.inspector.index];
        this.closeInspector();
        opts.onPlay(chosen);
      });
      actions.appendChild(play);
    }
    const close = el('button', 'btn btn--ghost', opts.playable ? 'Vissza' : 'Bezárás');
    close.addEventListener('click', () => this.closeInspector());
    actions.appendChild(close);
    centre.appendChild(actions);
    centre.appendChild(el('div', 'inspector__hint', '← → kártyaváltás · Enter kijátszás · Esc bezárás'));
    shell.append(previous, centre, next);
    layer.appendChild(shell);
    document.body.appendChild(layer);

    this._inspectorKeys = event => {
      if (!this.inspector) return;
      if (event.key === 'Escape') this.closeInspector();
      else if (event.key === 'ArrowLeft') this._inspectorStep(-1);
      else if (event.key === 'ArrowRight') this._inspectorStep(1);
      else if (event.key === 'Enter') {
        const current = this.inspector.hand[this.inspector.index];
        const playable = this.inspector.opts.playable
          && (!this.inspector.opts.attribute || hasAttributeData(current, this.inspector.opts.attribute));
        if (playable) {
          const onPlay = this.inspector.opts.onPlay;
          this.closeInspector();
          onPlay(current);
        }
      }
    };
    document.addEventListener('keydown', this._inspectorKeys);
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
    renderScoreboardComponent(this.dom, game, this.mode);
  }

  showAttributePicker(game) {
    this.dom.duel.replaceChildren();
    this.dom.verdict.replaceChildren();
    this.dom.verdict.className = '';
    this.setPrompt('Te választasz kategóriát');
    renderAttributePickerComponent(
      this.dom.picker,
      game,
      attributeKey => this.handlers.onAttribute(attributeKey),
    );
  }

  hideAttributePicker() { this.dom.picker.replaceChildren(); }

  setPrompt(text, highlight) {
    this.dom.prompt.replaceChildren(document.createTextNode(text));
    if (highlight) this.dom.prompt.append(document.createTextNode(' '), el('span', 'highlight', highlight));
  }

  showDuel(game, { opponentHidden = false, result = null } = {}) {
    const attribute = game.attribute;
    const mine = el('div', 'duel-slot');
    mine.append(el('div', 'duel-slot__who', 'Játékos'), game.played[HUMAN]
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
      node.append(isPenalty ? 'GÓL A JÁTÉKOSNAK' : 'A TIÉD A KÖR', el('small', null, detail + pot));
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
