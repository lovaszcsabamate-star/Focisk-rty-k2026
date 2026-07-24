/** Főmenü-, onboarding-, beállítás- és szünetképernyők központi vezérlője. */

import { DIFFICULTY } from '../ai.js';
import { GAME_DECK_SIZE } from '../engine.js';
import { el } from '../ui.js';
import {
  clearSavedMatch,
  onboardingWasCompleted,
  readSavedMatch,
  setOnboardingCompleted,
} from '../mobile-experience.js';

export class MenuControllerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MenuControllerError';
    this.code = code;
  }
}

const menuControllerRequiredActions = Object.freeze([
  'saveCurrentGame',
  'prepareTitleScreen',
  'resumeSavedMatch',
  'start',
  'toggleSetting',
  'beginMatch',
]);

const menuControllerAssertMethod = (target, method, code) => {
  if (typeof target?.[method] !== 'function') {
    throw new MenuControllerError(code, `A menüvezérlőből hiányzik a(z) ${method} művelet.`);
  }
};

const menuControllerDefaultFocusFrame = callback => {
  const frame = globalThis.requestAnimationFrame;
  if (typeof frame === 'function') frame(callback);
  else callback();
};

const menuControllerDefaultSchedule = callback => {
  const timer = globalThis.setTimeout;
  if (typeof timer === 'function') timer(callback, 0);
  else callback();
};

const menuControllerValidDifficulty = (registry, value) => (
  Object.prototype.hasOwnProperty.call(registry, value)
);

const menuControllerSelectedOpponentDifficulty = registry => {
  const id = globalThis.__FOCISKARTYAK_OPPONENT__?.id;
  if (menuControllerValidDifficulty(registry, id)) return id;
  if (menuControllerValidDifficulty(registry, 'medium')) return 'medium';
  return Object.keys(registry)[0];
};

