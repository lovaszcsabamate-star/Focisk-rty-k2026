import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = relative => path.join(ROOT, relative);
const read = relative => fs.readFileSync(file(relative), 'utf8');
const write = (relative, content) => {
  fs.mkdirSync(path.dirname(file(relative)), { recursive: true });
  fs.writeFileSync(file(relative), content.endsWith('\n') ? content : `${content}\n`);
};
const remove = relative => { if (fs.existsSync(file(relative))) fs.rmSync(file(relative)); };
const replaceRequired = (source, needle, replacement, label) => {
  if (!source.includes(needle)) throw new Error(`Nem található a kötelező javítási pont: ${label}`);
  return source.replace(needle, replacement);
};
const replaceRegex = (source, pattern, replacement, label) => {
  if (!pattern.test(source)) throw new Error(`Nem található a kötelező javítási minta: ${label}`);
  return source.replace(pattern, replacement);
};

write('js/player-profile.js', `/** Persistent, centrally rendered player-name profile. */

export const PLAYER_NAME_STORAGE_KEY = 'fociskartyak:player-name:v1';
export const DEFAULT_PLAYER_NAME = 'Játékos';
export const MAX_PLAYER_NAME_LENGTH = 24;

const listeners = new Set();

export function normalizePlayerName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\\s+/g, ' ')
    .trim()
    .slice(0, MAX_PLAYER_NAME_LENGTH);
}

const readStoredName = () => {
  try {
    return localStorage.getItem(PLAYER_NAME_STORAGE_KEY);
  } catch {
    return null;
  }
};

export function hasSavedPlayerName() {
  return Boolean(normalizePlayerName(readStoredName()));
}

export function loadPlayerName() {
  return normalizePlayerName(readStoredName()) || DEFAULT_PLAYER_NAME;
}

function notifyPlayerName(name) {
  for (const listener of listeners) {
    try { listener(name); } catch (error) { console.error('[profile] A névfrissítés sikertelen:', error); }
  }
  globalThis.dispatchEvent?.(new CustomEvent('fociskartyak:player-name-changed', { detail: { name } }));
}

export function savePlayerName(value) {
  const normalized = normalizePlayerName(value);
  try {
    if (normalized) localStorage.setItem(PLAYER_NAME_STORAGE_KEY, normalized);
    else localStorage.removeItem(PLAYER_NAME_STORAGE_KEY);
  } catch {
    // A profil tárolása privát vagy korlátozott böngészőben opcionális.
  }
  const savedName = normalized || DEFAULT_PLAYER_NAME;
  notifyPlayerName(savedName);
  return savedName;
}

export function subscribePlayerName(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function synchronizeProfileInputs(savedName) {
  const visibleValue = hasSavedPlayerName() ? savedName : '';
  document.querySelectorAll('[data-player-profile-input]').forEach(input => {
    if (input.value !== visibleValue) input.value = visibleValue;
  });
}

export function createPlayerNameEditor(context = 'home') {
  const safeContext = String(context).replace(/[^a-z0-9_-]/gi, '-') || 'profile';
  const editor = document.createElement('section');
  editor.className = `player-profile player-profile--${safeContext}`;
  editor.dataset.playerProfileEditor = safeContext;

  const heading = document.createElement('h2');
  heading.textContent = safeContext === 'home' ? '👤 Játékosprofil' : '👤 Játékos neve';

  const description = document.createElement('p');
  description.textContent = safeContext === 'home'
    ? 'Add meg a neved; a játék megjegyzi, és ezt használja az eredményjelzőn.'
    : 'A mentett név minden új és folytatott mérkőzésen megjelenik.';

  const form = document.createElement('form');
  form.className = 'player-profile__form';

  const label = document.createElement('label');
  label.className = 'player-profile__label';
  label.htmlFor = `player-name-${safeContext}`;
  label.textContent = 'Név';

  const input = document.createElement('input');
  input.id = `player-name-${safeContext}`;
  input.className = 'player-profile__input';
  input.dataset.playerProfileInput = safeContext;
  input.type = 'text';
  input.name = 'playerName';
  input.value = hasSavedPlayerName() ? loadPlayerName() : '';
  input.placeholder = DEFAULT_PLAYER_NAME;
  input.maxLength = MAX_PLAYER_NAME_LENGTH;
  input.autocomplete = 'nickname';
  input.enterKeyHint = 'done';
  input.inputMode = 'text';
  input.setAttribute('aria-describedby', `player-name-help-${safeContext}`);

  const help = document.createElement('small');
  help.id = `player-name-help-${safeContext}`;
  help.className = 'player-profile__help';
  help.textContent = `Legfeljebb ${MAX_PLAYER_NAME_LENGTH} karakter. Üresen hagyva: ${DEFAULT_PLAYER_NAME}.`;

  const button = document.createElement('button');
  button.type = 'submit';
  button.className = 'btn player-profile__save';
  button.textContent = 'Név mentése';

  const status = document.createElement('span');
  status.className = 'player-profile__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  label.append(input, help);
  form.append(label, button);
  editor.append(heading, description, form, status);

  let clearTimer = 0;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const savedName = savePlayerName(input.value);
    synchronizeProfileInputs(savedName);
    status.textContent = `Mentve: ${savedName}`;
    clearTimeout(clearTimer);
    clearTimer = window.setTimeout(() => { status.textContent = ''; }, 2200);
  });

  return editor;
}

globalThis.__FOCISKARTYAK_PLAYER_PROFILE__ = Object.freeze({
  load: loadPlayerName,
  save: savePlayerName,
  normalize: normalizePlayerName,
});
`);

