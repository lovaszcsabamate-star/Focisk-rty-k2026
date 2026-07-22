/** Persistent player-name profile, Hungarian mode labels and DOM personalization. */

import { UI } from './ui.js';

export const PLAYER_NAME_STORAGE_KEY = 'fociskartyak:player-name:v1';
export const DEFAULT_PLAYER_NAME = 'Játékos';
export const MAX_PLAYER_NAME_LENGTH = 24;

const PROFILE_BASE_METHODS = Object.freeze({
  renderScores: UI.prototype.renderScores,
  showOverlay: UI.prototype.showOverlay,
});

const INTERFACE_TEXT_REPLACEMENTS = Object.freeze([
  [
    'A Klasszikus mód hosszabb kártyameccs, a Penalties gyors tizenegyespárbaj.',
    'A Klasszikus mód hosszabb kártyameccs, a Büntetőpárbaj gyorsabb, 11 lapos játékmód.',
  ],
  ['Penalties mód', 'Büntetőpárbaj'],
  ['Tizenegyes mód', 'Büntetőpárbaj'],
  ['Penalties', 'Büntetőpárbaj'],
  ['tizenegyespárbaj', 'büntetőpárbaj'],
]);

export function normalizePlayerName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PLAYER_NAME_LENGTH);
}

export function localizeInterfaceTextValue(value) {
  return INTERFACE_TEXT_REPLACEMENTS.reduce(
    (text, [source, replacement]) => text.replaceAll(source, replacement),
    String(value ?? ''),
  );
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

export function savePlayerName(value) {
  const normalized = normalizePlayerName(value);
  try {
    if (normalized) localStorage.setItem(PLAYER_NAME_STORAGE_KEY, normalized);
    else localStorage.removeItem(PLAYER_NAME_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in restricted or private browser contexts.
  }
  return normalized || DEFAULT_PLAYER_NAME;
}

const upperName = () => loadPlayerName().toLocaleUpperCase('hu-HU');
const scorePair = value => String(value ?? '').match(/(\d+)\s*[–-]\s*(\d+)/u);

function replaceTextNode(node, value) {
  if (node && node.nodeValue !== value) node.nodeValue = value;
}

function setNodeText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function setFullNameHint(node, name) {
  if (!node) return;
  node.title = name;
  node.setAttribute('aria-label', name);
}

function localizeInterfaceText(root = document) {
  if (!root?.createTreeWalker && !root?.ownerDocument?.createTreeWalker) return;
  const documentRoot = root.nodeType === 9 ? root : root.ownerDocument;
  const walker = documentRoot.createTreeWalker(root, globalThis.NodeFilter?.SHOW_TEXT ?? 4);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  for (const textNode of textNodes) {
    const parentTag = textNode.parentElement?.tagName;
    if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'TEXTAREA') continue;
    const localized = localizeInterfaceTextValue(textNode.nodeValue);
    replaceTextNode(textNode, localized);
  }

  for (const node of root.querySelectorAll?.('[title], [aria-label]') ?? []) {
    for (const attribute of ['title', 'aria-label']) {
      if (!node.hasAttribute(attribute)) continue;
      const current = node.getAttribute(attribute);
      const localized = localizeInterfaceTextValue(current);
      if (localized !== current) node.setAttribute(attribute, localized);
    }
  }
}

function personalizeGameLabels(root = document) {
  localizeInterfaceText(root);

  const name = loadPlayerName();
  const upper = upperName();

  const classicScore = root.querySelector?.('#hud-scores .score:first-child span:first-child');
  setNodeText(classicScore, name);
  setFullNameHint(classicScore, name);

  const penaltyScore = root.querySelector?.('#hud-scores .penalty-score');
  if (penaltyScore) {
    const score = scorePair(penaltyScore.textContent);
    if (score) setNodeText(penaltyScore, `${upper} ${score[1]}–${score[2]} GÉP`);
    setFullNameHint(penaltyScore, `${name} – Gép`);
  }

  const humanDuelLabel = root.querySelector?.('#duel .duel-slot:first-child .duel-slot__who');
  setNodeText(humanDuelLabel, name);
  setFullNameHint(humanDuelLabel, name);

  const humanAttemptLabel = root.querySelector?.('#penalty-board .attempt-row:first-child strong');
  setNodeText(humanAttemptLabel, upper);
  setFullNameHint(humanAttemptLabel, name);

  for (const finalScore of root.querySelectorAll?.('.final-score') ?? []) {
    const score = scorePair(finalScore.textContent);
    if (score) setNodeText(finalScore, `${upper} ${score[1]}–${score[2]} GÉP`);
    setFullNameHint(finalScore, `${name} – Gép`);
  }

  const verdict = root.querySelector?.('#verdict.win');
  if (verdict && verdict.firstChild?.nodeType === Node.TEXT_NODE && /^(?:GÓL A JÁTÉKOSNAK|GÓL:)/u.test(verdict.firstChild.nodeValue ?? '')) {
    replaceTextNode(verdict.firstChild, `GÓL: ${upper}`);
  }
}

/* Apply the saved name in the same synchronous render pass that creates the
   scoreboard or the final-result overlay. The MutationObserver remains as a
   fallback, but these hooks prevent a temporary or persistent "Játékos" label
   in Android WebViews where animation frames may be delayed. */
UI.prototype.renderScores = function renderScoresWithSavedPlayerName(...args) {
  PROFILE_BASE_METHODS.renderScores.apply(this, args);
  personalizeGameLabels(this.dom.pub);
};

UI.prototype.showOverlay = function showOverlayWithSavedPlayerName(node) {
  PROFILE_BASE_METHODS.showOverlay.call(this, node);
  personalizeGameLabels(this.dom.overlayBody ?? document);
};

function showInlineStatus(editor, message) {
  const status = editor.querySelector('.player-profile__status');
  if (!status) return;
  status.textContent = message;
  clearTimeout(status._clearTimer);
  status._clearTimer = setTimeout(() => { status.textContent = ''; }, 2200);
}

function createNameEditor(context) {
  const editor = document.createElement('section');
  editor.className = `player-profile player-profile--${context}`;
  editor.dataset.playerProfileEditor = context;

  const heading = document.createElement('h2');
  heading.textContent = context === 'home' ? '👤 Játékosprofil' : '👤 Játékos neve';

  const description = document.createElement('p');
  description.textContent = context === 'home'
    ? 'Add meg a neved; a játék megjegyzi, és ezt használja az eredményjelzőn.'
    : 'A mentett név minden új és folytatott mérkőzésen megjelenik.';

  const form = document.createElement('form');
  form.className = 'player-profile__form';

  const label = document.createElement('label');
  label.className = 'player-profile__label';
  label.htmlFor = `player-name-${context}`;
  label.textContent = 'Név';

  const input = document.createElement('input');
  input.id = `player-name-${context}`;
  input.className = 'player-profile__input';
  input.type = 'text';
  input.name = 'playerName';
  input.value = hasSavedPlayerName() ? loadPlayerName() : '';
  input.placeholder = DEFAULT_PLAYER_NAME;
  input.maxLength = MAX_PLAYER_NAME_LENGTH;
  input.autocomplete = 'nickname';
  input.enterKeyHint = 'done';
  input.setAttribute('aria-describedby', `player-name-help-${context}`);

  const help = document.createElement('small');
  help.id = `player-name-help-${context}`;
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

  form.addEventListener('submit', event => {
    event.preventDefault();
    const savedName = savePlayerName(input.value);
    input.value = hasSavedPlayerName() ? savedName : '';
    personalizeGameLabels(document);
    document.querySelectorAll('[data-player-profile-editor] .player-profile__input').forEach(field => {
      field.value = hasSavedPlayerName() ? savedName : '';
    });
    showInlineStatus(editor, `Mentve: ${savedName}`);
    globalThis.dispatchEvent?.(new CustomEvent('fociskartyak:player-name-changed', { detail: { name: savedName } }));
  });

  return editor;
}

function injectEditors() {
  const home = document.querySelector('.mobile-home');
  if (home && !home.querySelector('[data-player-profile-editor="home"]')) {
    const editor = createNameEditor('home');
    const intro = [...home.children].find(node => node.tagName === 'P' && !node.classList.contains('eyebrow'));
    if (intro) intro.after(editor);
    else home.prepend(editor);
  }

  const settings = document.querySelector('.settings-panel');
  if (settings && !settings.querySelector('[data-player-profile-editor="settings"]')) {
    const editor = createNameEditor('settings');
    const list = settings.querySelector('.settings-list');
    if (list) list.before(editor);
    else settings.append(editor);
  }
}

function startPlayerProfile() {
  if (!document.body || document.documentElement.dataset.playerProfileReady === 'true') return;
  document.documentElement.dataset.playerProfileReady = 'true';

  let scheduled = false;
  const refresh = () => {
    scheduled = false;
    injectEditors();
    personalizeGameLabels(document);
  };
  const scheduleRefresh = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  };

  new MutationObserver(scheduleRefresh).observe(document.body, { childList: true, subtree: true, characterData: true });
  globalThis.addEventListener('fociskartyak:player-name-changed', scheduleRefresh);
  refresh();
}

globalThis.__FOCISKARTYAK_PLAYER_PROFILE__ = Object.freeze({
  load: loadPlayerName,
  save: savePlayerName,
  normalize: normalizePlayerName,
  localize: localizeInterfaceTextValue,
});

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startPlayerProfile, { once: true });
  else startPlayerProfile();
}