export function createMenuController({
  ui,
  getState,
  actions,
  elementFactory = el,
  difficultyRegistry = DIFFICULTY,
  gameDeckSize = GAME_DECK_SIZE,
  readSaved = readSavedMatch,
  clearSaved = clearSavedMatch,
  onboardingCompleted = onboardingWasCompleted,
  setOnboardingCompletedValue = setOnboardingCompleted,
  focusFrame = menuControllerDefaultFocusFrame,
  schedule = menuControllerDefaultSchedule,
} = {}) {
  menuControllerAssertMethod(ui, 'showOverlay', 'INVALID_UI');
  menuControllerAssertMethod(ui, 'hideOverlay', 'INVALID_UI');
  if (typeof getState !== 'function') {
    throw new MenuControllerError('INVALID_STATE_ADAPTER', 'A menüvezérlő állapotadaptere kötelező.');
  }
  menuControllerRequiredActions.forEach(method => menuControllerAssertMethod(actions, method, 'INVALID_ACTIONS'));
  if (typeof elementFactory !== 'function') {
    throw new MenuControllerError('INVALID_ELEMENT_FACTORY', 'A menüvezérlő elemgyártó függvénye kötelező.');
  }

  let overlayReturn = null;
  const state = () => getState() ?? {};

  const showPanel = (panel, returnAction = null) => {
    overlayReturn = returnAction;
    ui.showOverlay(panel);
    focusFrame(() => panel?.querySelector?.('button, input, summary')?.focus?.({ preventScroll: true }));
    return panel;
  };

  const hidePanel = () => {
    overlayReturn = null;
    ui.hideOverlay();
  };

  const handleBackAction = () => {
    if (ui.dom?.overlay?.hidden !== false || typeof overlayReturn !== 'function') return false;
    const action = overlayReturn;
    overlayReturn = null;
    action();
    return true;
  };

  const savedTimeLabel = iso => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'mentett mérkőzés';
    return `mentve: ${date.toLocaleDateString('hu-HU')} ${date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const deckLabel = () => {
    const current = state();
    if (current.source !== 'real') return '⚠ Fiktív tartalékpakli – a valós adatfájl nem töltődött be.';
    const exact = current.meta?.selection?.exactBirthDates;
    const dateNote = Number.isFinite(exact) ? ` · ${exact} pontos születési dátum` : '';
    return `✓ ${(current.deck ?? []).length} valós NB I-kártya · ${current.meta?.season ?? '2025/26'}${dateNote}`;
  };

  const selectedDifficulty = panel => {
    const checked = panel?.querySelector?.('input[name=difficulty]:checked')?.value;
    return menuControllerValidDifficulty(difficultyRegistry, checked)
      ? checked
      : menuControllerSelectedOpponentDifficulty(difficultyRegistry);
  };

  const showTitleScreen = ({ offerOnboarding = false } = {}) => {
    const beforeReset = state();
    if (beforeReset.game && !beforeReset.game.isOver) actions.saveCurrentGame();
    actions.prepareTitleScreen();

    const current = state();
    const saved = readSaved();
    const panel = elementFactory('div', 'menu-panel mobile-home');
    panel.innerHTML = `
      <p class="eyebrow">A hátsó asztal bajnoksága</p>
      <h1>Fociskártyák 2026</h1>
      <p>Válassz ellenfelet és játékmódot. A játék internet nélkül is teljes értékűen működik.</p>

      ${saved ? `
        <button class="btn btn--continue" id="continue-btn">
          <span>▶ Játék folytatása</span>
          <small>${saved.mode === 'penalties' ? 'Tizenegyes mód' : 'Klasszikus mód'} · ${savedTimeLabel(saved.savedAt)}</small>
        </button>
      ` : ''}

      <h2 class="menu-section-title">Új játék</h2>
      <div class="primary-mode-actions">
        <button class="btn mode-start" id="start-btn"><span>🃏 Klasszikus mód</span><small>52 lapos kártyameccs</small></button>
        <button class="btn mode-start" id="penalties-btn"><span>⚽ Penalties mód</span><small>11 lap, öt rendes párbaj</small></button>
      </div>

      <details class="opponent-details">
        <summary>👤 Ellenfél kiválasztása</summary>
        <div class="difficulty" aria-label="Nehézség">
          ${Object.entries(difficultyRegistry).slice(0, 3).map(([key, difficulty], index) => `
            <label><input type="radio" name="difficulty" value="${key}" ${index === 1 ? 'checked' : ''}><span>${difficulty.label}</span></label>
          `).join('')}
        </div>
      </details>

      <div class="secondary-menu-actions">
        <button class="btn btn--ghost" id="rules-btn">📖 Játékszabályok</button>
        <button class="btn btn--ghost" id="settings-btn">⚙ Beállítások</button>
      </div>
      <div class="deck-source">${deckLabel()}</div>
    `;

    panel.querySelector('#continue-btn')?.addEventListener('click', () => actions.resumeSavedMatch(), { once: true });
    panel.querySelector('#start-btn').addEventListener('click', () => startFromMenu('classic', panel), { once: true });
    panel.querySelector('#penalties-btn').addEventListener('click', () => startFromMenu('penalties', panel), { once: true });
    panel.querySelector('#rules-btn').addEventListener('click', () => showRules(() => showTitleScreen({ offerOnboarding: false })), { once: true });
    panel.querySelector('#settings-btn').addEventListener('click', () => showSettings(() => showTitleScreen({ offerOnboarding: false })), { once: true });

    showPanel(panel);
    if (offerOnboarding && !onboardingCompleted()) schedule(() => showOnboarding(false));
    return current;
  };

  const startFromMenu = (mode, panel) => {
    const difficulty = selectedDifficulty(panel);
    if (readSaved()) {
      confirmReplaceSavedGame(mode, difficulty);
      return;
    }
    actions.start(mode, difficulty);
  };

  const confirmReplaceSavedGame = (mode, difficulty) => {
    const panel = elementFactory('div', 'confirm-panel');
    panel.innerHTML = `
      <p class="eyebrow">Mentett mérkőzés</p>
      <h1>Új játékot indítasz?</h1>
      <p>A jelenlegi mentés törlődik. Ezt később nem lehet visszaállítani.</p>
      <div class="result-actions">
        <button class="btn" id="replace-save-btn">Igen, új játék</button>
        <button class="btn btn--ghost" id="keep-save-btn">Mégse</button>
      </div>
    `;
    panel.querySelector('#replace-save-btn').addEventListener('click', () => {
      clearSaved();
      actions.start(mode, difficulty);
    }, { once: true });
    panel.querySelector('#keep-save-btn').addEventListener('click', () => showTitleScreen({ offerOnboarding: false }), { once: true });
    showPanel(panel, () => showTitleScreen({ offerOnboarding: false }));
  };

  const showOnboarding = (forced = false) => {
    const slides = [
      ['🎮', 'Válassz játékmódot', 'A Klasszikus mód hosszabb kártyameccs, a Penalties gyors tizenegyespárbaj.'],
      ['🃏', 'Nézd meg a saját lapjaidat', 'A kéz oldalra húzható. Koppints egy kártyára, a nagyítóval pedig megnyithatod a részleteit.'],
      ['📊', 'Válassz kategóriát', 'A gomb megmutatja, hogy több vagy kevesebb érték számít jobbnak, és a legjobb saját értékedet is.'],
      ['🏆', 'Gyűjts több lapot', 'A kör győztese viszi a lapokat. Döntetlennél a lapok a közös pakliba kerülnek.'],
    ];
    let index = 0;
    const panel = elementFactory('div', 'onboarding-panel');
    panel.innerHTML = `
      <button class="onboarding-skip" id="onboarding-skip" type="button">Átugrás</button>
      <div class="onboarding-progress" aria-label="Bemutató állapota"></div>
      <div class="onboarding-slide" aria-live="polite"></div>
      <label class="onboarding-never"><input type="checkbox" id="onboarding-never" checked> Ne mutasd újra</label>
      <div class="onboarding-actions">
        <button class="btn btn--ghost" id="onboarding-back" type="button">Vissza</button>
        <button class="btn" id="onboarding-next" type="button">Tovább</button>
      </div>
    `;
    const slide = panel.querySelector('.onboarding-slide');
    const progress = panel.querySelector('.onboarding-progress');
    const back = panel.querySelector('#onboarding-back');
    const next = panel.querySelector('#onboarding-next');
    const never = panel.querySelector('#onboarding-never');

    const finish = () => {
      if (never.checked) setOnboardingCompletedValue(true);
      else if (forced) setOnboardingCompletedValue(false);
      showTitleScreen({ offerOnboarding: false });
    };
    const render = () => {
      const [icon, title, text] = slides[index];
      slide.innerHTML = `<div class="onboarding-icon">${icon}</div><h1>${title}</h1><p>${text}</p>`;
      progress.replaceChildren(...slides.map((_, step) => {
        const dot = elementFactory('span', `onboarding-dot${step === index ? ' is-active' : ''}`);
        dot.setAttribute('aria-label', `${step + 1}. lépés${step === index ? ', aktuális' : ''}`);
        return dot;
      }));
      back.disabled = index === 0;
      next.textContent = index === slides.length - 1 ? 'Kezdjük' : 'Tovább';
    };
    back.addEventListener('click', () => { if (index > 0) { index -= 1; render(); } });
    next.addEventListener('click', () => {
      if (index === slides.length - 1) finish();
      else { index += 1; render(); }
    });
    panel.querySelector('#onboarding-skip').addEventListener('click', finish, { once: true });
    render();
    showPanel(panel, finish);
  };

  const showRules = returnAction => {
    const current = state();
    const panel = elementFactory('div', 'rules-panel mobile-sheet');
    panel.innerHTML = `
      <p class="eyebrow">Súgó</p>
      <h1>Játékszabályok</h1>
      <section class="rule-card" data-rules="classic">
        <h2>🃏 Klasszikus mód</h2>
        <p><b>${Math.min(gameDeckSize, (current.deck ?? []).length)} véletlenszerű lap</b> kerül játékba. A két fél körönként felváltva választ kategóriát. A győztes viszi a két lapot és a döntetlenpaklit.</p>
      </section>
      <section class="rule-card" data-rules="penalties">
        <h2>⚽ Penalties mód</h2>
        <p>Mindkét fél 11 lapot kap. Öt rendes párbaj következik; döntetlennél hirtelen halál. Azonos értéknél nincs gól.</p>
      </section>
      <section class="rule-card">
        <h2>📊 Kategóriák</h2>
        <p>A kategóriagomb mindig jelzi, hogy a több vagy a kevesebb érték a jobb. Csak olyan kategória választható, amelyhez mindkét oldalon van hiteles adat.</p>
      </section>
      <button class="btn" id="rules-back-btn">Vissza</button>
    `;
    panel.querySelector('#rules-back-btn').addEventListener('click', returnAction, { once: true });
    showPanel(panel, returnAction);
  };

  const showSettings = returnAction => {
    const current = state();
    const panel = elementFactory('div', 'settings-panel mobile-sheet');
    panel.innerHTML = `
      <p class="eyebrow">Személyre szabás</p>
      <h1>Beállítások</h1>
      <div class="settings-list"></div>
      <div class="settings-actions">
        <button class="btn btn--ghost" id="replay-guide-btn">Útmutató újraindítása</button>
        ${readSaved() ? '<button class="btn btn--danger" id="delete-save-btn">Mentett játék törlése</button>' : ''}
        <button class="btn" id="settings-back-btn">Kész</button>
      </div>
    `;
    const rows = [
      ['sounds', '🔊 Hangok', 'Rövid gomb- és eredményhangok'],
      ['commentary', '💬 Kommentárok', 'A hátsó asztal beszólásai'],
      ['vibration', '📳 Rezgés', 'Rövid visszajelzés a kör eredményéről'],
      ['animations', '✨ Animációk', 'Kártya- és eredményátmenetek'],
      ['largeText', '🔎 Nagyobb szöveg', 'Nagyobb kezelőelemek és feliratok'],
      ['simplified', '◻ Egyszerűsített nézet', 'Kevesebb dekoráció és vizuális zaj'],
    ];
    const list = panel.querySelector('.settings-list');
    for (const [key, label, description] of rows) {
      const row = elementFactory('label', 'setting-switch');
      const copy = elementFactory('span', 'setting-switch__copy');
      copy.append(elementFactory('strong', null, label), elementFactory('small', null, description));
      const input = elementFactory('input');
      input.type = 'checkbox';
      input.checked = Boolean(current.settings?.[key]);
      input.setAttribute('aria-label', label);
      input.addEventListener('change', () => actions.toggleSetting(key, input.checked));
      row.append(copy, input, elementFactory('span', 'setting-switch__visual'));
      list.appendChild(row);
    }
    panel.querySelector('#replay-guide-btn').addEventListener('click', () => {
      setOnboardingCompletedValue(false);
      showOnboarding(true);
    }, { once: true });
    panel.querySelector('#delete-save-btn')?.addEventListener('click', () => {
      clearSaved();
      ui.showToast?.('A mentett játék törölve');
      showSettings(returnAction);
    }, { once: true });
    panel.querySelector('#settings-back-btn').addEventListener('click', returnAction, { once: true });
    showPanel(panel, returnAction);
  };

  const showPauseMenu = () => {
    const current = state();
    if (!current.game || current.game.isOver) return;
    actions.saveCurrentGame();
    const panel = elementFactory('div', 'pause-panel mobile-sheet');
    panel.innerHTML = `
      <p class="eyebrow">A játék szünetel</p>
      <h1>Szünet</h1>
      <p>${current.mode === 'penalties' ? 'Tizenegyes mód' : 'Klasszikus mód'} · ${current.game.round}. ${current.mode === 'penalties' ? 'párbaj' : 'kör'}</p>
      <div class="pause-actions">
        <button class="btn" id="resume-btn">▶ Játék folytatása</button>
        <button class="btn btn--ghost" id="restart-btn">↻ Újrakezdés</button>
        <button class="btn btn--ghost" id="pause-rules-btn">📖 Szabályok</button>
        <button class="btn btn--ghost" id="pause-settings-btn">⚙ Beállítások</button>
        <button class="btn btn--ghost" id="home-btn">⌂ Vissza a főmenübe</button>
      </div>
    `;
    const resume = () => hidePanel();
    panel.querySelector('#resume-btn').addEventListener('click', resume, { once: true });
    panel.querySelector('#restart-btn').addEventListener('click', () => actions.start(current.mode, current.difficulty), { once: true });
    panel.querySelector('#pause-rules-btn').addEventListener('click', () => showRules(() => showPauseMenu()), { once: true });
    panel.querySelector('#pause-settings-btn').addEventListener('click', () => showSettings(() => showPauseMenu()), { once: true });
    panel.querySelector('#home-btn').addEventListener('click', () => showTitleScreen({ offerOnboarding: false }), { once: true });
    showPanel(panel, resume);
  };

  const showPenaltyIntro = () => {
    const panel = elementFactory('div', 'penalty-intro');
    panel.innerHTML = `
      <p class="eyebrow">Penalties mód</p>
      <h1>11 lap. 5 rendes párbaj.</h1>
      <p>Döntetlennél hirtelen halál. A felhasznált lapok külön pakliba kerülnek.</p>
      <button class="btn" id="kickoff-btn">Kezdődhet</button>
    `;
    panel.querySelector('#kickoff-btn').addEventListener('click', () => actions.beginMatch(), { once: true });
    showPanel(panel, () => showTitleScreen({ offerOnboarding: false }));
  };

  return Object.freeze({
    showPanel,
    hidePanel,
    handleBackAction,
    showTitleScreen,
    savedTimeLabel,
    deckLabel,
    selectedDifficulty,
    startFromMenu,
    confirmReplaceSavedGame,
    showOnboarding,
    showRules,
    showSettings,
    showPauseMenu,
    showPenaltyIntro,
  });
}