write('js/reliability-fixes.js', `/** Pure reliability helpers used directly by the session controller. */

export const SAVED_MATCH_STORAGE_KEY = 'fociskartyak:saved-match:v2';

const LEGACY_OPPONENT_IDS = Object.freeze({
  pub: 'bogdan', regular: 'd-raven', shark: 'h-li',
  easy: 'bogdan', medium: 'd-raven', hard: 'h-li',
});

export function savedOpponentIdFromRawSave(rawValue) {
  try {
    const parsed = JSON.parse(String(rawValue ?? ''));
    const difficulty = typeof parsed?.difficulty === 'string' ? parsed.difficulty.trim() : '';
    return difficulty ? (LEGACY_OPPONENT_IDS[difficulty] ?? difficulty) : null;
  } catch {
    return null;
  }
}

export function syncSavedReliabilityOpponent(rawValue) {
  let raw = rawValue;
  if (raw === undefined) {
    try { raw = localStorage.getItem(SAVED_MATCH_STORAGE_KEY); } catch { raw = null; }
  }
  const opponentId = savedOpponentIdFromRawSave(raw);
  if (opponentId) globalThis.__FOCISKARTYAK_SELECT_OPPONENT__?.(opponentId);
  return opponentId;
}

export function shouldSuppressRestoredVerdictFeedback(ui, game) {
  const recordedRounds = Number(ui?.uxStats?.rounds);
  const resolvedRounds = Array.isArray(game?.log) ? game.log.length : 0;
  return resolvedRounds > 0 && Number.isFinite(recordedRounds) && recordedRounds >= resolvedRounds;
}
`);

