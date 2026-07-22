/** Persistent, centrally rendered player-name profile. */

export const PLAYER_NAME_STORAGE_KEY = 'fociskartyak:player-name:v1';
export const DEFAULT_PLAYER_NAME = 'Játékos';
export const MAX_PLAYER_NAME_LENGTH = 24;

const listeners = new Set();

export function normalizePlayerName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
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
