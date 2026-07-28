/** Mobile-first experience helpers layered on top of the existing game UI. */

import {
  DEFAULT_EXPERIENCE_SETTINGS,
  APP_STORAGE_KEYS,
  settingStorageKey,
} from './app/configuration.js';
import { readStoredBoolean, writeStoredBoolean } from './services/storage-service.js';
import {
  clearSavedMatch, hydrateGame, readSavedMatch, writeSavedMatch,
} from './services/season-save-service.js';

export { clearSavedMatch, hydrateGame, readSavedMatch, writeSavedMatch };
import { UI, el } from './ui.js';
import {
  ATTRIBUTES,
  attributeValue,
  formatAttribute,
  hasAttributeData,
} from './data/players.js';
import { HUMAN } from './engine.js';

const CONNECTIVITY_BADGE_FLAG = '__FOCISKARTYAK_CONNECTIVITY_BADGE__';

export const STORAGE_KEYS = Object.freeze({
  save: APP_STORAGE_KEYS.savedMatch,
  onboarding: APP_STORAGE_KEYS.onboardingComplete,
});

export const DEFAULT_SETTINGS = DEFAULT_EXPERIENCE_SETTINGS;

export const loadBooleanSetting = (key, fallback) => readStoredBoolean(settingStorageKey(key), fallback);

export const saveBooleanSetting = (key, value) => writeStoredBoolean(settingStorageKey(key), value);

export function loadSettings() {
  return Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => [
    key,
    loadBooleanSetting(key, fallback),
  ]));
}

export function applyExperienceSettings(settings = {}) {
  const root = document.documentElement;
  const reducedBySystem = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  root.classList.toggle('ux-large-text', Boolean(settings.largeText));
  root.classList.toggle('ux-simplified', Boolean(settings.simplified));
  root.classList.toggle('ux-reduced-motion', !settings.animations || reducedBySystem);
}

export function onboardingWasCompleted() {
  return readStoredBoolean(STORAGE_KEYS.onboarding, false);
}

export function setOnboardingCompleted(value) {
  writeStoredBoolean(STORAGE_KEYS.onboarding, value);
}

export function installConnectivityBadge() {
  const installed = globalThis[CONNECTIVITY_BADGE_FLAG];
  if (installed?.isConnected) return installed;

  const existing = document.querySelector('#connectivity-status');
  const badge = existing ?? el('div', 'connectivity-status');
  badge.id = 'connectivity-status';
  badge.setAttribute('role', 'status');
  badge.setAttribute('aria-live', 'polite');
  if (!existing) document.body.appendChild(badge);

  let timer = null;
  const update = () => {
    const offline = navigator.onLine === false;
    badge.textContent = offline ? 'Offline mód – a játék továbbra is működik' : 'Újra online';
    badge.classList.toggle('is-offline', offline);
    badge.classList.add('is-visible');
    clearTimeout(timer);
    timer = setTimeout(() => badge.classList.remove('is-visible'), offline ? 3200 : 1800);
  };

  window.addEventListener('offline', update);
  window.addEventListener('online', update);
  if (navigator.onLine === false) update();
  globalThis[CONNECTIVITY_BADGE_FLAG] = badge;
  return badge;
}

const directionLabel = attribute => {
  if (!attribute) return '';
  if (attribute.key === 'birthDate') return 'kevesebb életkor a jobb';
  if (attribute.key === 'birthDateOlder') return 'több életkor a jobb';
  return ['higher', 'later'].includes(attribute.direction) ? 'több a jobb' : 'kevesebb a jobb';
};

const bestHumanCard = (game, attribute) => {
  const cards = game.hands[HUMAN].filter(card => hasAttributeData(card, attribute.key));
  if (!cards.length) return null;
  const multiplier = ['higher', 'later'].includes(attribute.direction) ? -1 : 1;
  return cards.sort((a, b) => multiplier * (attributeValue(a, attribute.key) - attributeValue(b, attribute.key)))[0];
};

const baseMethods = {
  renderHands: UI.prototype.renderHands,
  renderScores: UI.prototype.renderScores,
  showVerdict: UI.prototype.showVerdict,
  setSettings: UI.prototype.setSettings,
  openInspector: UI.prototype.openInspector,
  closeInspector: UI.prototype.closeInspector,
};