write('js/matchday.js', `/** Football-broadcast scoreboard rendered directly from session state. */

import { UI, el } from './ui.js';
import { AI, HUMAN, PHASE } from './engine.js';

const previousClassicScores = UI.prototype._renderClassicScores;
const previousPenaltyScores = UI.prototype._renderPenaltyScores;
const sideLabel = (side, playerName) => side === HUMAN ? playerName : 'Gép';
const otherSide = side => side === HUMAN ? AI : HUMAN;

function scoreboardStatus(game, playerName) {
  if (game.phase === PHASE.GAME_OVER) return 'VÉGEREDMÉNY';
  if (game.phase === PHASE.REVEAL) return `KÖVETKEZŐ VÁLASZTÓ: ${sideLabel(otherSide(game.chooser), playerName).toLocaleUpperCase('hu-HU')}`;
  return `KATEGÓRIÁT VÁLASZT: ${sideLabel(game.chooser, playerName).toLocaleUpperCase('hu-HU')}`;
}

UI.prototype._renderMatchScoreboard = function renderMatchScoreboard(game, human, ai) {
  const playerName = this.playerName;
  const opponentName = globalThis.__FOCISKARTYAK_OPPONENT__?.name ?? 'Gép';
  const board = el('div', `match-scoreboard${game.mode === 'penalties' ? ' match-scoreboard--penalties' : ''}`);
  const status = scoreboardStatus(game, playerName);
  board.setAttribute('role', 'status');
  board.setAttribute('aria-live', 'polite');
  board.setAttribute('aria-label', `${playerName} ${human}, ${opponentName} ${ai}. ${status.toLocaleLowerCase('hu-HU')}.`);

  const opponent = globalThis.__FOCISKARTYAK_OPPONENT__;
  const prefix = opponent && Number.isFinite(opponent.level) && Number.isFinite(opponent.overall)
    ? `${opponent.level}. SZINT · OVR ${opponent.overall} · `
    : '';
  const competition = el('div', 'match-scoreboard__competition', `${prefix}${game.mode === 'penalties' ? 'BÜNTETŐPÁRBAJ' : 'NB I KÁRTYAMECCS'}`);
  const home = el('div', 'match-team match-team--home');
  const homeName = el('span', 'match-team__name', playerName.toLocaleUpperCase('hu-HU'));
  homeName.dataset.playerName = 'upper';
  homeName.title = playerName;
  home.append(el('span', 'match-team__crest', '⚽'), homeName);

  const score = el('div', 'match-scoreboard__score');
  score.append(
    el('strong', 'match-scoreboard__number', String(human)),
    el('span', 'match-scoreboard__separator', '–'),
    el('strong', 'match-scoreboard__number', String(ai)),
  );

  const away = el('div', 'match-team match-team--away');
  away.append(el('span', 'match-team__name', opponentName.toLocaleUpperCase('hu-HU')), el('span', 'match-team__crest', '🤖'));
  const possession = el('div', 'match-scoreboard__status', status);
  board.append(competition, home, score, away, possession);
  return board;
};

UI.prototype._renderClassicScores = function renderClassicMatchScore(game) {
  previousClassicScores.call(this, game);
  const { [HUMAN]: human, [AI]: ai } = game.scores;
  this.dom.hudScores.replaceChildren(this._renderMatchScoreboard(game, human, ai));
};

UI.prototype._renderPenaltyScores = function renderPenaltyMatchScore(game) {
  previousPenaltyScores.call(this, game);
  const human = game.scores[HUMAN];
  const ai = game.scores[AI];
  this.dom.hudScores.replaceChildren(this._renderMatchScoreboard(game, human, ai));
};
`);

let ui = read('js/ui.js');
ui = replaceRequired(ui,
  "import { HUMAN, AI } from './engine.js';",
  "import { HUMAN, AI } from './engine.js';\nimport { DEFAULT_PLAYER_NAME, loadPlayerName, normalizePlayerName } from './player-profile.js';",
  'ui profilimport');
ui = replaceRequired(ui,
  "const finiteDetail = value => typeof value === 'number' && Number.isFinite(value) ? String(value) : null;",
  `const finiteDetail = value => typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
const focusableElements = root => [...(root?.querySelectorAll?.(
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
) ?? [])].filter(node => !node.hidden && node.getAttribute('aria-hidden') !== 'true');`,
  'ui fókuszsegéd');
ui = replaceRequired(ui,
  "    this.mode = 'classic';",
  "    this.mode = 'classic';\n    this.playerName = loadPlayerName();\n    this.interactionBusy = false;",
  'ui központi név');
ui = replaceRequired(ui,
  `  setSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    this._renderSettings();
  }
`,
  `  setSettings(settings) {
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
    const toast = el('div', \`ux-toast ux-toast--\${tone}\`, message);
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
`,
  'ui központi állapotmetódusok');
ui = replaceRequired(ui,
  `  resetTable() {
    this.closeInspector();`,
  `  resetTable() {
    this.closeInspector();
    this.setPhaseState('idle');
    this.setInteractionBusy(false);`,
  'ui reset állapot');
ui = replaceRequired(ui,
  `  openInspector(hand, index, opts = {}) {
    this.inspector = { hand, index, opts };
    this._renderInspector();
  }

  closeInspector() {
    this.inspector = null;
    $('#inspector')?.remove();
    if (this._inspectorKeys) document.removeEventListener('keydown', this._inspectorKeys);
    this._inspectorKeys = null;
  }`,
  `  openInspector(hand, index, opts = {}) {
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
  }`,
  'ui inspector nyitás-zárás');
