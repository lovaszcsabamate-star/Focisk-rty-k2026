/** Tartós játékosprofil-állapot, szerkesztő és felületi névszinkronizáció. */

import { APP_STORAGE_KEYS } from './app/configuration.js';
import {
  readStoredString,
  removeStoredValue,
  writeStoredBoolean,
  writeStoredString,
} from './services/storage-service.js';
import { UI, el } from './ui.js';

export const PLAYER_NAME_STORAGE_KEY = APP_STORAGE_KEYS.playerName;
export const PLAYER_PROFILE_SAVED_STORAGE_KEY = APP_STORAGE_KEYS.playerProfileSaved;
export const DEFAULT_PLAYER_NAME = 'Játékos';
export const MAX_PLAYER_NAME_LENGTH = 24;
export const PLAYER_PROFILE_CHANGED_EVENT = 'fociskartyak:player-profile-changed';
export const LEGACY_PLAYER_NAME_CHANGED_EVENT = 'fociskartyak:player-name-changed';

export class PlayerProfileError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PlayerProfileError';
    this.code = code;
  }
}

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

const readStoredName = () => readStoredString(PLAYER_NAME_STORAGE_KEY, null);
const readProfileSavedMarker = () => readStoredString(PLAYER_PROFILE_SAVED_STORAGE_KEY, null);
const playerProfileSnapshot = playerName => Object.freeze({ playerName, isProfileSaved: true });

function playerProfileRestoreStoredValue(key, previousValue) {
  if (previousValue == null) removeStoredValue(key);
  else writeStoredString(key, previousValue);
}

function playerProfileDispatchChange(profile, operation) {
  if (typeof document !== 'undefined') personalizeGameLabels(document);
  if (typeof globalThis.dispatchEvent !== 'function' || typeof globalThis.CustomEvent !== 'function') return;

  const detail = Object.freeze({
    operation,
    hasPlayerProfile: Boolean(profile),
    playerProfile: profile,
    name: profile?.playerName ?? DEFAULT_PLAYER_NAME,
  });
  globalThis.dispatchEvent(new globalThis.CustomEvent(PLAYER_PROFILE_CHANGED_EVENT, { detail }));
  globalThis.dispatchEvent(new globalThis.CustomEvent(LEGACY_PLAYER_NAME_CHANGED_EVENT, { detail }));
}

/**
 * A régi kiadások kizárólag a playerName kulcsot tárolták. Ha ilyen nevet
 * találunk, egyszeri kompatibilitási migrációval mentett profilként jelöljük.
 */
export function hasPlayerProfile() {
  const playerName = normalizePlayerName(readStoredName());
  if (!playerName) return false;

  const marker = readProfileSavedMarker();
  if (marker === 'true') return true;
  if (marker == null) {
    writeStoredBoolean(PLAYER_PROFILE_SAVED_STORAGE_KEY, true);
    return true;
  }
  return false;
}

export function hasSavedPlayerName() {
  return hasPlayerProfile();
}

export function loadPlayerProfile() {
  if (!hasPlayerProfile()) return null;
  const playerName = normalizePlayerName(readStoredName());
  return playerName ? playerProfileSnapshot(playerName) : null;
}

export function loadPlayerName() {
  return loadPlayerProfile()?.playerName ?? DEFAULT_PLAYER_NAME;
}

export function savePlayerProfile(value) {
  const playerName = normalizePlayerName(
    typeof value === 'string' ? value : value?.playerName,
  );
  if (!playerName) {
    throw new PlayerProfileError('PLAYER_NAME_REQUIRED', 'A játékosnév megadása kötelező.');
  }

  const hadPlayerProfile = hasPlayerProfile();
  const previousName = readStoredName();
  const previousMarker = readProfileSavedMarker();

  if (!writeStoredString(PLAYER_NAME_STORAGE_KEY, playerName)) {
    throw new PlayerProfileError('PROFILE_STORAGE_FAILED', 'A játékosprofil mentése nem sikerült. Próbáld újra.');
  }
  if (!writeStoredBoolean(PLAYER_PROFILE_SAVED_STORAGE_KEY, true)) {
    playerProfileRestoreStoredValue(PLAYER_NAME_STORAGE_KEY, previousName);
    playerProfileRestoreStoredValue(PLAYER_PROFILE_SAVED_STORAGE_KEY, previousMarker);
    throw new PlayerProfileError('PROFILE_STORAGE_FAILED', 'A játékosprofil mentése nem sikerült. Próbáld újra.');
  }

  const profile = playerProfileSnapshot(playerName);
  playerProfileDispatchChange(profile, hadPlayerProfile ? 'updated' : 'created');
  return profile;
}

