/**
 * Egyszerű, nagy hatású játékélmény-fejlesztések a meglévő játékmenet fölött.
 *
 * A réteg nem módosítja a mentési sémát és nem épít új játékmotort. A választott
 * mérkőzésformátumot, a kedvenceket és a legutóbbi csapatokat helyben tárolja,
 * majd minden friss vagy visszaállított játékra biztonságosan újraalkalmazza.
 */

import { AI, Game, HUMAN, PHASE } from './engine.js';
import {
  UI,
  beginUiEnhancementLayer,
  commitUiEnhancementLayer,
  el,
  rollbackUiEnhancementLayer,
} from './ui.js';

const GAMEPLAY_POLISH_LAYER = './gameplay-polish.js';
const GAMEPLAY_POLISH_STYLE_ID = 'gameplay-polish-styles';
const GAMEPLAY_POLISH_MATCH_KEY = 'fociskartyak:gameplay-polish:match-target:v1';
const GAMEPLAY_POLISH_FAVOURITES_KEY = 'fociskartyak:gameplay-polish:favourite-teams:v1';
const GAMEPLAY_POLISH_RECENTS_KEY = 'fociskartyak:gameplay-polish:recent-teams:v1';
const GAMEPLAY_POLISH_TARGET_FIELD = '__gameplayPolishTargetWins';
const GAMEPLAY_POLISH_PATCH_FLAG = Symbol.for('fociskartyak.gameplay-polish.engine-patch');
const GAMEPLAY_POLISH_INTRO_DURATION = 1550;
const GAMEPLAY_POLISH_TEAM_HISTORY_LIMIT = 5;

const GAMEPLAY_POLISH_FORMATS = Object.freeze([
  Object.freeze({ value: 3, label: 'Villám', detail: 'elsőként 3 körgyőzelemig' }),
  Object.freeze({ value: 5, label: 'Normál', detail: 'elsőként 5 körgyőzelemig' }),
  Object.freeze({ value: 10, label: 'Maraton', detail: 'elsőként 10 körgyőzelemig' }),
  Object.freeze({ value: 0, label: 'Teljes', detail: 'a teljes pakli végéig' }),
]);

const gameplayPolishText = value => String(value ?? '').trim();
const gameplayPolishTeamKey = entry => `${gameplayPolishText(entry?.category)}::${gameplayPolishText(entry?.label)}`;
const gameplayPolishValidTarget = value => {
  const numeric = Number(value);
  return GAMEPLAY_POLISH_FORMATS.some(format => format.value === numeric) ? numeric : 0;
};