ui = replaceRegex(ui,
  /  _renderInspector\(\) \{[\s\S]*?\n  \}\n\n  renderHands/,
  `  _renderInspector() {
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
    centre.appendChild(el('div', 'inspector__counter', \`\${index + 1}/\${hand.length} kártya\`));

    const detailLines = [
      ['🟥 Egyenes piros / MLSZ piros', finiteDetail(card.stats.redCards)],
      ['🟨🟥 Második sárga miatti kiállítás', finiteDetail(card.stats.secondYellowRedCards)],
    ].filter(([, value]) => value != null);
    if (detailLines.length) {
      const details = el('div', 'inspector__details');
      details.append(...detailLines.map(([label, value]) => el('span', null, \`\${label}: \${value}\`)));
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

  renderHands`,
  'ui inspector közvetlen integráció');
ui = ui
  .replace("this._scoreChip('Játékos', human, human > ai)", "this._scoreChip(this.playerName, human, human > ai)")
  .replace("el('div', 'penalty-score', `JÁTÉKOS ${human}–${ai} GÉP`)", "el('div', 'penalty-score', `${this.playerName.toLocaleUpperCase('hu-HU')} ${human}–${ai} GÉP`)")
  .replace("side === HUMAN ? 'JÁTÉKOS' : 'GÉP'", "side === HUMAN ? this.playerName.toLocaleUpperCase('hu-HU') : 'GÉP'")
  .replace("el('div', 'duel-slot__who', 'Játékos')", "el('div', 'duel-slot__who', this.playerName)")
  .replace("isPenalty ? 'GÓL A JÁTÉKOSNAK' : 'A TIÉD A KÖR'", "isPenalty ? `GÓL: ${this.playerName.toLocaleUpperCase('hu-HU')}` : 'A TIÉD A KÖR'");
write('js/ui.js', ui);

let ux = read('js/ux.js');
ux = replaceRequired(ux,
  "  this.dom.pub.classList.remove('ux-banter-open');",
  "  this.dom.pub.classList.remove('ux-banter-open', 'is-card-selection', 'is-battle-active', 'is-duel-focus', 'is-battle-transition');\n  this.dom.playerHand.classList.remove('hand--selection');",
  'ux reset fázis');
ux = replaceRequired(ux,
  `  const activate = event => {
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    if (event.type === 'keydown') event.preventDefault();
    if (event.target.closest?.('.card__inspect')) return;
    if (directPlay) directPlay(card);
    else inspect?.(card);
  };`,
  `  const markSelected = () => {
    if (!directPlay) return;
    for (const choice of this.dom.playerHand.querySelectorAll('.card--choice')) {
      const selected = choice === node;
      choice.classList.toggle('is-selected', selected);
      choice.setAttribute('aria-pressed', String(selected));
    }
  };
  const activate = event => {
    if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    if (event.type === 'keydown') event.preventDefault();
    if (event.target.closest?.('.card__inspect')) return;
    markSelected();
    if (directPlay) directPlay(card);
    else inspect?.(card);
  };
  node.addEventListener('pointerdown', markSelected, { passive: true });`,
  'ux célzott kiválasztás');
ux = replaceRequired(ux,
  `  if (directPlay) {
    node.classList.add('selectable', 'card--direct-play');`,
  `  if (directPlay) {
    node.classList.add('selectable', 'card--direct-play', 'card--choice');
    node.setAttribute('aria-pressed', 'false');`,
  'ux választókártya osztály');
ux = replaceRequired(ux,
  `  if (selectable) this._uxSetStep(2);`,
  `  this.dom.pub.classList.toggle('is-card-selection', selectable);
  this.dom.playerHand.classList.toggle('hand--selection', selectable);
  if (selectable) {
    this.dom.pub.classList.remove('is-battle-active', 'is-duel-focus');
    this.dom.playerHand.setAttribute('aria-label', 'Választható játékoskártyák. Húzd oldalra a sort, majd koppints egy lapra.');
    this._uxSetStep(2);
  } else {
    this.dom.playerHand.removeAttribute('aria-label');
  }`,
  'ux közvetlen fázisjelölés');
ux = replaceRequired(ux,
  "UI.prototype.showVerdict = function showFriendlyVerdict(result, game) {",
  "UI.prototype.showVerdict = function showFriendlyVerdict(result, game, { silent = false, skipRecord = false } = {}) {",
  'ux verdict opciók');
ux = ux
  .replace("    this.playSound('tie');", "    if (!silent) this.playSound('tie');")
  .replace("    this.playSound('win');", "    if (!silent) this.playSound('win');")
  .replace("    this.playSound('loss');", "    if (!silent) this.playSound('loss');")
  .replace("  this._uxRecordResult(result);", "  if (!skipRecord) this._uxRecordResult(result);");