/** Korábbi API-kompatibilitás: a név mentése ma már ugyanazt az egy profilt frissíti. */
export function savePlayerName(value) {
  const playerName = normalizePlayerName(value);
  if (!playerName) {
    deletePlayerProfile();
    return DEFAULT_PLAYER_NAME;
  }
  return savePlayerProfile({ playerName }).playerName;
}

export function deletePlayerProfile() {
  const previousName = readStoredName();
  const previousMarker = readProfileSavedMarker();
  const nameRemoved = removeStoredValue(PLAYER_NAME_STORAGE_KEY);
  const markerRemoved = removeStoredValue(PLAYER_PROFILE_SAVED_STORAGE_KEY);

  if (!nameRemoved || !markerRemoved) {
    playerProfileRestoreStoredValue(PLAYER_NAME_STORAGE_KEY, previousName);
    playerProfileRestoreStoredValue(PLAYER_PROFILE_SAVED_STORAGE_KEY, previousMarker);
    return false;
  }

  playerProfileDispatchChange(null, 'deleted');
  return true;
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
    replaceTextNode(textNode, localizeInterfaceTextValue(textNode.nodeValue));
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
  if (verdict
    && verdict.firstChild?.nodeType === globalThis.Node?.TEXT_NODE
    && /^(?:GÓL A JÁTÉKOSNAK|GÓL:)/u.test(verdict.firstChild.nodeValue ?? '')) {
    replaceTextNode(verdict.firstChild, `GÓL: ${upper}`);
  }
}

