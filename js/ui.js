/**
 * Rendering. Owns the DOM; knows nothing about the rules beyond reading state.
 *
 * ART INTEGRATION: every image is resolved through the ART helpers below and
 * degrades to a CSS fallback when the file is missing, so dropping art in is a
 * pure file-copy operation with no code change.
 */

import { ATTRIBUTES, ATTRIBUTE_BY_KEY } from './data/players.js';
import { HUMAN, AI, PHASE } from './engine.js';
import { SPEAKERS } from './banter.js';

/**
 * Where art lives. Each entry returns the candidate filenames to try, in order
 * — the first one that loads wins, so you can drop in .jpg or .webp without
 * touching any code. Nothing here is required: a missing file just leaves the
 * CSS fallback in place.
 */
const EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const withExtensions = base => EXTENSIONS.map(ext => `${base}.${ext}`);

export const ART = {
  portrait: id => withExtensions(`assets/portraits/${id}`),
  cardBack: () => withExtensions('assets/cards/back'),
  friend:   id => withExtensions(`assets/friends/${id}`),
  //  ⇩ THE PUB BACKGROUND GOES HERE:  assets/pub/background.png
  pub:      () => withExtensions('assets/pub/background'),
};

const $ = sel => document.querySelector(sel);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

/**
 * Try each candidate URL in turn; apply the first that loads and stop.
 * If none load, the node keeps its CSS fallback.
 */
function tryArt(node, candidates, loadedClass = 'has-art', overlay = null) {
  const urls = Array.isArray(candidates) ? candidates : [candidates];

  const attempt = i => {
    if (i >= urls.length) return;
    const probe = new Image();
    probe.onload = () => {
      // `overlay` is composited on top of the art as an extra background layer,
      // so a bright or busy photo can't wreck the legibility of the UI on it.
      node.style.backgroundImage = overlay
        ? `${overlay}, url("${urls[i]}")`
        : `url("${urls[i]}")`;
      node.classList.add(loadedClass);
    };
    probe.onerror = () => attempt(i + 1);
    probe.src = urls[i];
  };
  attempt(0);
}

/** Darkening scrim over the pub photo — keeps the table and text readable. */
const PUB_SCRIM = 'linear-gradient(rgba(18,11,5,.62), rgba(18,11,5,.78))';

const initials = name => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

// NOTE: the "is this stat list scrollable" hint is done entirely in CSS
// (see the scroll-shadow rules on .card__stats). An earlier JS version measured
// scrollHeight vs clientHeight after render and toggled a class; it raced the
// flex layout and silently never applied. CSS has no such timing problem and
// handles resize for free.

export class UI {
  constructor(handlers) {
    this.handlers = handlers;   // { onAttribute, onCard, onNext, onRestart }
    this.dom = {
      pub:        $('#pub'),
      hudScores:  $('#hud-scores'),
      hudMeta:    $('#hud-meta'),
      opponentHand: $('#opponent-hand'),
      opponentPile: $('#opponent-pile'),
      playerHand: $('#player-hand'),
      playerPile: $('#player-pile'),
      prompt:     $('#prompt'),
      picker:     $('#attribute-picker'),
      duel:       $('#duel'),
      verdict:    $('#verdict'),
      pot:        $('#pot-indicator'),
      feed:       $('#banter-feed'),
      overlay:    $('#overlay'),
      overlayBody: $('#overlay-body'),
    };

    tryArt(this.dom.pub, ART.pub(), 'has-art', PUB_SCRIM);
  }

  // ── Card rendering ───────────────────────────────────────────────────────