write('js/ux.js', ux);

let mobile = read('js/mobile-experience.js');
mobile = replaceRegex(mobile,
  /const installFastAiTurnTimer = \(\) => \{[\s\S]*?\n\};\n\nconst installAiTurnRecovery = \(\) => \{[\s\S]*?\n\};\n\n/,
  '',
  'globális időzítő és újratöltés eltávolítása');
mobile = mobile.replace("  openInspector: UI.prototype.openInspector,\n  closeInspector: UI.prototype.closeInspector,\n", '');
mobile = replaceRegex(mobile,
  /UI\.prototype\.setInteractionBusy = function setInteractionBusy[\s\S]*?UI\.prototype\.vibrate = function vibrate\(pattern\) \{[\s\S]*?\n\};\n\n/,
  '',
  'mobil duplikált megbízhatósági metódusok');
mobile = mobile.replace("game.mode === 'penalties' ? 'Tizenegyes mód' : 'Klasszikus mód'", "game.mode === 'penalties' ? 'Büntetőpárbaj' : 'Klasszikus mód'");
mobile = mobile.replace(
  'UI.prototype.showVerdict = function showMobileVerdict(result, game) {\n  baseMethods.showVerdict.call(this, result, game);',
  'UI.prototype.showVerdict = function showMobileVerdict(result, game, options = {}) {\n  baseMethods.showVerdict.call(this, result, game, options);');
mobile = mobile.replace("  if (result.winner === HUMAN) this.vibrate([35, 40, 35]);\n  else if (result.winner === 'ai') this.vibrate(70);\n  else this.vibrate(30);", "  if (!options.silent) {\n    if (result.winner === HUMAN) this.vibrate([35, 40, 35]);\n    else if (result.winner === 'ai') this.vibrate(70);\n    else this.vibrate(30);\n  }");
mobile = replaceRegex(mobile,
  /UI\.prototype\.openInspector = function openMobileInspector[\s\S]*?UI\.prototype\.closeInspector = function closeMobileInspector[\s\S]*?\n\};\n\n/,
  '',
  'mobil inspector felülírások');
mobile = mobile.replace('installFastAiTurnTimer();\ninstallAiTurnRecovery();\n', '');
write('js/mobile-experience.js', mobile);

let main = read('js/main.js');
main = replaceRequired(main,
  `  writeSavedMatch,
} from './mobile-experience.js';`,
  `  writeSavedMatch,
  adjustedTurnDelay,
} from './mobile-experience.js';
import {
  createPlayerNameEditor,
  loadPlayerName,
  savePlayerName,
  subscribePlayerName,
} from './player-profile.js';
import { syncSavedReliabilityOpponent } from './reliability-fixes.js';`,
  'main profil és megbízhatóság import');
main = replaceRequired(main,
  `    this.busy = false;
    this.game = null;`,
  `    this.busy = false;
    this.actionToken = 0;
    this.game = null;
    this.playerName = loadPlayerName();
    this.ui.setPlayerName(this.playerName);
    this.unsubscribePlayerName = subscribePlayerName(name => {
      this.playerName = name;
      this.ui.setPlayerName(name);
      this.saveCurrentGame();
    });`,
  'main központi profilállapot');
main = replaceRequired(main,
  `  delay(milliseconds) {
    return wait(this.settings.animations ? milliseconds : Math.min(milliseconds, 90));
  }`,
  `  delay(milliseconds) {
    if (!this.settings.animations || document.documentElement.classList.contains('ux-reduced-motion')) return Promise.resolve();
    return wait(adjustedTurnDelay(milliseconds, this.ui.dom.prompt?.textContent ?? ''));
  }`,
  'main célzott időzítés');
main = main
  .replace("      this.ui.showToast('Váratlan hiba történt. A játékállást megőriztük.', 'error', 3200);\n      this.saveCurrentGame();", "      this.saveCurrentGame();\n      this.busy = false;\n      this.ui.recoverInteraction();\n      this.ui.showToast('Váratlan hiba történt. A játékállást megőriztük. Folytathatod vagy újraindíthatod a mérkőzést.', 'error', 4200);")
  .replace("      this.ui.showToast('Egy művelet nem fejeződött be. Próbáld újra.', 'error', 3200);\n      this.saveCurrentGame();", "      this.saveCurrentGame();\n      this.busy = false;\n      this.ui.recoverInteraction();\n      this.ui.showToast('Egy művelet nem fejeződött be. A mentés megmaradt; próbáld újra.', 'error', 3800);");
