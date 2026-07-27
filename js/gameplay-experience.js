/** Lightweight progression, feedback and replay helpers layered over the existing UI. */

import { ATTRIBUTE_BY_KEY, attributeValue } from './data/players.js';
import { AI, HUMAN, PHASE } from './engine.js';
import { UI, el } from './ui.js';

const GAMEPLAY_EXPERIENCE_STYLE_ID = 'gameplay-experience-styles';
const GAMEPLAY_EXPERIENCE_AUTO_KEY = 'fociskartyak:experience:auto-advance:v1';
const GAMEPLAY_EXPERIENCE_DISCOVERY_KEY = 'fociskartyak:experience:discovered:v1';
const GAMEPLAY_EXPERIENCE_TOTAL_KEY = 'fociskartyak:experience:player-total:v1';
const GAMEPLAY_EXPERIENCE_DAILY_KEY = 'fociskartyak:experience:daily:v1';
const GAMEPLAY_EXPERIENCE_HISTORY_KEY = 'fociskartyak:experience:category-history:v1';
const GAMEPLAY_EXPERIENCE_AUTO_DELAY = 2600;
const GAMEPLAY_EXPERIENCE_RECENT_CATEGORY_COUNT = 2;
const GAMEPLAY_EXPERIENCE_HISTORY_LIMIT = 5;
const GAMEPLAY_EXPERIENCE_DAILY_CATEGORIES = Object.freeze([
  'goals', 'appearances', 'birthDate', 'yellowCards', 'starts', 'marketValue',
]);

const gameplayExperiencePrevious = Object.freeze({
  resetTable: UI.prototype.resetTable,
  setMode: UI.prototype.setMode,
  showAttributePicker: UI.prototype.showAttributePicker,
  renderHands: UI.prototype.renderHands,
  showDuel: UI.prototype.showDuel,
  showVerdict: UI.prototype.showVerdict,
  showOverlay: UI.prototype.showOverlay,
});

const gameplayExperienceStates = new WeakMap();