  /**
   * @param {object} card
   * @param {object} opts  { activeAttribute, selectable, onClick, faceDown }
   */
  renderCard(card, opts = {}) {
    if (opts.faceDown) {
      const back = el('div', 'card card--back');
      tryArt(back, ART.cardBack());
      return back;
    }

    const node = el('div', 'card');
    node.dataset.cardId = card.id;

    const portrait = el('div', 'card__portrait');
    portrait.dataset.initials = initials(card.name);
    // Your own art wins; the pipeline's remote photo URL is the last resort,
    // so dropping a local file into assets/portraits/ always overrides it.
    tryArt(portrait, [...ART.portrait(card.id), ...(card.meta?.imageUrl ? [card.meta.imageUrl] : [])]);
    portrait.appendChild(el('span', 'card__position', card.position));
    node.appendChild(portrait);

    node.appendChild(el('div', 'card__name', card.name));
    node.appendChild(el('div', 'card__club', `${card.club} · ${card.nation}`));

    const stats = el('div', 'card__stats');
    for (const attr of ATTRIBUTES) {
      const row = el('div', 'stat' + (attr.key === opts.activeAttribute ? ' active' : ''));
      row.appendChild(el('span', 'stat__label', attr.label));
      row.appendChild(el('span', 'stat__value', attr.format(card.stats[attr.key])));
      stats.appendChild(row);
    }
    node.appendChild(stats);

    // "dimmed" and "not clickable" are separate: a card you cannot play right
    // now is still one you may want to read.
    if (opts.onClick) {
      node.classList.add('selectable');
      node.addEventListener('click', () => opts.onClick(card));
    }
    if (opts.dimmed) node.classList.add('card--dim');
    if (opts.large)  node.classList.add('card--large');
    return node;
  }

  // ── Card inspector ───────────────────────────────────────────────────────

  /**
   * Blown-up view of a single card. Used both to read the stats properly and
   * to confirm a play, so the 9px card text is never the thing you decide on.
   *
   * @param {object[]} hand     the cards you can page through
   * @param {number}   index    which one to show first
   * @param {object}   opts     { attribute, playable, onPlay }
   */
  openInspector(hand, index, opts = {}) {
    this.inspector = { hand, index, opts };
    this._renderInspector();
  }

  closeInspector() {
    this.inspector = null;
    const layer = $('#inspector');
    if (layer) layer.remove();
    document.removeEventListener('keydown', this._inspectorKeys);
    this._inspectorKeys = null;
  }

  get inspectorOpen() { return !!this.inspector; }

  _inspectorStep(delta) {
    if (!this.inspector) return;
    const { hand } = this.inspector;
    this.inspector.index = (this.inspector.index + delta + hand.length) % hand.length;
    this._renderInspector();
  }

  _renderInspector() {
    const { hand, index, opts } = this.inspector;
    const card = hand[index];

    $('#inspector')?.remove();

    const layer = el('div', null);
    layer.id = 'inspector';
    layer.addEventListener('click', e => { if (e.target === layer) this.closeInspector(); });

    const shell = el('div', 'inspector__shell');

    // Left / right paging through the rest of the hand.
    const prev = el('button', 'inspector__nav', '‹');
    prev.title = 'Previous card (←)';
    prev.addEventListener('click', () => this._inspectorStep(-1));

    const next = el('button', 'inspector__nav', '›');
    next.title = 'Next card (→)';
    next.addEventListener('click', () => this._inspectorStep(1));

    const centre = el('div', 'inspector__centre');
    centre.appendChild(this.renderCard(card, {
      activeAttribute: opts.attribute,
      large: true,
    }));

    const counter = el('div', 'inspector__counter', `${index + 1} of ${hand.length} in hand`);
    centre.appendChild(counter);

    const actions = el('div', 'inspector__actions');
    if (opts.playable) {
      const play = el('button', 'btn', 'Play this card');
      play.addEventListener('click', () => {
        const chosen = hand[this.inspector.index];
        this.closeInspector();
        opts.onPlay(chosen);
      });
      actions.appendChild(play);
    }
    const back = el('button', 'btn btn--ghost', opts.playable ? 'Back' : 'Close');
    back.addEventListener('click', () => this.closeInspector());
    actions.appendChild(back);
    centre.appendChild(actions);

    const hint = el('div', 'inspector__hint',
      opts.playable
        ? '← → to compare cards · Enter to play · Esc to go back'
        : '← → to compare cards · Esc to close');
    centre.appendChild(hint);

    shell.append(prev, centre, next);
    layer.appendChild(shell);
    document.body.appendChild(layer);

    if (!this._inspectorKeys) {
      this._inspectorKeys = e => {
        if (!this.inspector) return;
        if (e.key === 'Escape')     { this.closeInspector(); }
        else if (e.key === 'ArrowLeft')  { this._inspectorStep(-1); }
        else if (e.key === 'ArrowRight') { this._inspectorStep(1); }
        else if (e.key === 'Enter' && this.inspector.opts.playable) {
          // Read from live state, not the closure: this listener is registered
          // once per open and must not capture a stale opts object.
          const { hand: h, index: i, opts: o } = this.inspector;
          const chosen = h[i];
          this.closeInspector();
          o.onPlay(chosen);
        }
      };
      document.addEventListener('keydown', this._inspectorKeys);
    }
  }

