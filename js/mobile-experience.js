/** Mobile-first experience helpers layered on top of the existing game UI. */

import {
  DEFAULT_EXPERIENCE_SETTINGS,
  APP_STORAGE_KEYS,
  settingStorageKey,
} from './app/configuration.js';
import { readStoredBoolean, writeStoredBoolean } from './services/storage-service.js';
import {
  clearSavedMatch, hydrateGame, readSavedMatch, writeSavedMatch,
} from './services/save-service.js';

export { clearSavedMatch, hydrateGame, readSavedMatch, writeSavedMatch };
import { UI, el } from './ui.js';
import {
  ATTRIBUTES,
  attributeValue,
  formatAttribute,
  hasAttributeData,
} from './data/players.js';
import { HUMAN } from './engine.js';

const installAiTurnRecovery = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (globalThis.__FOCISKARTYAK_AI_RECOVERY__) return;
  globalThis.__FOCISKARTYAK_AI_RECOVERY__ = true;

  window.addEventListener('unhandledrejection', event => {
    const prompt = document.querySelector('#prompt');
    const text = prompt?.textContent?.toLocaleLowerCase('hu-HU') ?? '';
    if (!/a gép(?: kártyát)? választ/.test(text)) return;

    console.warn('[ai] A gépi döntés megszakadt, a mentett állás újratöltése következik.', event.reason);
    if (prompt) prompt.textContent = 'A gép döntésének újrapróbálása…';
    window.setTimeout(() => window.location.reload(), 360);
  });
};

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
  this.dom.pub.classList.toggle('is-processing', Boolean(busy));
  for (const node of this.dom.pub.querySelectorAll('#attribute-picker button, #player-hand .card--direct-play, #inspector button')) {
    if ('disabled' in node) node.disabled = Boolean(busy);
    node.setAttribute('aria-disabled', String(Boolean(busy)));
  }
};

UI.prototype.showToast = function showToast(message, tone = 'info', duration = 2200) {
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
};

UI.prototype.vibrate = function vibrate(pattern) {
  if (!this.settings.vibration || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate(pattern);
};

UI.prototype.renderScores = function renderMobileScores(game) {
  baseMethods.renderScores.call(this, game);
  this.dom.pub.dataset.turn = game.chooser === HUMAN ? 'human' : 'ai';
  this.dom.pub.dataset.gameMode = game.mode;
  this.dom.hudMeta.setAttribute('aria-label', `${game.mode === 'penalties' ? 'Tizenegyes mód' : 'Klasszikus mód'}. ${this.dom.hudMeta.textContent}`);
};

UI.prototype.renderHands = function renderMobileHands(game, options = {}) {
  baseMethods.renderHands.call(this, game, options);
  const selectableCards = this.dom.playerHand.querySelectorAll('.card--direct-play:not(.card--unavailable)');
  this.dom.playerHand.classList.toggle('has-scroll-hint', this.dom.playerHand.children.length > 2);
  this.dom.playerHand.setAttribute('aria-busy', String(this.dom.pub.classList.contains('is-processing')));
  selectableCards.forEach(card => card.setAttribute('aria-describedby', 'mobile-hand-instruction'));
  if (!document.querySelector('#mobile-hand-instruction')) {
    const instruction = el('span', 'sr-only', 'Koppints a kártyára a kijátszáshoz, vagy a nagyítóra a részletekhez. A kéz oldalra görgethető.');
    instruction.id = 'mobile-hand-instruction';
    document.body.appendChild(instruction);
  }
};

UI.prototype.showAttributePicker = function showMobileAttributePicker(game) {
  this.dom.duel.replaceChildren();
  this.dom.verdict.replaceChildren();
  this.dom.verdict.className = '';
  this.setPrompt('Te következel – válassz kategóriát');

  const available = new Set(game.availableAttributeKeys());
  const buttons = ATTRIBUTES
    .filter(attribute => available.has(attribute.key))
    .map(attribute => {
      const best = bestHumanCard(game, attribute);
      const button = el('button', 'attr-btn attr-btn--mobile');
      button.type = 'button';
      button.dataset.attribute = attribute.key;
      button.append(
        el('span', 'attr-btn__label', `${attribute.icon} ${attribute.label}`),
        el('strong', 'attr-btn__value', best ? `Legjobb saját: ${formatAttribute(best, attribute.key)}` : 'Nincs használható saját lap'),
        el('small', 'attr-btn__direction', directionLabel(attribute)),
      );
      button.setAttribute('aria-label', `${attribute.label}. ${best ? `Legjobb saját érték: ${formatAttribute(best, attribute.key)}.` : ''} ${directionLabel(attribute)}.`);
      button.addEventListener('click', () => {
        if (button.disabled) return;
        this.dom.picker.querySelectorAll('button').forEach(item => { item.disabled = true; });
        button.classList.add('is-selected');
        this.handlers.onAttribute(attribute.key);
      }, { once: true });
      return button;
    });

  if (buttons.length) this.dom.picker.replaceChildren(...buttons);
  else this.dom.picker.replaceChildren(el('p', 'ux-empty-state', 'Ehhez a leosztáshoz nincs közös, hiteles kategória.'));
  this._uxSetStep?.(1);
};

UI.prototype.showVerdict = function showMobileVerdict(result, game) {
  baseMethods.showVerdict.call(this, result, game);
  const node = this.dom.verdict;
  const first = node.firstChild;
  if (first?.nodeType === Node.TEXT_NODE) {
    first.nodeValue = result.winner === 'tie'
      ? 'Döntetlen – a lapok a közös pakliba kerülnek'
      : result.winner === HUMAN
        ? (game.mode === 'penalties' ? 'Gól – megnyerted a párbajt' : 'Megnyerted a kört')
        : (game.mode === 'penalties' ? 'A gép gólt szerzett' : 'A gép nyerte a kört');
  }
  node.classList.add('ux-verdict-pop');
  if (result.winner === HUMAN) this.vibrate([35, 40, 35]);
  else if (result.winner === 'ai') this.vibrate(70);
  else this.vibrate(30);
};

UI.prototype.openInspector = function openMobileInspector(...args) {
  baseMethods.openInspector.apply(this, args);
  const layer = document.querySelector('#inspector');
  const shell = layer?.querySelector('.inspector__shell');
  shell?.setAttribute('role', 'dialog');
  shell?.setAttribute('aria-modal', 'true');
  shell?.setAttribute('aria-label', 'Játékoskártya részletei');
  layer?.querySelector('.inspector__nav:first-child')?.setAttribute('aria-label', 'Előző kártya');
  layer?.querySelector('.inspector__nav:last-child')?.setAttribute('aria-label', 'Következő kártya');
  layer?.querySelector('button')?.focus({ preventScroll: true });
};

UI.prototype.closeInspector = function closeMobileInspector(...args) {
  baseMethods.closeInspector.apply(this, args);
};

installAiTurnRecovery();
applyExperienceSettings(loadSettings());
installConnectivityBadge();