main = main
  .replace("${saved.mode === 'penalties' ? 'Tizenegyes mód' : 'Klasszikus mód'}", "${saved.mode === 'penalties' ? 'Büntetőpárbaj' : 'Klasszikus mód'}")
  .replace('<button class="btn mode-start" id="penalties-btn"><span>⚽ Penalties mód</span><small>11 lap, öt rendes párbaj</small></button>', '<button class="btn mode-start" id="penalties-btn"><span>⚽ Büntetőpárbaj</span><small>11 lap, öt rendes párbaj</small></button>')
  .replace("['🎮', 'Válassz játékmódot', 'A Klasszikus mód hosszabb kártyameccs, a Penalties gyors tizenegyespárbaj.']", "['🎮', 'Válassz játékmódot', 'A Klasszikus mód hosszabb kártyameccs, a Büntetőpárbaj gyorsabb, 11 lapos játékmód.']")
  .replace('<h2>⚽ Penalties mód</h2>', '<h2>⚽ Büntetőpárbaj</h2>')
  .replace("${this.mode === 'penalties' ? 'Tizenegyes mód' : 'Klasszikus mód'}", "${this.mode === 'penalties' ? 'Büntetőpárbaj' : 'Klasszikus mód'}")
  .replace('<p class="eyebrow">Penalties mód</p>', '<p class="eyebrow">Büntetőpárbaj</p>');
main = replaceRequired(main,
  `    panel.querySelector('#continue-btn')?.addEventListener('click', () => this.resumeSavedMatch(), { once: true });`,
  `    const homeProfile = createPlayerNameEditor('home');
    const intro = [...panel.children].find(node => node.tagName === 'P' && !node.classList.contains('eyebrow'));
    if (intro) intro.after(homeProfile);
    else panel.prepend(homeProfile);

    panel.querySelector('#continue-btn')?.addEventListener('click', () => this.resumeSavedMatch(), { once: true });`,
  'main profil a főmenüben');
main = replaceRequired(main,
  `    const list = panel.querySelector('.settings-list');`,
  `    const list = panel.querySelector('.settings-list');
    list.before(createPlayerNameEditor('settings'));`,
  'main profil a beállításokban');
main = replaceRequired(main,
  `  start(mode, difficulty) {
    clearSavedMatch();`,
  `  start(mode, difficulty) {
    clearSavedMatch();
    this.actionToken += 1;
    this.playerName = loadPlayerName();
    this.ui.setPlayerName(this.playerName);`,
  'main indulási token');
main = replaceRequired(main,
  `  beginRound() {
    const game = this.game;`,
  `  beginRound() {
    const game = this.game;
    this.actionToken += 1;
    this.ui.setPhaseState('idle');`,
  'main körfázis reset');
main = replaceRequired(main,
  `    this.ui.renderHands(this.game, { selectable: true, inspectAttribute: attributeKey });
    this.awaitingChooserCard = true;`,
  `    this.ui.renderHands(this.game, { selectable: true, inspectAttribute: attributeKey });
    this.ui.setPhaseState('selection');
    this.awaitingChooserCard = true;`,
  'main emberi kártyaválasztás');
main = replaceRequired(main,
  `    this.ui.renderHands(game, { selectable: true });
    this.awaitingChooserCard = false;`,
  `    this.ui.renderHands(game, { selectable: true });
    this.ui.setPhaseState('selection');
    this.awaitingChooserCard = false;`,
  'main gépi kategória után választás');
main = replaceRequired(main,
  `  async humanPlayedCard(card) {
    if (this.busy || !this.game || this.game.phase === PHASE.GAME_OVER) return;
    this.busy = true;
    this.ui.setInteractionBusy(true);
    let result;

    try {`,
  `  async humanPlayedCard(card) {
    if (this.busy || !this.game || this.game.phase === PHASE.GAME_OVER) return;
    const game = this.game;
    const token = ++this.actionToken;
    this.busy = true;
    this.ui.setInteractionBusy(true);
    const transitionDelay = this.ui.beginBattleTransition(card.id);
    if (transitionDelay) await wait(transitionDelay);
    if (this.game !== game || token !== this.actionToken) return;
    let result;

    try {`,
  'main egyszeri kijátszás');