  // ── Zones ────────────────────────────────────────────────────────────────

  /**
   * @param {object} game
   * @param {object} opts  `selectable` = a card may actually be played now.
   *                       Cards are always *inspectable* — you need to read the
   *                       stats to choose an attribute, not just to play.
   */
  renderHands(game, { selectable = false, inspectAttribute = null } = {}) {
    const { opponentHand, playerHand } = this.dom;

    opponentHand.replaceChildren(
      ...game.hands[AI].map(() => this.renderCard(null, { faceDown: true }))
    );

    const hand = game.hands[HUMAN];
    const attribute = game.attribute ?? inspectAttribute;

    playerHand.replaceChildren(
      ...hand.map((card, i) => this.renderCard(card, {
        activeAttribute: attribute,
        dimmed: !selectable,
        onClick: () => this.openInspector(hand, i, {
          attribute,
          playable: selectable,
          onPlay: c => this.handlers.onCard(c),
        }),
      }))
    );
  }

  renderScores(game) {
    const { [HUMAN]: you, [AI]: them } = game.scores;

    this.dom.hudScores.replaceChildren(
      this._scoreChip('You', you, you > them),
      this._scoreChip('Barry', them, them > you),
    );

    this.dom.hudMeta.textContent =
      `Round ${game.round} · ${game.deck.length} cards left in the deck`;

    this.dom.playerPile.textContent = you || '';
    this.dom.playerPile.classList.toggle('filled', you > 0);
    this.dom.opponentPile.textContent = them || '';
    this.dom.opponentPile.classList.toggle('filled', them > 0);

    this.dom.pot.textContent = game.pot.length
      ? `${game.pot.length} card${game.pot.length === 1 ? '' : 's'} in the pot`
      : '';
  }

  _scoreChip(label, value, leading) {
    const chip = el('div', 'score' + (leading ? ' leading' : ''));
    chip.appendChild(el('span', null, label));
    chip.appendChild(el('b', null, String(value)));
    return chip;
  }

  // ── Phase views ──────────────────────────────────────────────────────────

  showAttributePicker(game) {
    this.dom.duel.replaceChildren();
    this.dom.verdict.textContent = '';
    this.dom.verdict.className = '';
    this.setPrompt('Your call — pick an attribute');

    this.dom.picker.replaceChildren(...ATTRIBUTES.map(attr => {
      const btn = el('button', 'attr-btn');
      btn.appendChild(document.createTextNode(attr.label));
      btn.appendChild(el('small', null, attr.higherWins ? 'higher wins' : 'lower wins'));
      btn.addEventListener('click', () => this.handlers.onAttribute(attr.key));
      return btn;
    }));

    const hint = el('div', 'picker-hint', 'Click any card in your hand to look at it properly first');
    this.dom.picker.appendChild(hint);
  }

  hideAttributePicker() {
    this.dom.picker.replaceChildren();
  }

  setPrompt(text, highlight) {
    this.dom.prompt.replaceChildren(document.createTextNode(text));
    if (highlight) {
      this.dom.prompt.appendChild(document.createTextNode(' '));
      this.dom.prompt.appendChild(el('span', 'highlight', highlight));
    }
  }