function playerProfileCreateStatus(elementFactory) {
  const status = elementFactory('span', 'player-profile__status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  return status;
}

function playerProfileSetStatus(status, message, tone = 'error') {
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function playerProfileCreateForm({
  elementFactory,
  profile,
  submitLabel,
  onSubmit,
  onCancel,
}) {
  const form = elementFactory('form', 'player-profile__form');
  form.noValidate = true;

  const label = elementFactory('label', 'player-profile__label', 'Játékosnév');
  label.htmlFor = 'player-profile-name';
  const input = elementFactory('input', 'player-profile__input');
  input.id = 'player-profile-name';
  input.type = 'text';
  input.name = 'playerName';
  input.value = profile?.playerName ?? '';
  input.placeholder = DEFAULT_PLAYER_NAME;
  input.maxLength = MAX_PLAYER_NAME_LENGTH;
  input.required = true;
  input.autocomplete = 'nickname';
  input.enterKeyHint = 'done';
  input.setAttribute('aria-describedby', 'player-profile-help player-profile-status');

  const help = elementFactory('small', 'player-profile__help', `Kötelező mező, legfeljebb ${MAX_PLAYER_NAME_LENGTH} karakter.`);
  help.id = 'player-profile-help';
  label.append(input, help);

  const actions = elementFactory('div', 'player-profile__form-actions');
  const saveButton = elementFactory('button', 'btn player-profile__save', submitLabel);
  saveButton.type = 'submit';
  const cancelButton = elementFactory('button', 'btn btn--ghost player-profile__cancel', 'Mégse');
  cancelButton.type = 'button';
  cancelButton.addEventListener('click', onCancel);
  actions.append(saveButton, cancelButton);

  const status = playerProfileCreateStatus(elementFactory);
  status.id = 'player-profile-status';
  form.append(label, actions, status);

  form.addEventListener('submit', event => {
    event.preventDefault();
    input.setAttribute('aria-invalid', 'false');
    try {
      const savedProfile = savePlayerProfile({ playerName: input.value });
      playerProfileSetStatus(status, '', 'success');
      onSubmit(savedProfile);
    } catch (error) {
      const message = error instanceof PlayerProfileError
        ? error.message
        : 'A játékosprofil mentése nem sikerült. Próbáld újra.';
      input.setAttribute('aria-invalid', 'true');
      playerProfileSetStatus(status, message, 'error');
      input.focus?.({ preventScroll: true });
    }
  });

  return form;
}

/** Újrafelhasználható profilkomponens a létrehozási panelhez és a Beállításokhoz. */
export function createPlayerProfileEditor({
  context = 'settings',
  elementFactory = el,
  onSaved = () => {},
  onCancel = () => {},
  onDeleteRequest = () => {},
} = {}) {
  if (typeof elementFactory !== 'function') {
    throw new PlayerProfileError('INVALID_ELEMENT_FACTORY', 'A profilkomponens elemgyártó függvénye kötelező.');
  }

  const editor = elementFactory('section', `player-profile player-profile--${context}`);
  editor.dataset.playerProfileEditor = context;
  let editing = context === 'create';

  const render = () => {
    const profile = loadPlayerProfile();
    const isExistingProfile = Boolean(profile);
    editor.replaceChildren();
    editor.append(
      elementFactory('h2', null, '👤 Játékosprofil'),
      elementFactory(
        'p',
        null,
        isExistingProfile
          ? 'A mentett név minden játékmódban és eredményjelzőn egységesen jelenik meg.'
          : 'Hozz létre egy profilt, hogy a saját neved jelenjen meg a mérkőzéseken.',
      ),
    );

    if (!editing && isExistingProfile) {
      const details = elementFactory('dl', 'player-profile__details');
      const row = elementFactory('div', 'player-profile__detail');
      row.append(
        elementFactory('dt', null, 'Játékosnév'),
        elementFactory('dd', null, profile.playerName),
      );
      details.appendChild(row);

      const actions = elementFactory('div', 'player-profile__actions');
      const editButton = elementFactory('button', 'btn player-profile__edit', 'Profil szerkesztése');
      editButton.type = 'button';
      editButton.addEventListener('click', () => {
        editing = true;
        render();
        editor.querySelector?.('input')?.focus?.({ preventScroll: true });
      });
      const deleteButton = elementFactory('button', 'btn btn--danger player-profile__delete', 'Profil törlése');
      deleteButton.type = 'button';
      deleteButton.addEventListener('click', () => onDeleteRequest(profile));
      actions.append(editButton, deleteButton);
      editor.append(details, actions);
      return;
    }

    if (!editing && !isExistingProfile && context === 'settings') {
      const empty = elementFactory('p', 'player-profile__empty', 'Még nincs mentett játékosprofil.');
      const createButton = elementFactory('button', 'btn player-profile__edit', 'Játékosprofil létrehozása');
      createButton.type = 'button';
      createButton.addEventListener('click', () => {
        editing = true;
        render();
        editor.querySelector?.('input')?.focus?.({ preventScroll: true });
      });
      editor.append(empty, createButton);
      return;
    }

    editor.appendChild(playerProfileCreateForm({
      elementFactory,
      profile,
      submitLabel: isExistingProfile ? 'Módosítások mentése' : 'Játékosprofil mentése',
      onSubmit: savedProfile => {
        const operation = isExistingProfile ? 'updated' : 'created';
        onSaved(savedProfile, operation);
        if (context === 'settings') {
          editing = false;
          render();
        }
      },
      onCancel: () => {
        if (context === 'create') onCancel();
        else {
          editing = false;
          render();
        }
      },
    }));
  };

  render();
  return editor;
}

let activePlayerProfileUi = null;

function playerProfileInsertBeforeMenuTitle(panel, node) {
  const title = panel.querySelector?.('.menu-section-title');
  if (title?.parentNode === panel) panel.insertBefore(node, title);
  else panel.appendChild(node);
}

function playerProfileRenderMainAction(ui, panel) {
  const existing = panel.querySelector?.('.player-profile-create-action');
  if (hasPlayerProfile()) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const host = el('div', 'player-profile-create-action');
  host.dataset.playerProfileMode = 'action';
  const button = el('button', 'btn btn--profile');
  button.type = 'button';
  button.append(
    el('span', null, '👤 Játékosprofil létrehozása'),
    el('small', null, 'A saját neved jelenik meg az eredményjelzőn'),
  );
  button.addEventListener('click', () => {
    host.dataset.playerProfileMode = 'editor';
    host.replaceChildren(createPlayerProfileEditor({
      context: 'create',
      onSaved: () => {
        ui.showToast?.('Játékosprofil sikeresen elmentve.', 'success');
        host.remove();
      },
      onCancel: () => {
        host.remove();
        playerProfileRenderMainAction(ui, panel);
      },
    }));
    host.querySelector?.('input')?.focus?.({ preventScroll: true });
  });
  host.appendChild(button);
  playerProfileInsertBeforeMenuTitle(panel, host);
}

function playerProfileRenderDeleteConfirmation(ui, host) {
  const profile = loadPlayerProfile();
  if (!profile) {
    playerProfileRenderSettingsEditor(ui, host);
    return;
  }

  const confirmation = el('section', 'player-profile player-profile-delete-confirm');
  confirmation.append(
    el('h2', null, '👤 Játékosprofil törlése'),
    el('p', null, `Biztosan törlöd a(z) ${profile.playerName} profilt? A meccseredmények és statisztikák megmaradnak.`),
  );
  const actions = el('div', 'player-profile__actions');
  const deleteButton = el('button', 'btn btn--danger', 'Profil törlése');
  deleteButton.type = 'button';
  const cancelButton = el('button', 'btn btn--ghost', 'Mégse');
  cancelButton.type = 'button';
  deleteButton.addEventListener('click', () => {
    if (!deletePlayerProfile()) {
      ui.showToast?.('A játékosprofil törlése nem sikerült.', 'error');
      return;
    }
    ui.showToast?.('A játékosprofil törölve.', 'success');
    playerProfileRenderSettingsEditor(ui, host);
  }, { once: true });
  cancelButton.addEventListener('click', () => playerProfileRenderSettingsEditor(ui, host), { once: true });
  actions.append(deleteButton, cancelButton);
  confirmation.appendChild(actions);
  host.replaceChildren(confirmation);
}

function playerProfileRenderSettingsEditor(ui, host) {
  host.replaceChildren(createPlayerProfileEditor({
    context: 'settings',
    onSaved: (_profile, operation) => {
      ui.showToast?.(
        operation === 'created'
          ? 'Játékosprofil sikeresen elmentve.'
          : 'A profil módosításai elmentve.',
        'success',
      );
      playerProfileRenderSettingsEditor(ui, host);
    },
    onDeleteRequest: () => playerProfileRenderDeleteConfirmation(ui, host),
  }));
}

function playerProfileRenderSettingsSection(ui, panel, force = false) {
  let host = panel.querySelector?.('.player-profile-settings-host');
  if (!host) {
    host = el('div', 'player-profile-settings-host');
    const settingsList = panel.querySelector?.('.settings-list');
    if (settingsList?.parentNode === panel) panel.insertBefore(host, settingsList);
    else panel.appendChild(host);
    playerProfileRenderSettingsEditor(ui, host);
    return;
  }
  if (force) playerProfileRenderSettingsEditor(ui, host);
}

/**
 * Az overlay külső konténert és a tényleges, belehelyezett menüpanelt is elfogadja.
 * Ez megakadályozza, hogy a profil eltűnjön, amikor a UI.showOverlay a panelt egy
 * külön #overlay-body elembe csomagolja.
 */
function syncPlayerProfileSurface(ui, root, force = false) {
  if (!ui || !root) return;
  const homePanel = root.matches?.('.mobile-home')
    ? root
    : root.querySelector?.('.mobile-home');
  const settingsPanel = root.matches?.('.settings-panel')
    ? root
    : root.querySelector?.('.settings-panel');

  if (homePanel) playerProfileRenderMainAction(ui, homePanel);
  if (settingsPanel) playerProfileRenderSettingsSection(ui, settingsPanel, force);
}

/* A név ugyanabban a renderelési ciklusban kerül az eredményjelzőre és az eredménypanelre. */
UI.prototype.renderScores = function renderScoresWithSavedPlayerName(...args) {
  PROFILE_BASE_METHODS.renderScores.apply(this, args);
  personalizeGameLabels(this.dom.pub);
};

UI.prototype.showOverlay = function showOverlayWithSavedPlayerName(node) {
  PROFILE_BASE_METHODS.showOverlay.call(this, node);
  activePlayerProfileUi = this;
  personalizeGameLabels(this.dom.overlayBody ?? document);
  syncPlayerProfileSurface(this, node ?? this.dom.overlayBody);
};

function startPlayerProfile() {
  if (!document.body || document.documentElement.dataset.playerProfileReady === 'true') return;
  document.documentElement.dataset.playerProfileReady = 'true';

  let scheduled = false;
  const frame = callback => {
    if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(callback);
    else globalThis.setTimeout?.(callback, 0);
  };
  const refresh = (force = false) => {
    scheduled = false;
    personalizeGameLabels(document);
    syncPlayerProfileSurface(activePlayerProfileUi, activePlayerProfileUi?.dom?.overlayBody, force);
  };
  const scheduleRefresh = () => {
    if (scheduled) return;
    scheduled = true;
    frame(() => refresh(false));
  };
  const handleProfileChange = () => frame(() => refresh(true));

  new MutationObserver(scheduleRefresh).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  globalThis.addEventListener(PLAYER_PROFILE_CHANGED_EVENT, handleProfileChange);
  globalThis.addEventListener(LEGACY_PLAYER_NAME_CHANGED_EVENT, scheduleRefresh);
  refresh();
}

globalThis.__FOCISKARTYAK_PLAYER_PROFILE__ = Object.freeze({
  hasPlayerProfile,
  load: loadPlayerProfile,
  save: savePlayerProfile,
  delete: deletePlayerProfile,
  loadName: loadPlayerName,
  normalize: normalizePlayerName,
  localize: localizeInterfaceTextValue,
});

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startPlayerProfile, { once: true });
  else startPlayerProfile();
}