main = main
  .replace("        this.ui.showDuel(this.game, { opponentHidden: true });\n        this.ui.renderHands(this.game, { selectable: false });", "        this.ui.finishBattleTransition();\n        this.ui.showDuel(this.game, { opponentHidden: true });\n        this.ui.renderHands(this.game, { selectable: false });")
  .replace("        result = this.game.playCard(HUMAN, card.id);\n        this.ui.renderHands(this.game, { selectable: false });", "        result = this.game.playCard(HUMAN, card.id);\n        this.ui.finishBattleTransition();\n        this.ui.renderHands(this.game, { selectable: false });");
main = replaceRequired(main,
  `      this.busy = false;
      this.ui.setInteractionBusy(false);
      this.ui.showToast('A kört nem sikerült lezárni. Próbáld újra.', 'error');`,
  `      this.busy = false;
      this.ui.recoverInteraction();
      this.ui.setPhaseState('selection');
      this.ui.showToast('A kört nem sikerült lezárni. A játékállás megmaradt; próbáld újra.', 'error', 3600);`,
  'main körhiba helyreállítás');
main = replaceRequired(main,
  `  async revealAndScore(result) {
    this.ui.showDuel(this.game, { result });`,
  `  async revealAndScore(result) {
    this.ui.finishBattleTransition();
    this.ui.showDuel(this.game, { result });`,
  'main csatafázis');
main = replaceRequired(main,
  `      uxStats: this.ui.uxStats,
    });`,
  `      uxStats: this.ui.uxStats,
      playerName: this.playerName,
    });`,
  'main név mentése');
main = replaceRequired(main,
  `  resumeSavedMatch() {
    const saved = readSavedMatch();`,
  `  resumeSavedMatch() {
    syncSavedReliabilityOpponent();
    const saved = readSavedMatch();`,
  'main ellenfél-visszatöltés');
main = replaceRequired(main,
  `      this.mode = saved.mode;
      this.difficulty = validDifficulty(saved.difficulty) ? saved.difficulty : selectedOpponentDifficulty();`,
  `      this.mode = saved.mode;
      if (saved.playerName) this.playerName = savePlayerName(saved.playerName);
      else this.playerName = loadPlayerName();
      this.ui.setPlayerName(this.playerName);
      this.difficulty = validDifficulty(saved.difficulty) ? saved.difficulty : selectedOpponentDifficulty();`,
  'main név visszatöltése');
main = main.replace("      clearSavedMatch();\n      this.ui.showToast('A mentés sérült, ezért új játék szükséges.', 'error', 3400);", "      this.ui.showToast('A mentés nem olvasható. Nem töröltük; új játék indítása előtt a Beállításokban eltávolítható.', 'error', 4300);");
main = replaceRequired(main,
  `      this.ui.showVerdict(game.lastResult, game);`,
  `      this.ui.showVerdict(game.lastResult, game, { silent: true, skipRecord: true });`,
  'main visszatöltött eredmény némítása');
main = replaceRequired(main,
  `    const panel = el('div', \`result-panel \${won ? 'result-panel--win' : 'result-panel--loss'}\`);`,
  `    const resultTone = result.winner === 'tie' ? 'tie' : (won ? 'win' : 'loss');
    const panel = el('div', \`result-panel result-panel--\${resultTone}\`);`,
  'main döntetlen eredménystílus');
main = main
  .replace('<div class="final-score">JÁTÉKOS ${result.human}–${result.ai} GÉP</div>', '<div class="final-score"><span data-player-name="upper"></span> ${result.human}–${result.ai} GÉP</div>');
main = replaceRequired(main,
  `    panel.querySelector('#rematch-btn').addEventListener('click', () => this.start(this.mode, this.difficulty), { once: true });`,
  `    const finalName = panel.querySelector('[data-player-name]');
    if (finalName) {
      finalName.textContent = this.playerName.toLocaleUpperCase('hu-HU');
      finalName.title = this.playerName;
    }
    panel.querySelector('#rematch-btn').addEventListener('click', () => this.start(this.mode, this.difficulty), { once: true });`,
  'main biztonságos végeredménynév');
main = replaceRequired(main,
  `const { players, source, meta } = await loadPlayers();
new Session(players, source, meta);`,
  `const { players, source, meta } = await loadPlayers();
const session = new Session(players, source, meta);
if (new URLSearchParams(location.search).has('e2e')) globalThis.__FOCISKARTYAK_SESSION__ = session;`,
  'main e2e munkamenet');
