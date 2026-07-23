/** Stabil UI homlokzat a Klasszikus és Büntetőpárbaj mód vizuális komponensei előtt. */

import { hasAttributeData } from './data/players.js';
import { AI, HUMAN } from './engine.js';
import { CardView } from './ui/card-view.js';
import { FeedbackView } from './ui/feedback-view.js';
import { MatchView } from './ui/match-view.js';
import { ScoreboardView } from './ui/scoreboard-view.js';
import { ART, $, el, finiteDetail, PUB_SCRIM, tryArt } from './ui/dom.js';

export { ART, $, el };

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
    this.cardView = new CardView();
    this.scoreboardView = new ScoreboardView(this.dom, () => this.mode);
    this.feedbackView = new FeedbackView(this.dom);
    this.matchView = new MatchView(this.dom, {
      onAttribute: key => this.handlers.onAttribute(key),
      renderCard: (card, opts) => this.renderCard(card, opts),
      setPrompt: (text, highlight) => this.setPrompt(text, highlight),
      playSound: kind => this.playSound(kind),
    });
    tryArt(this.dom.pub, ART.pub(), 'has-art', PUB_SCRIM);
    this._renderSettings();
  }

  get audioContext() { return this.feedbackView.audioContext; }
  set audioContext(value) { this.feedbackView.audioContext = value; }

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

  _cardRows(card, activeAttributeKey) {
    return this.cardView.cardRows(card, activeAttributeKey);
  }

  renderCard(card, opts = {}) {
    return this.cardView.renderCard(card, opts);
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
    if (game.mode === 'penalties') this._renderPenaltyScores(game);
    else this._renderClassicScores(game);
  }

  _renderClassicScores(game) {
    return this.scoreboardView.renderClassicScores(game, {
      renderPiles: (human, ai) => this._renderPiles(human, ai),
      scoreChip: (label, value, leading) => this._scoreChip(label, value, leading),
    });
  }

  _renderPenaltyScores(game) {
    return this.scoreboardView.renderPenaltyScores(game, {
      renderPiles: (human, ai) => this._renderPiles(human, ai),
    });
  }

  _renderPiles(human, ai) {
    return this.scoreboardView.renderPiles(human, ai);
  }

  _scoreChip(label, value, leading) {
    return this.scoreboardView.scoreChip(label, value, leading);
  }

  showAttributePicker(game) {
    return this.matchView.showAttributePicker(game);
  }

  hideAttributePicker() {
    return this.matchView.hideAttributePicker();
  }

  setPrompt(text, highlight) {
    return this.matchView.setPrompt(text, highlight);
  }

  showDuel(game, options = {}) {
    return this.matchView.showDuel(game, options);
  }

  _emptySlot() {
    return this.matchView.emptySlot();
  }

  showVerdict(result, game) {
    return this.matchView.showVerdict(result, game);
  }

  showSuddenDeath() {
    return this.matchView.showSuddenDeath();
  }

  say(line) {
    if (!line || !this.settings.commentary) return;
    this.feedbackView.say(line);
  }

  playSound(kind) {
    if (!this.settings.sounds) return;
    this.feedbackView.playSound(kind);
  }

  showOverlay(node) {
    this.dom.overlayBody.replaceChildren(node);
    this.dom.overlay.hidden = false;
  }

  hideOverlay() {
    this.dom.overlay.hidden = true;
  }
}