UI.prototype._renderSettings = function renderMobileToolbar() {
  this.dom.hudSettings.replaceChildren();

  if (!this._mobileClickSoundBound) {
    this._mobileClickSoundBound = true;
    document.addEventListener('click', event => {
      if (event.target.closest?.('button:not(:disabled), [role="button"]')) this.playSound('click');
    });
  }

  const menu = el('button', 'icon-toggle mobile-menu-trigger', this.handlers.onPause ? '☰ Menü' : '⚙ Beállítások');
  menu.type = 'button';
  menu.setAttribute('aria-label', this.handlers.onPause ? 'Szünet és játékmenü megnyitása' : 'Beállítások megnyitása');
  menu.addEventListener('click', () => (this.handlers.onPause ?? this.handlers.onOpenSettings)?.());

  const sound = el('button', 'icon-toggle mobile-sound-trigger', this.settings.sounds ? '🔊' : '🔇');
  sound.type = 'button';
  sound.setAttribute('aria-label', this.settings.sounds ? 'Hangok kikapcsolása' : 'Hangok bekapcsolása');
  sound.setAttribute('aria-pressed', String(Boolean(this.settings.sounds)));
  sound.addEventListener('click', () => this.handlers.onToggleSounds?.());

  this.dom.hudSettings.append(sound, menu);
};

UI.prototype.setSettings = function setMobileSettings(settings) {
  baseMethods.setSettings.call(this, settings);
  applyExperienceSettings(this.settings);
};

UI.prototype.setInteractionBusy = function setInteractionBusy(busy) {
  const active = Boolean(busy);
  this.dom.pub.classList.toggle('is-processing', active);

  for (const node of this.dom.pub.querySelectorAll('#attribute-picker button, #player-hand .card--direct-play, #inspector button')) {
    const stateKey = 'interactionBusyState';

    if (active) {
      if (node.dataset[stateKey] == null) {
        node.dataset[stateKey] = JSON.stringify({
          disabled: 'disabled' in node ? Boolean(node.disabled) : null,
          ariaDisabled: node.hasAttribute('aria-disabled') ? node.getAttribute('aria-disabled') : null,
        });
      }
      if ('disabled' in node) node.disabled = true;
      node.setAttribute('aria-disabled', 'true');
      continue;
    }

    const stored = node.dataset[stateKey];
    if (stored == null) continue;

    try {
      const previous = JSON.parse(stored);
      if ('disabled' in node && previous.disabled != null) node.disabled = Boolean(previous.disabled);
      if (previous.ariaDisabled == null) node.removeAttribute('aria-disabled');
      else node.setAttribute('aria-disabled', String(previous.ariaDisabled));
    } catch {
      /* Sérült átmeneti állapot esetén sem szabad a tartós UI-állapotot
         felülírni. A következő render új, konzisztens elemet hoz létre. */
    }
    delete node.dataset[stateKey];
  }
};

UI.prototype.showToast = function showToast(message, tone = 'info', duration = 2200) {
  document.querySelector('#ux-toast')?.remove();
  const toast = el('div', `ux-toast ux-toast--${tone}`, message);
  toast.id = 'ux-toast';
  toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  toast.setAttribute('aria-live', tone === 'error' ? 'assertive' : 'polite');
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
};

UI.prototype.showHint = function showHint(text) {
  this.dom.prompt.classList.add('has-helper');
  const helper = el('small', 'prompt-helper', text);
  this.dom.prompt.appendChild(helper);
};

UI.prototype.renderHands = function renderMobileHands(game, options = {}) {
  baseMethods.renderHands.call(this, game, options);
  this.dom.playerHand.querySelectorAll('.card').forEach(card => card.classList.add('card--direct-play'));
};

UI.prototype.renderScores = function renderMobileScores(game) {
  baseMethods.renderScores.call(this, game);
  this.dom.hudMeta.dataset.mode = this.mode;
};

UI.prototype.showVerdict = function showMobileVerdict(result, game) {
  baseMethods.showVerdict.call(this, result, game);
  this.dom.verdict.setAttribute('role', 'status');
  this.dom.verdict.setAttribute('aria-live', 'assertive');
};

UI.prototype.showTurnHelp = function showTurnHelp(game) {
  const attribute = ATTRIBUTES.find(item => item.key === game.attribute);
  if (!attribute) return;
  const card = bestHumanCard(game, attribute);
  const value = card ? formatAttribute(card, attribute.key) : null;
  this.showHint(card
    ? `Tipp: ${card.name} a legerősebb lapod ebben: ${value}. ${directionLabel(attribute)}.`
    : `Ebben a kategóriában most nincs használható lapod. ${directionLabel(attribute)}.`);
};

export function enhanceMobileExperience() {
  installConnectivityBadge();
  return true;
}