write('js/main.js', main);

let penalties = read('js/penalties.js');
penalties = penalties.replace('A Penalties mód két külön csapatához', 'A Büntetőpárbaj két külön csapatához');
write('js/penalties.js', penalties);

const mergedCssFiles = [
  'css/mobile-experience.css',
  'css/mobile-overlay-fix.css',
  'css/player-profile.css',
  'css/focus-experience.css',
  'css/mobile-selection-fix.css',
  'css/duel-emphasis.css',
  'css/phase-refinements.css',
];
const mergedCss = mergedCssFiles.map(relative => `/* ===== Beolvasztva: ${relative} ===== */\n${read(relative).trim()}`).join('\n\n') + `

/* ===== Stabil béta: közös biztonsági szabályok ===== */
html, body { max-width: 100%; overflow-x: clip; }
[data-player-name], .match-team__name, .duel-slot__who, .final-score {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
`;
write('css/mobile-experience.css', mergedCss);
for (const relative of mergedCssFiles.slice(1)) remove(relative);

let index = read('index.html');
for (const relative of mergedCssFiles.slice(1)) {
  index = index.replace(`\n  <link rel="stylesheet" href="${relative.replace('css/', 'css/')}">`, '');
}
for (const script of ['js/usability-fixes.js', 'js/focus-experience.js', 'js/reliability-fixes.js', 'js/player-profile.js']) {
  index = index.replace(`\n  <script type="module" src="${script}"></script>`, '');
}
write('index.html', index);
remove('js/usability-fixes.js');
remove('js/focus-experience.js');

let sw = read('sw.js');
sw = sw.replace("const PWA_CACHE = 'fociskartyak-2026-v42';", "const PWA_CACHE = 'fociskartyak-2026-v43';");
for (const relative of mergedCssFiles.slice(1)) sw = sw.replace(`  './${relative}',\n`, '');
for (const relative of ['js/usability-fixes.js', 'js/focus-experience.js']) sw = sw.replace(`  './${relative}',\n`, '');
write('sw.js', sw);

let build = read('scripts/build-standalone.mjs');
build = build.replace("  'js/ui.js',", "  'js/player-profile.js',\n  'js/reliability-fixes.js',\n  'js/ui.js',");
for (const line of ["  'js/player-profile.js',\n", "  'js/reliability-fixes.js',\n", "  'js/usability-fixes.js',\n", "  'js/focus-experience.js',\n"]) {
  const first = build.indexOf(line);
  const second = build.indexOf(line, first + line.length);
  if (second >= 0) build = build.slice(0, second) + build.slice(second + line.length);
}
build = build.replace("const reviewGeneratedAt = new Date().toISOString();", "const reviewGeneratedAt = enrichmentParts.at(-1)?.generatedAt ?? basePayload.generatedAt ?? '2026-07-22T00:00:00.000Z';");
build = replaceRegex(build,
  /let css = `\$\{read\('css\/style\.css'\)\}[\s\S]*?\$\{read\('css\/phase-refinements\.css'\)\}`;/,
  "let css = `${read('css/style.css')}\\n\\n${read('css/ux.css')}\\n\\n${read('css/matchday.css')}\\n\\n${read('css/opponents.css')}\\n\\n${read('css/pwa.css')}\\n\\n${read('css/mobile-experience.css')}`;",
  'standalone CSS-lista');
for (const relative of mergedCssFiles.slice(1)) build = build.replace(`  .replace('\\n  <link rel="stylesheet" href="${relative}">', '')\n`, '');
for (const relative of ['js/player-profile.js', 'js/reliability-fixes.js', 'js/usability-fixes.js', 'js/focus-experience.js']) {
  build = build.replace(`  .replace('  <script type="module" src="${relative}"></script>\\n', '')\n`, '');
}
write('scripts/build-standalone.mjs', build);

let launcher = read('JATEK_INDITASA.bat');
launcher = replaceRequired(launcher,
  `start "" "%GAME%"
endlocal`,
  `if /I "%~1"=="--check" (
  echo RENDBEN: A Fociskartyak2026.html megtalalhato.
  exit /b 0
)

start "" "%GAME%"
endlocal`,
  'Windows indító ellenőrzési mód');
write('JATEK_INDITASA.bat', launcher);

console.log('A központi béta-stabilizációs javítások alkalmazva.');