const gameplayPolishRead = (key, fallback) => {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const gameplayPolishWrite = (key, value) => {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

const gameplayPolishReadTarget = () => gameplayPolishValidTarget(
  gameplayPolishRead(GAMEPLAY_POLISH_MATCH_KEY, 0),
);

const gameplayPolishSanitiseTeams = value => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const output = [];
  for (const candidate of value) {
    const entry = {
      label: gameplayPolishText(candidate?.label),
      category: gameplayPolishText(candidate?.category),
    };
    const key = gameplayPolishTeamKey(entry);
    if (!entry.label || !entry.category || seen.has(key)) continue;
    seen.add(key);
    output.push(entry);
  }
  return output.slice(0, GAMEPLAY_POLISH_TEAM_HISTORY_LIMIT);
};

const gameplayPolishReadTeams = key => gameplayPolishSanitiseTeams(gameplayPolishRead(key, []));

const gameplayPolishRoundWins = game => {
  const wins = { [HUMAN]: 0, [AI]: 0 };
  for (const result of Array.isArray(game?.log) ? game.log : []) {
    if (result?.winner === HUMAN || result?.winner === AI) wins[result.winner] += 1;
  }
  return wins;
};

const gameplayPolishApplyTarget = game => {
  if (!game || game.mode !== 'classic') return 0;
  const target = gameplayPolishReadTarget();
  try {
    Object.defineProperty(game, GAMEPLAY_POLISH_TARGET_FIELD, {
      value: target,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  } catch {
    game[GAMEPLAY_POLISH_TARGET_FIELD] = target;
  }
  return target;
};

const gameplayPolishPatchClassicGame = () => {
  if (Game.prototype[GAMEPLAY_POLISH_PATCH_FLAG]) return;

  const previousNextRound = Game.prototype.nextRound;
  const previousResult = Game.prototype.result;
  Object.defineProperty(Game.prototype, GAMEPLAY_POLISH_PATCH_FLAG, {
    value: Object.freeze({ previousNextRound, previousResult }),
    configurable: false,
    enumerable: false,
    writable: false,
  });

  Game.prototype.nextRound = function nextRoundWithTargetWins(...args) {
    const target = gameplayPolishValidTarget(this[GAMEPLAY_POLISH_TARGET_FIELD]);
    if (target > 0 && this.phase === PHASE.REVEAL) {
      const wins = gameplayPolishRoundWins(this);
      if (wins[HUMAN] >= target || wins[AI] >= target) {
        this.played = { [HUMAN]: null, [AI]: null };
        this.attribute = null;
        this.phase = PHASE.GAME_OVER;
        return this;
      }
    }
    return previousNextRound.apply(this, args);
  };

  Game.prototype.result = function resultWithTargetWins(...args) {
    const target = gameplayPolishValidTarget(this[GAMEPLAY_POLISH_TARGET_FIELD]);
    if (target <= 0) return previousResult.apply(this, args);
    const wins = gameplayPolishRoundWins(this);
    const human = wins[HUMAN];
    const ai = wins[AI];
    return {
      human,
      ai,
      winner: human === ai ? 'tie' : (human > ai ? HUMAN : AI),
      undecided: this.pot.length,
      targetWins: target,
    };
  };
};

const gameplayPolishEnsureStyles = () => {
  if (typeof document === 'undefined' || document.getElementById(GAMEPLAY_POLISH_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = GAMEPLAY_POLISH_STYLE_ID;
  style.textContent = `
    .gameplay-match-intro {
      position: fixed;
      z-index: 12050;
      inset: 0;
      display: grid;
      place-items: center;
      padding: max(18px, env(safe-area-inset-top, 0px)) max(18px, env(safe-area-inset-right, 0px)) max(18px, env(safe-area-inset-bottom, 0px)) max(18px, env(safe-area-inset-left, 0px));
      border: 0;
      background: radial-gradient(circle at 50% 32%, rgba(121,88,44,.28), transparent 42%), rgba(8,7,6,.92);
      color: #fff7df;
      cursor: pointer;
      animation: gameplay-intro-fade 1.55s ease both;
      -webkit-tap-highlight-color: transparent;
    }
    .gameplay-match-intro__card {
      width: min(700px, 100%);
      padding: clamp(22px, 5vw, 42px);
      border: 1px solid rgba(232,195,122,.55);
      border-radius: 28px;
      background: linear-gradient(145deg, rgba(53,35,22,.98), rgba(15,12,9,.98));
      box-shadow: 0 28px 80px rgba(0,0,0,.62), inset 0 1px 0 rgba(255,255,255,.08);
      text-align: center;
      animation: gameplay-intro-card .55s cubic-bezier(.2,.9,.25,1) both;
    }
    .gameplay-match-intro__eyebrow { margin: 0 0 15px; color: #e8c37a; font-size: 11px; font-weight: 950; letter-spacing: .16em; text-transform: uppercase; }
    .gameplay-match-intro__teams { display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr); align-items: center; gap: clamp(10px, 3vw, 24px); }
    .gameplay-match-intro__team { min-width: 0; font-size: clamp(1.05rem, 4vw, 2rem); font-weight: 950; line-height: 1.08; text-wrap: balance; }
    .gameplay-match-intro__versus { display: grid; place-items: center; width: 55px; height: 55px; border: 1px solid rgba(232,195,122,.54); border-radius: 50%; background: rgba(232,195,122,.09); color: #e8c37a; font-size: 14px; font-weight: 950; }
    .gameplay-match-intro__format { margin: 20px 0 0; color: #d8c9b0; font-size: clamp(.82rem, 2.5vw, 1rem); font-weight: 800; }
    .gameplay-match-intro__skip { display: block; margin-top: 12px; color: #988b77; font-size: 10px; font-weight: 750; }
    @keyframes gameplay-intro-fade { 0% { opacity: 0; } 10%, 76% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes gameplay-intro-card { from { opacity: 0; transform: translateY(18px) scale(.96); } to { opacity: 1; transform: none; } }

    .gameplay-flip-card { position: relative; display: grid; place-items: center; perspective: 1000px; }
    .gameplay-flip-card > .card { grid-area: 1 / 1; backface-visibility: hidden; transform-style: preserve-3d; }
    .gameplay-flip-card__back { z-index: 2; animation: gameplay-flip-back .56s ease-in both; }
    .gameplay-flip-card__front { z-index: 1; animation: gameplay-flip-front .56s ease-out both; }
    @keyframes gameplay-flip-back { 0%, 46% { opacity: 1; transform: rotateY(0deg); } 52%, 100% { opacity: 0; transform: rotateY(-90deg); } }
    @keyframes gameplay-flip-front { 0%, 46% { opacity: 0; transform: rotateY(90deg); } 52% { opacity: 1; transform: rotateY(90deg); } 100% { opacity: 1; transform: rotateY(0deg); } }

    .gameplay-format-picker { display: grid; gap: 9px; margin: 14px 0; padding: 12px; border: 1px solid rgba(232,195,122,.28); border-radius: 16px; background: rgba(0,0,0,.2); }
    .gameplay-format-picker legend { padding: 0 5px; color: #e8c37a; font-size: 11px; font-weight: 950; letter-spacing: .06em; text-transform: uppercase; }
    .gameplay-format-options { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 7px; }
    .gameplay-format-option { position: relative; display: grid; gap: 3px; min-width: 0; padding: 10px 7px; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; background: rgba(255,255,255,.035); cursor: pointer; text-align: center; }
    .gameplay-format-option:has(input:checked) { border-color: rgba(232,195,122,.8); background: rgba(232,195,122,.13); box-shadow: inset 0 0 0 1px rgba(232,195,122,.22); }
    .gameplay-format-option input { position: absolute; opacity: 0; pointer-events: none; }
    .gameplay-format-option strong { color: #fff7df; font-size: 12px; }
    .gameplay-format-option small { color: #ae9f89; font-size: 9px; line-height: 1.25; }
    .gameplay-format-option:focus-within { outline: 3px solid #fff3bd; outline-offset: 2px; }

    .gameplay-target-score { display: inline-flex; align-items: center; gap: 5px; margin-left: 7px; padding: 3px 7px; border: 1px solid rgba(232,195,122,.3); border-radius: 999px; color: #ead59c; font-size: 10px; font-weight: 900; white-space: nowrap; }

    .quick-team-memory { display: grid; gap: 8px; width: min(760px,100%); margin: 2px auto 0; }
    .quick-team-memory__top { display: flex; align-items: center; justify-content: center; gap: 7px; }
    .quick-team-memory__favourite { min-height: 38px; padding: 7px 12px; border: 1px solid rgba(232,195,122,.34); border-radius: 999px; background: rgba(0,0,0,.28); color: #e8c37a; cursor: pointer; font: inherit; font-size: 10px; font-weight: 900; }
    .quick-team-memory__favourite.is-active { background: rgba(232,195,122,.17); color: #fff3bd; }
    .quick-team-memory__shortcuts { display: flex; justify-content: center; gap: 6px; min-width: 0; overflow-x: auto; padding: 2px 4px 5px; scrollbar-width: none; }
    .quick-team-memory__shortcuts::-webkit-scrollbar { display: none; }
    .quick-team-memory__shortcut { flex: 0 0 auto; max-width: 180px; min-height: 34px; padding: 6px 10px; overflow: hidden; border: 1px solid rgba(255,255,255,.12); border-radius: 999px; background: rgba(255,255,255,.04); color: #ddd0b9; cursor: pointer; font: inherit; font-size: 9px; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; }

    @media (max-width: 620px) {
      .gameplay-format-options { grid-template-columns: repeat(2,minmax(0,1fr)); }
      .gameplay-match-intro__teams { grid-template-columns: 1fr; }
      .gameplay-match-intro__versus { width: 44px; height: 44px; margin: 0 auto; }
    }
    @media (prefers-reduced-motion: reduce) {
      .gameplay-match-intro, .gameplay-match-intro__card, .gameplay-flip-card__back, .gameplay-flip-card__front { animation-duration: 1ms !important; }
      .gameplay-flip-card__back { display: none; }
      .gameplay-flip-card__front { opacity: 1; transform: none; }
    }
  `;
  document.head?.appendChild(style);
};

const gameplayPolishStates = new WeakMap();
const gameplayPolishState = ui => {
  let state = gameplayPolishStates.get(ui);
  if (!state) {
    state = { introGame: null, introTimer: 0, selectorObserver: null };
    gameplayPolishStates.set(ui, state);
  }
  return state;
};

const gameplayPolishFormatLabel = game => {
  if (game?.mode === 'penalties') return '5 rendes párbaj, döntetlennél hirtelen halál';
  const target = gameplayPolishApplyTarget(game);
  const format = GAMEPLAY_POLISH_FORMATS.find(entry => entry.value === target) ?? GAMEPLAY_POLISH_FORMATS.at(-1);
  return `${format.label} meccs · ${format.detail}`;
};

const gameplayPolishTeamLabels = game => ({
  human: gameplayPolishText(game?.quickMatch?.humanTeam) || 'Játékos',
  ai: gameplayPolishText(game?.quickMatch?.aiTeam) || 'Gép',
});

const gameplayPolishDismissIntro = ui => {
  const state = gameplayPolishState(ui);
  if (state.introTimer) globalThis.clearTimeout?.(state.introTimer);
  state.introTimer = 0;
  document.querySelector('.gameplay-match-intro')?.remove();
};

const gameplayPolishShowIntro = (ui, game) => {
  if (!game || typeof document === 'undefined') return;
  const state = gameplayPolishState(ui);
  gameplayPolishApplyTarget(game);
  if (state.introGame === game) return;
  state.introGame = game;
  gameplayPolishDismissIntro(ui);

  const teams = gameplayPolishTeamLabels(game);
  const overlay = el('button', 'gameplay-match-intro');
  overlay.type = 'button';
  overlay.setAttribute('aria-label', `${teams.human} és ${teams.ai} mérkőzése. Koppints az átugráshoz.`);
  const card = el('span', 'gameplay-match-intro__card');
  card.append(
    el('span', 'gameplay-match-intro__eyebrow', game.mode === 'penalties' ? 'Penalties mód' : 'Kezdődik a mérkőzés'),
  );
  const matchup = el('span', 'gameplay-match-intro__teams');
  matchup.append(
    el('span', 'gameplay-match-intro__team', teams.human),
    el('span', 'gameplay-match-intro__versus', 'VS'),
    el('span', 'gameplay-match-intro__team', teams.ai),
  );
  card.append(
    matchup,
    el('span', 'gameplay-match-intro__format', gameplayPolishFormatLabel(game)),
    el('span', 'gameplay-match-intro__skip', 'Koppints az átugráshoz'),
  );
  overlay.appendChild(card);
  overlay.addEventListener('click', () => gameplayPolishDismissIntro(ui), { once: true });
  document.body.appendChild(overlay);
  state.introTimer = globalThis.setTimeout?.(() => gameplayPolishDismissIntro(ui), GAMEPLAY_POLISH_INTRO_DURATION) ?? 0;
};

const gameplayPolishWrapOpponentCard = ui => {
  if (!ui.settings?.animations || !ui.dom?.duel) return;
  const slots = [...ui.dom.duel.querySelectorAll('.duel-slot')];
  const front = slots[1]?.querySelector('.card:not(.card--back)');
  if (!front || front.closest('.gameplay-flip-card')) return;
  const wrapper = el('div', 'gameplay-flip-card');
  const back = ui.renderCard(null, { faceDown: true });
  back.classList.add('gameplay-flip-card__back');
  front.classList.add('gameplay-flip-card__front');
  front.replaceWith(wrapper);
  wrapper.append(back, front);
};

const gameplayPolishInjectFormatPicker = (ui, panel) => {
  if (!panel?.classList?.contains('mobile-home') || panel.querySelector('.gameplay-format-picker')) return;
  const fieldset = el('fieldset', 'gameplay-format-picker');
  fieldset.appendChild(el('legend', null, 'Klasszikus meccs hossza'));
  const options = el('div', 'gameplay-format-options');
  const selected = gameplayPolishReadTarget();
  for (const format of GAMEPLAY_POLISH_FORMATS) {
    const label = el('label', 'gameplay-format-option');
    const input = el('input');
    input.type = 'radio';
    input.name = 'classic-match-target';
    input.value = String(format.value);
    input.checked = selected === format.value;
    input.setAttribute('aria-label', `${format.label}: ${format.detail}`);
    input.addEventListener('change', () => {
      if (!input.checked) return;
      gameplayPolishWrite(GAMEPLAY_POLISH_MATCH_KEY, format.value);
      ui.showToast?.(`${format.label} meccs kiválasztva`, 'success', 1800);
    });
    label.append(input, el('strong', null, format.label), el('small', null, format.detail));
    options.appendChild(label);
  }
  fieldset.appendChild(options);
  panel.querySelector('.primary-mode-actions')?.before(fieldset);
};

const gameplayPolishCurrentTeam = selector => ({
  label: gameplayPolishText(selector?.querySelector('.quick-team-card__name')?.textContent),
  category: gameplayPolishText(selector?.querySelector('.quick-category-segment.is-active')?.dataset?.category),
});

const gameplayPolishRememberRecent = entry => {
  if (!entry.label || !entry.category) return;
  const current = gameplayPolishReadTeams(GAMEPLAY_POLISH_RECENTS_KEY);
  const key = gameplayPolishTeamKey(entry);
  gameplayPolishWrite(
    GAMEPLAY_POLISH_RECENTS_KEY,
    [entry, ...current.filter(item => gameplayPolishTeamKey(item) !== key)].slice(0, GAMEPLAY_POLISH_TEAM_HISTORY_LIMIT),
  );
};

const gameplayPolishNavigateTeam = (ui, selector, entry) => {
  const category = selector.querySelector(`.quick-category-segment[data-category="${entry.category}"]`);
  category?.click();
  const next = selector.querySelector('.quick-carousel__arrow--next');
  const maxSteps = Math.max(1, selector.querySelectorAll('.quick-carousel__dot').length || 40);
  for (let step = 0; step < maxSteps; step += 1) {
    if (gameplayPolishCurrentTeam(selector).label === entry.label) {
      ui.showToast?.(`${entry.label} kiválasztva`, 'success', 1600);
      return true;
    }
    next?.click();
  }
  ui.showToast?.('A mentett csapat ebben az adatbázisban már nem érhető el.', 'error', 2400);
  return false;
};

const gameplayPolishDecorateSelector = (ui, panel) => {
  const selector = panel?.querySelector?.('.deck-selector');
  if (!selector || selector.dataset.gameplayPolishBound === 'true') return false;
  const position = selector.querySelector('.quick-carousel__position');
  const teamCard = selector.querySelector('.quick-team-card');
  if (!position || !teamCard) return false;
  selector.dataset.gameplayPolishBound = 'true';

  const memory = el('section', 'quick-team-memory');
  memory.setAttribute('aria-label', 'Kedvenc és legutóbbi csapatok');
  const top = el('div', 'quick-team-memory__top');
  const favourite = el('button', 'quick-team-memory__favourite');
  favourite.type = 'button';
  const shortcuts = el('div', 'quick-team-memory__shortcuts');
  top.appendChild(favourite);
  memory.append(top, shortcuts);
  position.after(memory);

  const render = () => {
    const current = gameplayPolishCurrentTeam(selector);
    const currentKey = gameplayPolishTeamKey(current);
    const favourites = gameplayPolishReadTeams(GAMEPLAY_POLISH_FAVOURITES_KEY);
    const recents = gameplayPolishReadTeams(GAMEPLAY_POLISH_RECENTS_KEY);
    const isFavourite = Boolean(current.label && favourites.some(entry => gameplayPolishTeamKey(entry) === currentKey));
    favourite.disabled = !current.label;
    favourite.classList.toggle('is-active', isFavourite);
    favourite.textContent = isFavourite ? '★ Kedvenc csapat' : '☆ Kedvencekhez adás';
    favourite.setAttribute('aria-pressed', String(isFavourite));

    const merged = gameplayPolishSanitiseTeams([...favourites, ...recents]);
    shortcuts.replaceChildren(...merged.map(entry => {
      const button = el('button', 'quick-team-memory__shortcut', `${favourites.some(item => gameplayPolishTeamKey(item) === gameplayPolishTeamKey(entry)) ? '★' : '↻'} ${entry.label}`);
      button.type = 'button';
      button.title = entry.label;
      button.addEventListener('click', () => gameplayPolishNavigateTeam(ui, selector, entry));
      return button;
    }));
    shortcuts.hidden = merged.length === 0;
  };

  favourite.addEventListener('click', () => {
    const current = gameplayPolishCurrentTeam(selector);
    if (!current.label || !current.category) return;
    const items = gameplayPolishReadTeams(GAMEPLAY_POLISH_FAVOURITES_KEY);
    const key = gameplayPolishTeamKey(current);
    const exists = items.some(entry => gameplayPolishTeamKey(entry) === key);
    const updated = exists
      ? items.filter(entry => gameplayPolishTeamKey(entry) !== key)
      : [current, ...items].slice(0, GAMEPLAY_POLISH_TEAM_HISTORY_LIMIT);
    gameplayPolishWrite(GAMEPLAY_POLISH_FAVOURITES_KEY, updated);
    ui.showToast?.(exists ? 'Eltávolítva a kedvencek közül' : 'Csapat elmentve a kedvencekhez', 'success', 1800);
    render();
  });

  selector.querySelector('.quick-opponent-controls .deck-selector__primary')?.addEventListener('click', () => {
    gameplayPolishRememberRecent(gameplayPolishCurrentTeam(selector));
  }, true);

  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(render);
    observer.observe(teamCard, { childList: true, subtree: true });
  }
  render();
  return true;
};

const gameplayPolishWatchSelector = (ui, panel) => {
  const state = gameplayPolishState(ui);
  state.selectorObserver?.disconnect?.();
  state.selectorObserver = null;
  if (gameplayPolishDecorateSelector(ui, panel) || typeof MutationObserver !== 'function') return;
  const observer = new MutationObserver(() => {
    if (!gameplayPolishDecorateSelector(ui, panel)) return;
    observer.disconnect();
    if (state.selectorObserver === observer) state.selectorObserver = null;
  });
  observer.observe(panel, { childList: true, subtree: true });
  state.selectorObserver = observer;
  globalThis.setTimeout?.(() => {
    observer.disconnect();
    if (state.selectorObserver === observer) state.selectorObserver = null;
  }, 5000);
};

beginUiEnhancementLayer(GAMEPLAY_POLISH_LAYER);
try {
  gameplayPolishPatchClassicGame();
  gameplayPolishEnsureStyles();

  const gameplayPolishPrevious = Object.freeze({
    resetTable: UI.prototype.resetTable,
    renderHands: UI.prototype.renderHands,
    renderScores: UI.prototype.renderScores,
    showAttributePicker: UI.prototype.showAttributePicker,
    showDuel: UI.prototype.showDuel,
    showOverlay: UI.prototype.showOverlay,
  });

  UI.prototype.resetTable = function resetTableWithGameplayPolish(...args) {
    const state = gameplayPolishState(this);
    state.introGame = null;
    gameplayPolishDismissIntro(this);
    return gameplayPolishPrevious.resetTable.apply(this, args);
  };

  UI.prototype.renderHands = function renderHandsWithGameplayPolish(game, options = {}) {
    gameplayPolishApplyTarget(game);
    const output = gameplayPolishPrevious.renderHands.call(this, game, options);
    gameplayPolishShowIntro(this, game);
    return output;
  };

  UI.prototype.showAttributePicker = function showAttributePickerWithGameplayPolish(game) {
    gameplayPolishApplyTarget(game);
    const output = gameplayPolishPrevious.showAttributePicker.call(this, game);
    gameplayPolishShowIntro(this, game);
    return output;
  };

  UI.prototype.renderScores = function renderScoresWithGameplayPolish(game) {
    gameplayPolishApplyTarget(game);
    const output = gameplayPolishPrevious.renderScores.call(this, game);
    const target = gameplayPolishValidTarget(game?.[GAMEPLAY_POLISH_TARGET_FIELD]);
    this.dom?.hudMeta?.querySelector?.('.gameplay-target-score')?.remove?.();
    if (target > 0 && game?.mode === 'classic' && this.dom?.hudMeta) {
      const wins = gameplayPolishRoundWins(game);
      this.dom.hudMeta.appendChild(el('span', 'gameplay-target-score', `Körök ${wins[HUMAN]}–${wins[AI]} · cél ${target}`));
    }
    return output;
  };

  UI.prototype.showDuel = function showDuelWithGameplayPolish(game, options = {}) {
    const output = gameplayPolishPrevious.showDuel.call(this, game, options);
    if (options.result) gameplayPolishWrapOpponentCard(this);
    return output;
  };

  UI.prototype.showOverlay = function showOverlayWithGameplayPolish(panel) {
    gameplayPolishInjectFormatPicker(this, panel);
    const output = gameplayPolishPrevious.showOverlay.call(this, panel);
    if (panel?.classList?.contains('mobile-home')) gameplayPolishWatchSelector(this, panel);
    return output;
  };

  commitUiEnhancementLayer(GAMEPLAY_POLISH_LAYER);
} catch (error) {
  rollbackUiEnhancementLayer(GAMEPLAY_POLISH_LAYER);
  throw error;
}

export {
  GAMEPLAY_POLISH_FORMATS,
  gameplayPolishReadTarget,
  gameplayPolishRoundWins,
};
