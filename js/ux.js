/**
 * Progressive UX layer for Fociskártyák 2026.
 *
 * It intentionally augments the existing UI instead of replacing the game
 * engine. The classic rules and the Büntetőpárbaj rules therefore remain unchanged.
 */

import { UI, el } from './ui.js';
import {
  ATTRIBUTES,
  ATTRIBUTE_BY_KEY,
  attributeValue,
  formatAttribute,
  hasAttributeData,
} from './data/players.js';
import { HUMAN, AI } from './engine.js';

// The synthetic overall score is not shown or offered as a comparison category.
const overallScoreIndex = ATTRIBUTES.findIndex(attribute => attribute.key === 'overallScore');
if (overallScoreIndex >= 0) ATTRIBUTES.splice(overallScoreIndex, 1);
delete ATTRIBUTE_BY_KEY.overallScore;

// Cards show only the rounded age. The exact date remains in the verified data
// and still drives the younger-player comparison accurately.
const birthDateAttribute = ATTRIBUTE_BY_KEY.birthDate;
if (birthDateAttribute) {
  birthDateAttribute.label = 'Fiatalabb játékos';
  birthDateAttribute.hint = 'A fiatalabb nyer';
  birthDateAttribute.format = (_value, card) => {
    const age = card?.stats?.age;
    return typeof age === 'number' && Number.isFinite(age)
      ? `${Math.round(age)} év`
      : 'Nincs adat';
  };
}

const originals = {
  renderCard: UI.prototype.renderCard,
  resetTable: UI.prototype.resetTable,
  setPrompt: UI.prototype.setPrompt,
  showOverlay: UI.prototype.showOverlay,
};

export function comparisonDirectionInstruction(attribute) {
  switch (attribute?.direction) {
    case 'higher': return 'A nagyobb érték a jobb';
    case 'lower': return 'A kisebb érték a jobb';
    case 'later': return 'A későbbi érték a jobb';
    case 'earlier': return 'A korábbi érték a jobb';
    default: return attribute?.higherWins ? 'A nagyobb érték a jobb' : 'A kisebb érték a jobb';
  }
}

const attributeDirection = attribute => {
  const instruction = comparisonDirectionInstruction(attribute);
  return instruction ? instruction.charAt(0).toLocaleLowerCase('hu-HU') + instruction.slice(1) : '';
};

const comparisonSymbol = (attribute, winner) => {
  if (winner === 'tie') return '=';
  const humanWon = winner === HUMAN;
  const lowerWins = ['lower', 'earlier'].includes(attribute?.direction)
    || (!attribute?.direction && attribute?.higherWins === false);
  if (lowerWins) return humanWon ? '<' : '>';
  return humanWon ? '>' : '<';
};

const metricValue = (card, attributeKey) => {
  if (attributeKey === 'birthDate') {
    const age = card?.stats?.age;
    return typeof age === 'number' && Number.isFinite(age) ? age : null;
  }
  return attributeValue(card, attributeKey);
};

const displayCategory = key => {
  const attribute = ATTRIBUTE_BY_KEY[key];
  return attribute ? `${attribute.icon} ${attribute.label}` : key;
};

UI.prototype._uxEnsureStepper = function _uxEnsureStepper() {
  let steps = this.dom.prompt?.parentElement?.querySelector('.game-steps');
  if (steps) return steps;

  steps = el('div', 'game-steps');
  steps.setAttribute('aria-label', 'A kör lépései');
  ['1. Kategória', '2. Kártya', '3. Eredmény'].forEach((label, index) => {
    const item = el('span', 'game-step', label);
    item.dataset.step = String(index + 1);
    steps.appendChild(item);
  });

  const felt = this.dom.prompt?.parentElement;
  if (felt) felt.insertBefore(steps, this.dom.prompt);
  return steps;
};