  /** Show the played cards. `opponentHidden` keeps the AI's card face down. */
  showDuel(game, { opponentHidden = false, result = null } = {}) {
    const attribute = game.attribute;
    const slots = [];

    const mine = el('div', 'duel-slot');
    mine.appendChild(el('div', 'duel-slot__who', 'You'));
    mine.appendChild(game.played[HUMAN]
      ? this.renderCard(game.played[HUMAN], { activeAttribute: attribute })
      : this._emptySlot());
    slots.push(mine);

    slots.push(el('div', 'versus', 'VS'));

    const theirs = el('div', 'duel-slot');
    theirs.appendChild(el('div', 'duel-slot__who', 'Barry'));
    theirs.appendChild(
      opponentHidden || !game.played[AI]
        ? this.renderCard(null, { faceDown: true })
        : this.renderCard(game.played[AI], { activeAttribute: attribute })
    );
    slots.push(theirs);

    if (result) {
      if (result.winner === HUMAN) { mine.classList.add('winner'); theirs.classList.add('loser'); }
      else if (result.winner === AI) { theirs.classList.add('winner'); mine.classList.add('loser'); }
    }

    this.dom.duel.replaceChildren(...slots);
  }

  _emptySlot() {
    const slot = el('div', 'card');
    slot.style.background = 'rgba(0,0,0,.2)';
    slot.style.border = '1px dashed rgba(201,162,39,.35)';
    slot.style.boxShadow = 'none';
    return slot;
  }

  showVerdict(result, game) {
    const attr = ATTRIBUTE_BY_KEY[result.attribute];
    const mine = attr.format(result.humanCard.stats[result.attribute]);
    const theirs = attr.format(result.aiCard.stats[result.attribute]);
    const detail = `${attr.label}: ${mine} vs ${theirs}`;

    const node = this.dom.verdict;
    node.replaceChildren();

    if (result.winner === 'tie') {
      node.className = 'tie';
      node.appendChild(document.createTextNode('Dead heat'));
      node.appendChild(el('small', null, `${detail} — both cards stay on the table`));
    } else if (result.winner === HUMAN) {
      node.className = 'win';
      const scooped = result.potScooped ? ` (+${result.potScooped} from the pot)` : '';
      node.appendChild(document.createTextNode('You take it'));
      node.appendChild(el('small', null, detail + scooped));
    } else {
      node.className = 'lose';
      const scooped = result.potScooped ? ` (+${result.potScooped} from the pot)` : '';
      node.appendChild(document.createTextNode('Barry takes it'));
      node.appendChild(el('small', null, detail + scooped));
    }
  }

  // ── Banter ───────────────────────────────────────────────────────────────

  say(line) {
    if (!line) return;
    const { speaker, text } = line;

    const bubble = el('div', 'bubble');

    const avatar = el('div', 'avatar');
    avatar.style.background = speaker.colour;
    avatar.textContent = speaker.name[0];
    tryArt(avatar, ART.friend(speaker.id));
    bubble.appendChild(avatar);

    const body = el('div', 'bubble__body');
    const name = el('div', 'bubble__name', speaker.name);
    name.style.color = speaker.colour;
    body.appendChild(name);
    body.appendChild(el('div', 'bubble__text', text));
    bubble.appendChild(body);

    this.dom.feed.appendChild(bubble);
    this.dom.feed.scrollTop = this.dom.feed.scrollHeight;

    // Keep the feed from growing without bound over a long game.
    while (this.dom.feed.children.length > 60) {
      this.dom.feed.removeChild(this.dom.feed.firstChild);
    }
  }

  // ── Overlay ──────────────────────────────────────────────────────────────

  showOverlay(node) {
    this.dom.overlayBody.replaceChildren(node);
    this.dom.overlay.hidden = false;
  }

  hideOverlay() {
    this.dom.overlay.hidden = true;
  }
}

export { el, $ };