const gameplayExperienceSafeParse = (value, fallback) => {
  try {
    const parsed = JSON.parse(value);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
};

const gameplayExperienceRead = (key, fallback) => {
  try {
    const value = globalThis.localStorage?.getItem(key);
    return value == null ? fallback : gameplayExperienceSafeParse(value, fallback);
  } catch {
    return fallback;
  }
};

const gameplayExperienceWrite = (key, value) => {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

const gameplayExperienceToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const gameplayExperienceDailyCategory = dateKey => {
  const numeric = [...String(dateKey)].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return GAMEPLAY_EXPERIENCE_DAILY_CATEGORIES[numeric % GAMEPLAY_EXPERIENCE_DAILY_CATEGORIES.length];
};

const gameplayExperienceDailyState = () => {
  const date = gameplayExperienceToday();
  const stored = gameplayExperienceRead(GAMEPLAY_EXPERIENCE_DAILY_KEY, null);
  if (stored?.date === date) {
    return {
      date,
      duels: Math.max(0, Number(stored.duels) || 0),
      wins: Math.max(0, Number(stored.wins) || 0),
      categoryWins: Array.isArray(stored.categoryWins) ? [...new Set(stored.categoryWins)] : [],
    };
  }
  return { date, duels: 0, wins: 0, categoryWins: [] };
};

const gameplayExperienceFreshMatch = mode => ({
  mode: mode === 'penalties' ? 'penalties' : 'classic',
  duels: 0,
  wins: 0,
  losses: 0,
  ties: 0,
  streakSide: null,
  streak: 0,
  maxHumanStreak: 0,
  categoryCounts: {},
  closest: null,
  biggestWin: null,
  bestHumanCard: null,
});

const gameplayExperienceEnsureStyles = () => {
  if (typeof document === 'undefined' || document.getElementById(GAMEPLAY_EXPERIENCE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = GAMEPLAY_EXPERIENCE_STYLE_ID;
  style.textContent = `
    .experience-round-intro { position: fixed; z-index: 1200; top: max(76px, env(safe-area-inset-top, 0px)); left: 50%; width: min(88vw, 430px); padding: 12px 18px; border: 1px solid rgba(239,212,144,.7); border-radius: 999px; background: rgba(18,13,9,.95); color: #fff7df; font-size: clamp(15px, 4vw, 20px); font-weight: 950; text-align: center; box-shadow: 0 14px 36px rgba(0,0,0,.52), 0 0 24px rgba(213,170,85,.18); transform: translate(-50%, -12px); opacity: 0; pointer-events: none; animation: experience-round-intro 720ms ease both; }
    @keyframes experience-round-intro { 12%, 72% { opacity: 1; transform: translate(-50%, 0); } 100% { opacity: 0; transform: translate(-50%, -8px); } }
    #pub.experience-result-win #felt { box-shadow: inset 0 0 88px rgba(55,151,83,.34), 0 0 32px rgba(123,210,141,.3); }
    #pub.experience-result-loss #felt { box-shadow: inset 0 0 88px rgba(161,53,53,.28), 0 0 26px rgba(224,128,128,.2); }
    #pub.experience-result-tie #felt { box-shadow: inset 0 0 88px rgba(174,139,51,.24), 0 0 26px rgba(226,200,121,.18); }
    .experience-result-badge { display: inline-flex; align-items: center; justify-content: center; margin-top: 8px; padding: 5px 10px; border: 1px solid currentColor; border-radius: 999px; font-size: clamp(10px, 2.7vw, 12px); font-weight: 900; letter-spacing: .04em; }
    .experience-streak-badge { display: inline-flex; margin-left: 6px; padding: 3px 7px; border-radius: 999px; background: rgba(239,212,144,.14); color: #f2d98f; font-size: 10px; font-weight: 900; white-space: nowrap; }
    .experience-history { width: min(900px, 100%); display: flex; align-items: center; gap: 6px; padding: 2px 4px; overflow-x: auto; color: #c5b79f; scrollbar-width: none; }
    .experience-history::-webkit-scrollbar { display: none; }
    .experience-history__label { flex: 0 0 auto; font-size: 9px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    .experience-history__chip { flex: 0 0 auto; padding: 4px 8px; border: 1px solid rgba(239,212,144,.28); border-radius: 999px; background: rgba(15,12,9,.72); color: #fff7df; font-size: 10px; }
    #attribute-picker .is-recent-category { opacity: .68; }
    #attribute-picker .is-recent-category::after { content: 'Nemrég'; position: absolute; right: 7px; bottom: 7px; padding: 2px 5px; border-radius: 999px; background: rgba(0,0,0,.56); color: #e7d5ad; font-size: 8px; font-weight: 850; }
    .experience-auto-status { display: block; margin-top: 4px; color: #f0d993; font-size: 10px; font-weight: 850; }
    .experience-home-card, .experience-summary { display: grid; gap: 10px; margin: 14px 0; padding: 13px; border: 1px solid rgba(232,195,122,.3); border-radius: 16px; background: rgba(0,0,0,.22); }
    .experience-home-card h2, .experience-summary h2 { margin: 0; font-size: 15px; }
    .experience-progress { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
    .experience-progress__item { min-width: 0; padding: 9px; border-radius: 12px; background: rgba(255,255,255,.045); }
    .experience-progress__item strong { display: block; color: #fff7df; font-size: 13px; }
    .experience-progress__item small { display: block; margin-top: 3px; color: #bdae94; font-size: 10px; line-height: 1.3; }
    .experience-challenges { display: grid; gap: 6px; }
    .experience-challenge { display: grid; grid-template-columns: 20px minmax(0,1fr) auto; align-items: center; gap: 7px; padding: 7px 8px; border-radius: 10px; background: rgba(255,255,255,.035); color: #e9ddc8; font-size: 11px; }
    .experience-challenge.is-complete { color: #9ee1a8; }
    .experience-summary dl { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; margin: 0; }
    .experience-summary dl div { padding: 9px; border-radius: 11px; background: rgba(255,255,255,.045); }
    .experience-summary dt { color: #bdae94; font-size: 9px; font-weight: 850; text-transform: uppercase; }
    .experience-summary dd { margin: 4px 0 0; color: #fff7df; font-size: 12px; font-weight: 850; line-height: 1.25; }
    .result-actions #new-opponent-btn { order: 2; }
    .setting-switch[data-setting='autoAdvance'] { border-color: rgba(239,212,144,.38); }
    @media (max-width: 620px) { .experience-progress, .experience-summary dl { grid-template-columns: 1fr; } }
    @media (prefers-reduced-motion: reduce) { .experience-round-intro { animation-duration: 1ms; } }
  `;
  document.head?.appendChild(style);
};

const gameplayExperienceGetState = ui => {
  let state = gameplayExperienceStates.get(ui);
  if (state) return state;
  const discovered = new Set(gameplayExperienceRead(GAMEPLAY_EXPERIENCE_DISCOVERY_KEY, []));
  const history = gameplayExperienceRead(GAMEPLAY_EXPERIENCE_HISTORY_KEY, [])
    .filter(value => typeof value === 'string')
    .slice(0, GAMEPLAY_EXPERIENCE_HISTORY_LIMIT);
  state = {
    match: gameplayExperienceFreshMatch(ui.mode),
    discovered,
    history,
    daily: gameplayExperienceDailyState(),
    autoAdvance: Boolean(gameplayExperienceRead(GAMEPLAY_EXPERIENCE_AUTO_KEY, false)),
    autoTimer: 0,
    feedbackTimer: 0,
    introTimer: 0,
    awaitingContinue: false,
    scheduledButton: null,
    pickerObserver: null,
  };
  const picker = ui.dom?.picker;
  if (picker && typeof MutationObserver === 'function') {
    state.pickerObserver = new MutationObserver(() => gameplayExperienceMaybeScheduleAutoAdvance(ui));
    state.pickerObserver.observe(picker, { childList: true, subtree: true });
  }
  gameplayExperienceStates.set(ui, state);
  return state;
};

const gameplayExperienceCancelAuto = ui => {
  const state = gameplayExperienceGetState(ui);
  if (state.autoTimer) globalThis.clearTimeout?.(state.autoTimer);
  state.autoTimer = 0;
  state.scheduledButton = null;
  document.querySelector('.experience-auto-status')?.remove();
};

const gameplayExperienceShowIntro = (ui, label, detail = '') => {
  const state = gameplayExperienceGetState(ui);
  if (!ui.settings?.animations) return;
  document.querySelector('.experience-round-intro')?.remove();
  const intro = el('div', 'experience-round-intro', detail ? `${label} · ${detail}` : label);
  intro.setAttribute('role', 'status');
  intro.setAttribute('aria-live', 'polite');
  document.body.appendChild(intro);
  if (state.introTimer) globalThis.clearTimeout?.(state.introTimer);
  state.introTimer = globalThis.setTimeout?.(() => intro.remove(), 780) ?? 0;
};

const gameplayExperienceHistoryLabel = key => {
  const attribute = ATTRIBUTE_BY_KEY[key];
  return attribute ? `${attribute.icon} ${attribute.shortLabel ?? attribute.label}` : key;
};

const gameplayExperienceRenderHistory = ui => {
  const state = gameplayExperienceGetState(ui);
  let bar = document.querySelector('#experience-category-history');
  if (!state.history.length) {
    bar?.remove();
    return;
  }
  if (!bar) {
    bar = el('div', 'experience-history');
    bar.id = 'experience-category-history';
    bar.setAttribute('aria-label', 'Legutóbbi kategóriák');
    const context = document.querySelector('#match-context');
    if (context) context.after(bar);
    else ui.dom?.prompt?.before(bar);
  }
  bar.replaceChildren(
    el('span', 'experience-history__label', 'Legutóbbi'),
    ...state.history.map(key => el('span', 'experience-history__chip', gameplayExperienceHistoryLabel(key))),
  );
};

const gameplayExperienceRecordCategory = (ui, key) => {
  if (!key) return;
  const state = gameplayExperienceGetState(ui);
  state.history = [key, ...state.history.filter(value => value !== key)].slice(0, GAMEPLAY_EXPERIENCE_HISTORY_LIMIT);
  gameplayExperienceWrite(GAMEPLAY_EXPERIENCE_HISTORY_KEY, state.history);
  gameplayExperienceRenderHistory(ui);
};

const gameplayExperienceDecorateCategories = ui => {
  const state = gameplayExperienceGetState(ui);
  const grid = ui.dom?.picker?.querySelector('.category-grid') ?? ui.dom?.picker;
  if (!grid) return;
  const recent = new Set(state.history.slice(0, GAMEPLAY_EXPERIENCE_RECENT_CATEGORY_COUNT));
  const buttons = [...grid.querySelectorAll(':scope > button[data-attribute], :scope > .category-tile[data-attribute]')];
  const recentButtons = [];
  for (const button of buttons) {
    const isRecent = recent.has(button.dataset.attribute);
    button.classList.toggle('is-recent-category', isRecent);
    if (isRecent) recentButtons.push(button);
  }
  if (buttons.length > recentButtons.length + 1) recentButtons.forEach(button => grid.appendChild(button));
};

const gameplayExperienceDuelMetrics = result => {
  const attribute = ATTRIBUTE_BY_KEY[result?.attribute];
  if (!attribute || !result?.humanCard || !result?.aiCard) return null;
  const human = attributeValue(result.humanCard, result.attribute);
  const ai = attributeValue(result.aiCard, result.attribute);
  if (!Number.isFinite(human) || !Number.isFinite(ai)) return null;
  const difference = Math.abs(human - ai);
  const ratio = result.attribute.startsWith('birthDate')
    ? difference / (365.25 * 24 * 60 * 60 * 1000)
    : difference / Math.max(Math.abs(human), Math.abs(ai), 1);
  return { difference, ratio, human, ai };
};

const gameplayExperienceMarkDiscovery = (ui, cards = []) => {
  const state = gameplayExperienceGetState(ui);
  const newNames = [];
  for (const card of cards) {
    if (!card?.id || state.discovered.has(card.id)) continue;
    state.discovered.add(card.id);
    newNames.push(card.name ?? 'Ismeretlen játékos');
  }
  if (!newNames.length) return;
  gameplayExperienceWrite(GAMEPLAY_EXPERIENCE_DISCOVERY_KEY, [...state.discovered]);
  const label = newNames.length === 1 ? `Új játékos: ${newNames[0]}` : `${newNames.length} új játékos került a gyűjteménybe`;
  ui.showToast?.(`🆕 ${label}`, 'success', 2400);
};

const gameplayExperienceDailyChallenges = daily => {
  const category = gameplayExperienceDailyCategory(daily.date);
  return [
    { id: 'duels', label: 'Játssz 3 párbajt', value: daily.duels, target: 3 },
    { id: 'wins', label: 'Nyerj 2 párbajt', value: daily.wins, target: 2 },
    { id: 'category', label: `Nyerj ebben: ${gameplayExperienceHistoryLabel(category)}`, value: daily.categoryWins.includes(category) ? 1 : 0, target: 1 },
  ];
};

const gameplayExperienceUpdateDaily = (ui, result) => {
  const state = gameplayExperienceGetState(ui);
  const before = gameplayExperienceDailyChallenges(state.daily).map(challenge => challenge.value >= challenge.target);
  state.daily.duels += 1;
  if (result.winner === HUMAN) {
    state.daily.wins += 1;
    if (!state.daily.categoryWins.includes(result.attribute)) state.daily.categoryWins.push(result.attribute);
  }
  gameplayExperienceWrite(GAMEPLAY_EXPERIENCE_DAILY_KEY, state.daily);
  const after = gameplayExperienceDailyChallenges(state.daily);
  after.forEach((challenge, index) => {
    if (!before[index] && challenge.value >= challenge.target) ui.showToast?.(`✅ Napi kihívás teljesítve: ${challenge.label}`, 'success', 2800);
  });
};

const gameplayExperienceFeedbackLabel = (result, metrics, match) => {
  if (result.winner === 'tie') return '⚖ Tökéletesen kiegyenlített párbaj';
  const streak = match.streak >= 2
    ? result.winner === HUMAN ? ` · 🔥 ${match.streak} győzelem sorban` : ` · a gép ${match.streak}-es sorozatban van`
    : '';
  if (!metrics) return result.winner === HUMAN ? `Szép győzelem${streak}` : `Most a gép volt jobb${streak}`;
  const close = result.attribute.startsWith('birthDate') ? metrics.ratio <= 1 : metrics.ratio <= 0.08;
  if (close) return `😮 Hajszálon múlt!${streak}`;
  if (metrics.ratio >= 0.45) return result.winner === HUMAN ? `💥 Fölényes győzelem!${streak}` : `A gép fölényesen nyert${streak}`;
  return result.winner === HUMAN ? `✓ Megnyerted${streak}` : `✕ A gép nyert${streak}`;
};

const gameplayExperienceUpdateMatch = (ui, result, game) => {
  const state = gameplayExperienceGetState(ui);
  const match = state.match;
  match.mode = game?.mode ?? match.mode;
  match.duels += 1;
  match.categoryCounts[result.attribute] = (match.categoryCounts[result.attribute] ?? 0) + 1;
  if (result.winner === HUMAN) match.wins += 1;
  else if (result.winner === AI) match.losses += 1;
  else match.ties += 1;

  if (result.winner === 'tie') {
    match.streakSide = null;
    match.streak = 0;
  } else if (match.streakSide === result.winner) {
    match.streak += 1;
  } else {
    match.streakSide = result.winner;
    match.streak = 1;
  }
  if (result.winner === HUMAN) match.maxHumanStreak = Math.max(match.maxHumanStreak, match.streak);

  const metrics = gameplayExperienceDuelMetrics(result);
  if (metrics) {
    const record = { ratio: metrics.ratio, attribute: result.attribute, humanCard: result.humanCard, aiCard: result.aiCard };
    if (!match.closest || metrics.ratio < match.closest.ratio) match.closest = record;
    if (result.winner === HUMAN && (!match.biggestWin || metrics.ratio > match.biggestWin.ratio)) match.biggestWin = record;
    if (result.winner === HUMAN && (!match.bestHumanCard || metrics.ratio > match.bestHumanCard.ratio)) {
      match.bestHumanCard = { ratio: metrics.ratio, card: result.humanCard, attribute: result.attribute };
    }
  }
  return { match, metrics };
};

const gameplayExperienceApplyResultEffect = (ui, result, label) => {
  const state = gameplayExperienceGetState(ui);
  const pub = ui.dom?.pub;
  pub?.classList.remove('experience-result-win', 'experience-result-loss', 'experience-result-tie');
  const className = result.winner === HUMAN ? 'experience-result-win'
    : result.winner === AI ? 'experience-result-loss' : 'experience-result-tie';
  pub?.classList.add(className);
  if (state.feedbackTimer) globalThis.clearTimeout?.(state.feedbackTimer);
  state.feedbackTimer = globalThis.setTimeout?.(() => pub?.classList.remove(className), 1100) ?? 0;
  const badge = el('span', 'experience-result-badge', label);
  badge.setAttribute('role', 'status');
  ui.dom?.verdict?.appendChild(badge);
  if (ui.settings?.vibration && typeof navigator?.vibrate === 'function') {
    navigator.vibrate(result.winner === HUMAN ? [35, 45, 70] : result.winner === AI ? [90] : [30, 35, 30]);
  }
};

const gameplayExperienceMaybeScheduleAutoAdvance = ui => {
  const state = gameplayExperienceGetState(ui);
  if (!state.awaitingContinue || !state.autoAdvance || state.autoTimer) return;
  const button = ui.dom?.picker?.querySelector('.next-round-button:not(:disabled)');
  if (!button || state.scheduledButton === button) return;
  state.scheduledButton = button;
  const action = document.querySelector('#next-action-panel');
  const status = el('span', 'experience-auto-status', 'Automatikus továbblépés 3 másodperc múl');
  action?.querySelector('.next-action-panel__copy')?.appendChild(status);
  const cancel = () => gameplayExperienceCancelAuto(ui);
  button.addEventListener('click', cancel, { once: true });
  action?.addEventListener('click', cancel, { once: true });
  state.autoTimer = globalThis.setTimeout?.(() => {
    state.autoTimer = 0;
    state.awaitingContinue = false;
    status.remove();
    if (button.isConnected && !button.disabled) button.click();
  }, GAMEPLAY_EXPERIENCE_AUTO_DELAY) ?? 0;
};

const gameplayExperienceInjectSettings = (ui, panel) => {
  if (!panel?.classList.contains('settings-panel')) return;
  const state = gameplayExperienceGetState(ui);
  const list = panel.querySelector('.settings-list');
  if (!list || list.querySelector('[data-setting="autoAdvance"]')) return;
  const row = el('label', 'setting-switch');
  row.dataset.setting = 'autoAdvance';
  const copy = el('span', 'setting-switch__copy');
  copy.append(el('strong', null, '⏭ Automatikus továbblépés'), el('small', null, 'Az eredmény után röviden vár, majd indítja a következő kört'));
  const input = el('input');
  input.type = 'checkbox';
  input.checked = state.autoAdvance;
  input.setAttribute('aria-label', 'Automatikus továbblépés');
  input.addEventListener('change', () => {
    state.autoAdvance = input.checked;
    gameplayExperienceWrite(GAMEPLAY_EXPERIENCE_AUTO_KEY, state.autoAdvance);
    if (!state.autoAdvance) gameplayExperienceCancelAuto(ui);
    ui.showToast?.(state.autoAdvance ? 'Automatikus továbblépés bekapcsolva' : 'Automatikus továbblépés kikapcsolva');
  });
  row.append(copy, input, el('span', 'setting-switch__visual'));
  list.appendChild(row);
};

const gameplayExperienceRenderHome = (ui, panel) => {
  if (!panel?.classList.contains('mobile-home') || panel.querySelector('.experience-home-card')) return;
  const state = gameplayExperienceGetState(ui);
  const total = Math.max(state.discovered.size, Number(gameplayExperienceRead(GAMEPLAY_EXPERIENCE_TOTAL_KEY, 0)) || 0);
  const challenges = gameplayExperienceDailyChallenges(state.daily);
  const completed = challenges.filter(challenge => challenge.value >= challenge.target).length;
  const card = el('section', 'experience-home-card');
  card.innerHTML = `
    <h2>Mai fociskártya-küldetés</h2>
    <div class="experience-progress">
      <div class="experience-progress__item"><strong>🃏 ${state.discovered.size}${total ? ` / ${total}` : ''}</strong><small>megismert játékos</small></div>
      <div class="experience-progress__item"><strong>✅ ${completed} / ${challenges.length}</strong><small>napi kihívás teljesítve</small></div>
    </div>
    <div class="experience-challenges">
      ${challenges.map(challenge => {
        const done = challenge.value >= challenge.target;
        return `<div class="experience-challenge${done ? ' is-complete' : ''}"><span>${done ? '✓' : '○'}</span><span>${challenge.label}</span><b>${Math.min(challenge.value, challenge.target)}/${challenge.target}</b></div>`;
      }).join('')}
    </div>
  `;
  panel.querySelector('.secondary-menu-actions')?.before(card);
};

const gameplayExperienceSummaryValue = record => {
  if (!record) return '—';
  const attribute = gameplayExperienceHistoryLabel(record.attribute);
  if (record.card) return `${record.card.name} · ${attribute}`;
  if (record.humanCard && record.aiCard) return `${record.humanCard.name}–${record.aiCard.name} · ${attribute}`;
  return attribute;
};

const gameplayExperienceInjectResultSummary = (ui, panel) => {
  if (!panel?.classList.contains('result-panel') || panel.querySelector('.experience-summary')) return;
  const state = gameplayExperienceGetState(ui);
  const match = state.match;
  const mostUsedEntry = Object.entries(match.categoryCounts).sort((a, b) => b[1] - a[1])[0];
  const summary = el('section', 'experience-summary');
  summary.innerHTML = `
    <h2>Meccsösszefoglaló</h2>
    <dl>
      <div><dt>Legjobb saját kártya</dt><dd>${gameplayExperienceSummaryValue(match.bestHumanCard)}</dd></div>
      <div><dt>Legszorosabb párbaj</dt><dd>${gameplayExperienceSummaryValue(match.closest)}</dd></div>
      <div><dt>Legnagyobb győzelem</dt><dd>${gameplayExperienceSummaryValue(match.biggestWin)}</dd></div>
      <div><dt>Legtöbbször választott</dt><dd>${mostUsedEntry ? `${gameplayExperienceHistoryLabel(mostUsedEntry[0])} · ${mostUsedEntry[1]}×` : '—'}</dd></div>
      <div><dt>Legjobb győzelmi sorozat</dt><dd>${match.maxHumanStreak || 0}</dd></div>
      <div><dt>Párbajmérleg</dt><dd>${match.wins} győzelem · ${match.losses} vereség · ${match.ties} döntetlen</dd></div>
    </dl>
  `;
  const actions = panel.querySelector('.result-actions');
  actions?.before(summary);
  if (actions && !actions.querySelector('#new-opponent-btn')) {
    const button = el('button', 'btn btn--ghost', 'Új ellenfél');
    button.id = 'new-opponent-btn';
    button.addEventListener('click', () => panel.querySelector('#menu-btn')?.click(), { once: true });
    actions.appendChild(button);
  }
};

UI.prototype.resetTable = function resetTableWithGameplayExperience(...args) {
  const state = gameplayExperienceGetState(this);
  gameplayExperienceCancelAuto(this);
  state.awaitingContinue = false;
  state.match = gameplayExperienceFreshMatch(this.mode);
  document.querySelector('.experience-round-intro')?.remove();
  document.querySelector('#experience-category-history')?.remove();
  this.dom?.pub?.classList.remove('experience-result-win', 'experience-result-loss', 'experience-result-tie');
  return gameplayExperiencePrevious.resetTable.apply(this, args);
};

UI.prototype.setMode = function setModeWithGameplayExperience(mode) {
  const output = gameplayExperiencePrevious.setMode.call(this, mode);
  gameplayExperienceGetState(this).match.mode = mode;
  return output;
};

UI.prototype.showAttributePicker = function showAttributePickerWithGameplayExperience(game) {
  const output = gameplayExperiencePrevious.showAttributePicker.call(this, game);
  const state = gameplayExperienceGetState(this);
  const total = Math.max(Number(game?.poolSize) || 0, Number(game?.players?.length) || 0);
  if (total) gameplayExperienceWrite(GAMEPLAY_EXPERIENCE_TOTAL_KEY, total);
  state.awaitingContinue = false;
  gameplayExperienceCancelAuto(this);
  gameplayExperienceDecorateCategories(this);
  gameplayExperienceRenderHistory(this);
  gameplayExperienceShowIntro(this, 'Te választasz', `${game?.round ?? 1}. ${game?.mode === 'penalties' ? 'párbaj' : 'kör'}`);
  return output;
};

UI.prototype.renderHands = function renderHandsWithGameplayExperience(game, options = {}) {
  const output = gameplayExperiencePrevious.renderHands.call(this, game, options);
  if (game?.phase === PHASE.CHOOSE_ATTRIBUTE && game?.chooser === AI && !options.selectable) {
    gameplayExperienceShowIntro(this, 'A gép választ', `${game?.round ?? 1}. ${game?.mode === 'penalties' ? 'párbaj' : 'kör'}`);
  }
  return output;
};

UI.prototype.showDuel = function showDuelWithGameplayExperience(game, options = {}) {
  const output = gameplayExperiencePrevious.showDuel.call(this, game, options);
  if (options.result) gameplayExperienceMarkDiscovery(this, [options.result.humanCard, options.result.aiCard]);
  return output;
};

UI.prototype.showVerdict = function showVerdictWithGameplayExperience(result, game) {
  const output = gameplayExperiencePrevious.showVerdict.call(this, result, game);
  const state = gameplayExperienceGetState(this);
  const { match, metrics } = gameplayExperienceUpdateMatch(this, result, game);
  gameplayExperienceRecordCategory(this, result.attribute);
  gameplayExperienceUpdateDaily(this, result);
  gameplayExperienceMarkDiscovery(this, [result.humanCard, result.aiCard]);
  const label = gameplayExperienceFeedbackLabel(result, metrics, match);
  gameplayExperienceApplyResultEffect(this, result, label);
  const title = document.querySelector('#next-action-panel .next-action-panel__title');
  if (title && match.streak >= 2) {
    title.appendChild(el('span', 'experience-streak-badge', match.streakSide === HUMAN ? `🔥 ${match.streak}×` : `Gép: ${match.streak}×`));
  }
  state.awaitingContinue = true;
  gameplayExperienceMaybeScheduleAutoAdvance(this);
  return output;
};

UI.prototype.showOverlay = function showOverlayWithGameplayExperience(panel) {
  gameplayExperienceInjectSettings(this, panel);
  gameplayExperienceRenderHome(this, panel);
  gameplayExperienceInjectResultSummary(this, panel);
  return gameplayExperiencePrevious.showOverlay.call(this, panel);
};

gameplayExperienceEnsureStyles();