UI.prototype._uxSetStep = function _uxSetStep(activeStep = 0) {
  const steps = this._uxEnsureStepper();
  steps.hidden = activeStep === 0;
  steps.querySelectorAll('.game-step').forEach(item => {
    const step = Number(item.dataset.step);
    item.classList.toggle('is-active', step === activeStep);
    item.classList.toggle('is-complete', step < activeStep);
    if (step === activeStep) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
};

UI.prototype._renderSettings = function renderFriendlySettings() {
  this.dom.hudSettings.replaceChildren();

  const details = el('details', 'ux-settings');
  const summary = el('summary', 'ux-settings__trigger', '⚙ Beállítások');
  summary.setAttribute('aria-label', 'Beállítások megnyitása');

  const panel = el('div', 'ux-settings__panel');
  const sound = el('button', 'ux-setting-row', this.settings.sounds ? '🔊 Hangok bekapcsolva' : '🔇 Hangok kikapcsolva');
  sound.type = 'button';
  sound.setAttribute('aria-pressed', String(this.settings.sounds));
  sound.addEventListener('click', () => this.handlers.onToggleSounds?.());

  const comments = el('button', 'ux-setting-row', this.settings.commentary ? '💬 Kommentárok bekapcsolva' : '🚫 Kommentárok kikapcsolva');
  comments.type = 'button';
  comments.setAttribute('aria-pressed', String(this.settings.commentary));
  comments.addEventListener('click', () => this.handlers.onToggleCommentary?.());

  const banter = el('button', 'ux-setting-row ux-banter-toggle', '🗨 Hátsó asztal megnyitása');
  banter.type = 'button';
  banter.setAttribute('aria-expanded', String(this.dom.pub.classList.contains('ux-banter-open')));
  banter.addEventListener('click', () => {
    const opened = this.dom.pub.classList.toggle('ux-banter-open');
    banter.setAttribute('aria-expanded', String(opened));
    banter.textContent = opened ? '✕ Hátsó asztal bezárása' : '🗨 Hátsó asztal megnyitása';
    details.open = false;
  });

  panel.append(sound, comments, banter);
  details.append(summary, panel);
  this.dom.hudSettings.appendChild(details);
};

UI.prototype.resetTable = function resetFriendlyTable() {
  originals.resetTable.call(this);
  this.uxStats = {
    rounds: 0,
    humanWins: 0,
    aiWins: 0,
    ties: 0,
    categoryWins: {},
    playerWins: {},
    biggestWin: null,
    closestDuel: null,
  };
  this.dom.pub.classList.remove('ux-banter-open');
  this._uxSetStep(0);
};

UI.prototype.renderCard = function renderFriendlyCard(card, opts = {}) {
  if (opts.faceDown) return originals.renderCard.call(this, card, opts);

  const directPlay = typeof opts.onClick === 'function' ? opts.onClick : null;
  const inspect = typeof opts.onInspect === 'function' ? opts.onInspect : null;
  const node = originals.renderCard.call(this, card, { ...opts, onClick: undefined });

  // Unknown fields do not consume valuable card space.
  node.querySelectorAll('.stat--missing').forEach(row => row.remove());

  // The currently compared statistic is always the first visible row.
  const active = node.querySelector('.stat.active');
  const stats = node.querySelector('.card__stats');
  if (active && stats?.firstElementChild !== active) stats.prepend(active);

  if (inspect) {
    const button = el('button', 'card__inspect', '🔍');
    button.type = 'button';
    button.title = `${card.name} részletei`;
    button.setAttribute('aria-label', `${card.name} részleteinek megnyitása`);
    button.addEventListener('click', event => {
      event.stopPropagation();
      inspect(card);
    });
    node.appendChild(button);
  }

  const activate = event => {
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    if (event.type === 'keydown') event.preventDefault();
    if (event.target.closest?.('.card__inspect')) return;
    if (directPlay) directPlay(card);
    else inspect?.(card);
  };

  if (directPlay || inspect) {
    node.tabIndex = 0;
    node.setAttribute('role', 'button');
    node.addEventListener('click', activate);
    node.addEventListener('keydown', activate);
  }

  if (directPlay) {
    node.classList.add('selectable', 'card--direct-play');
    node.title = `${card.name} kijátszása`;
    node.setAttribute('aria-label', `${card.name} kijátszása. A nagyítóval a részletek nyithatók meg.`);
  } else if (inspect) {
    node.classList.add('card--inspectable');
    node.setAttribute('aria-label', `${card.name} részleteinek megnyitása`);
  }

  return node;
};

UI.prototype.renderHands = function renderFriendlyHands(game, { selectable = false, inspectAttribute = null } = {}) {
  this.dom.opponentHand.replaceChildren(
    ...game.hands[AI].map(() => this.renderCard(null, { faceDown: true }))
  );

  const hand = game.hands[HUMAN];
  const attribute = game.attribute ?? inspectAttribute;
  this.dom.playerHand.replaceChildren(...hand.map((card, index) => {
    const unavailable = Boolean(attribute) && !hasAttributeData(card, attribute);
    const inspect = () => this.openInspector(hand, index, {
      attribute,
      playable: selectable,
      onPlay: chosen => this.handlers.onCard(chosen),
    });

    return this.renderCard(card, {
      activeAttribute: attribute,
      dimmed: !selectable || unavailable,
      unavailable,
      onClick: selectable && !unavailable ? () => this.handlers.onCard(card) : null,
      onInspect: inspect,
    });
  }));

  if (selectable) this._uxSetStep(2);

  // The chooser may revise the category until a card has actually been played.
  if (selectable && inspectAttribute) {
    const change = el('button', 'btn btn--ghost ux-change-attribute', '↩ Másik kategória');
    change.type = 'button';
    change.addEventListener('click', () => this.showAttributePicker(game));
    this.dom.picker.replaceChildren(change);
  }
};

UI.prototype.showAttributePicker = function showFriendlyAttributePicker(game) {
  this.dom.duel.replaceChildren();
  this.dom.verdict.replaceChildren();
  this.dom.verdict.className = '';
  this.setPrompt('Válassz kategóriát');

  const available = new Set(game.availableAttributeKeys());
  const buttons = ATTRIBUTES
    .filter(attribute => available.has(attribute.key))
    .map(attribute => {
      const button = el('button', 'attr-btn');
      button.type = 'button';
      button.append(
        el('span', 'attr-btn__label', `${attribute.icon} ${attribute.label}`),
        el('small', null, attributeDirection(attribute))
      );
      button.setAttribute('aria-label', `${attribute.label}; ${attributeDirection(attribute)}`);
      button.addEventListener('click', () => this.handlers.onAttribute(attribute.key));
      return button;
    });

  if (buttons.length) this.dom.picker.replaceChildren(...buttons);
  else this.dom.picker.replaceChildren(el('p', 'ux-empty-state', 'Ehhez a leosztáshoz nincs közös, hiteles kategória.'));
  this._uxSetStep(1);
};

UI.prototype.setPrompt = function setFriendlyPrompt(text, highlight) {
  originals.setPrompt.call(this, text, highlight);
  if (!highlight) return;

  const attribute = ATTRIBUTES.find(item => item.label === highlight);
  if (!attribute) return;
  const direction = el('small', 'ux-direction', `— ${attributeDirection(attribute)}`);
  this.dom.prompt.appendChild(direction);
};

UI.prototype.showVerdict = function showFriendlyVerdict(result, game) {
  const attribute = ATTRIBUTE_BY_KEY[result.attribute];
  const humanValue = formatAttribute(result.humanCard, result.attribute);
  const aiValue = formatAttribute(result.aiCard, result.attribute);
  const symbol = comparisonSymbol(attribute, result.winner);
  const detail = `${attribute.icon} ${attribute.label}: ${humanValue} ${symbol} ${aiValue}`;
  const node = this.dom.verdict;
  const isPenalty = game.mode === 'penalties';
  const pot = result.potScooped ? ` · +${result.potScooped} lap a döntetlenpakliból` : '';

  node.replaceChildren();
  if (result.winner === 'tie') {
    node.className = 'tie';
    node.append('DÖNTETLEN', el('small', null, `${detail}${isPenalty ? ' · nincs gól' : ' · a lapok az asztalon maradnak'}`));
    this.playSound('tie');
  } else if (result.winner === HUMAN) {
    node.className = 'win';
    node.append(isPenalty ? 'GÓL A JÁTÉKOSNAK' : 'A TIÉD A KÖR', el('small', null, detail + pot));
    this.playSound('win');
  } else {
    node.className = 'lose';
    node.append(isPenalty ? 'GÓL A GÉPNEK' : 'A GÉPÉ A KÖR', el('small', null, detail + pot));
    this.playSound('loss');
  }

  this._uxSetStep(3);
  this._uxRecordResult(result);
};

UI.prototype._uxRecordResult = function recordResult(result) {
  this.uxStats ??= {
    rounds: 0, humanWins: 0, aiWins: 0, ties: 0,
    categoryWins: {}, playerWins: {}, biggestWin: null, closestDuel: null,
  };
  const stats = this.uxStats;
  stats.rounds += 1;

  if (result.winner === 'tie') {
    stats.ties += 1;
    return;
  }

  const humanMetric = metricValue(result.humanCard, result.attribute);
  const aiMetric = metricValue(result.aiCard, result.attribute);
  const margin = humanMetric == null || aiMetric == null ? null : Math.abs(humanMetric - aiMetric);
  const summary = `${displayCategory(result.attribute)}: ${formatAttribute(result.humanCard, result.attribute)}–${formatAttribute(result.aiCard, result.attribute)}`;

  if (result.winner === HUMAN) {
    stats.humanWins += 1;
    stats.categoryWins[result.attribute] = (stats.categoryWins[result.attribute] ?? 0) + 1;
    stats.playerWins[result.humanCard.name] = (stats.playerWins[result.humanCard.name] ?? 0) + 1;
    if (margin != null && (!stats.biggestWin || margin > stats.biggestWin.margin)) {
      stats.biggestWin = { margin, summary, card: result.humanCard.name };
    }
  } else {
    stats.aiWins += 1;
  }

  if (margin != null && (!stats.closestDuel || margin < stats.closestDuel.margin)) {
    stats.closestDuel = { margin, summary };
  }
};

UI.prototype.showOverlay = function showFriendlyOverlay(node) {
  // The separate penalty introduction duplicated the information from the main
  // menu. Start immediately after the user presses the main start button.
  if (node.classList?.contains('penalty-intro')) {
    node.querySelector('#kickoff-btn')?.click();
    return;
  }

  const penaltyMode = node.querySelector?.('input[value="penalties"]')?.closest('.mode-card');
  if (penaltyMode) {
    const title = penaltyMode.querySelector('b');
    const description = penaltyMode.querySelector('small');
    if (title) title.textContent = '⚽ Büntetőpárbaj';
    if (description) description.textContent = '11–11 lap, öt rendes párbaj, döntetlennél hirtelen halál.';
    const rules = node.querySelector('[data-rules="penalties"]');
    if (rules) rules.innerHTML = '<b>Büntetőpárbaj-szabály:</b> 11 lap. Öt rendes párbaj. Döntetlennél hirtelen halál; azonos értéknél nincs gól.';
  }

  // Add a useful match summary to the classic result screen.
  if (node.classList?.contains('result-panel') && !node.querySelector('.result-stats') && this.uxStats?.rounds) {
    const stats = this.uxStats;
    const bestCategory = Object.entries(stats.categoryWins).sort((a, b) => b[1] - a[1])[0];
    const bestPlayer = Object.entries(stats.playerWins).sort((a, b) => b[1] - a[1])[0];
    const list = el('dl', 'result-stats ux-result-stats');
    const add = (label, value) => {
      const row = el('div');
      row.append(el('dt', null, label), el('dd', null, value));
      list.appendChild(row);
    };

    add('Lejátszott körök', String(stats.rounds));
    add('Megnyert körök', String(stats.humanWins));
    add('Legjobb kategória', bestCategory ? `${displayCategory(bestCategory[0])} (${bestCategory[1]})` : 'Nem volt megnyert kategória');
    add('Legeredményesebb játékos', bestPlayer ? `${bestPlayer[0]} (${bestPlayer[1]} kör)` : 'Nem volt megnyert lap');
    add('Legnagyobb győzelem', stats.biggestWin ? `${stats.biggestWin.card} · ${stats.biggestWin.summary}` : '—');
    add('Legszorosabb párbaj', stats.closestDuel?.summary ?? '—');
    node.querySelector('.result-actions')?.before(list);
  }

  originals.showOverlay.call(this, node);
};

function installDocumentUX() {
  document.documentElement.classList.add('ux-enabled');

  const prompt = document.querySelector('#prompt');
  const verdict = document.querySelector('#verdict');
  const overlay = document.querySelector('#overlay');
  const playerHand = document.querySelector('#player-hand');
  const opponentHand = document.querySelector('#opponent-hand');

  prompt?.setAttribute('aria-live', 'polite');
  verdict?.setAttribute('aria-live', 'assertive');
  verdict?.setAttribute('aria-atomic', 'true');
  overlay?.setAttribute('role', 'dialog');
  overlay?.setAttribute('aria-modal', 'true');
  playerHand?.setAttribute('aria-label', 'Saját kéz');
  opponentHand?.setAttribute('aria-label', 'A gép keze');

  const picker = document.querySelector('#attribute-picker');
  if (picker) {
    new MutationObserver(() => {
      const onlyButton = picker.children.length === 1 ? picker.querySelector(':scope > .btn') : null;
      picker.classList.toggle('has-next-action', Boolean(onlyButton?.textContent.includes('Következő')));
    }).observe(picker, { childList: true });
  }
}

installDocumentUX();
