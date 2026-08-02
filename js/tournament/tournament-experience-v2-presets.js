/** Saját torna gyors előbeállítások a meglévő v2 varázslóhoz. */

import {
  OPPONENT_MODE,
  TOURNAMENT_FORMAT,
  TOURNAMENT_MATCH_MODE,
  readDraft,
  saveDraft,
} from './tournament-experience-v2-shared.js';

const TOURNAMENT_PRESET_STYLE_ID = 'tournament-experience-v2-preset-style';
const TOURNAMENT_PRESET_SECTION_SELECTOR = '[data-tournament-quick-presets]';
const TOURNAMENT_PRESET_APPLYING = 'tournamentPresetApplying';
const TOURNAMENT_QUICK_PRESETS = Object.freeze([
  Object.freeze({
    key: 'short',
    title: 'Rövid torna',
    description: '4 csapatos, gyors kieséses kupa véletlenszerű ellenfelekkel.',
    format: TOURNAMENT_FORMAT.KNOCKOUT,
    count: 4,
    opponentMode: OPPONENT_MODE.RANDOM,
    matchMode: TOURNAMENT_MATCH_MODE.CLASSIC,
    difficulty: 'easy',
    icon: '⚡',
  }),
  Object.freeze({
    key: 'classic',
    title: 'Klasszikus torna',
    description: '8 csapat, csoportkör és kieséses szakasz kiegyensúlyozott tempóval.',
    format: TOURNAMENT_FORMAT.GROUP_KNOCKOUT,
    count: 8,
    opponentMode: OPPONENT_MODE.RANDOM,
    matchMode: TOURNAMENT_MATCH_MODE.CLASSIC,
    difficulty: 'medium',
    icon: '🏆',
  }),
  Object.freeze({
    key: 'long',
    title: 'Hosszú bajnokság',
    description: 'A lehető legnagyobb körmérkőzéses mezőny hosszabb játékhoz.',
    format: TOURNAMENT_FORMAT.LEAGUE,
    count: 16,
    opponentMode: OPPONENT_MODE.RANDOM,
    matchMode: TOURNAMENT_MATCH_MODE.CLASSIC,
    difficulty: 'medium',
    icon: '🏟️',
  }),
]);

function ensureTournamentPresetStyle() {
  if (document.getElementById(TOURNAMENT_PRESET_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TOURNAMENT_PRESET_STYLE_ID;
  style.textContent = `
    .tx-quick-presets{display:grid;gap:12px;border-color:rgba(139,222,93,.34);background:linear-gradient(145deg,rgba(39,91,39,.2),rgba(0,0,0,.22))}
    .tx-quick-presets__intro{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.tx-quick-presets__intro p{max-width:680px;color:#d4dfd0;font-size:.82rem;line-height:1.45}
    .tx-quick-presets__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .tx-quick-preset{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start;gap:10px;min-height:112px;padding:14px;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:rgba(4,15,9,.48);color:inherit;text-align:left}
    .tx-quick-preset:hover{border-color:rgba(166,241,112,.62);transform:translateY(-1px)}.tx-quick-preset:active{transform:translateY(1px)}
    .tx-quick-preset.is-selected{border-color:#a7f46d;background:linear-gradient(145deg,rgba(54,128,48,.55),rgba(11,43,25,.72));box-shadow:0 0 0 2px rgba(167,244,109,.12),0 12px 30px rgba(0,0,0,.2)}
    .tx-quick-preset__icon{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;background:rgba(255,255,255,.08);font-size:1.35rem}.tx-quick-preset strong{display:block;margin-bottom:5px}.tx-quick-preset small{display:block;color:#c6d1c3;line-height:1.4}
    .tx-quick-preset__check{position:absolute;right:10px;top:10px;display:none;color:#b9ff87;font-weight:1000}.tx-quick-preset.is-selected .tx-quick-preset__check{display:block}
    .tx-quick-presets__status{min-height:1.2em;margin:0;color:#b9ff87;font-size:.75rem;font-weight:850}
    @media(max-width:760px){.tx-quick-presets__grid{grid-template-columns:1fr}.tx-quick-preset{min-height:92px}}
    @media(prefers-reduced-motion:reduce){.tx-quick-preset{transition:none}.tx-quick-preset:hover,.tx-quick-preset:active{transform:none}}
  `;
  document.head.appendChild(style);
}

const scheduleTournamentPresetTask = callback => {
  const scheduler = globalThis.requestAnimationFrame
    ? next => globalThis.requestAnimationFrame(next)
    : next => globalThis.setTimeout?.(next, 0);
  scheduler(callback);
};

function clickTournamentPresetOption(selector, value, onComplete, retry = 0) {
  const target = [...document.querySelectorAll(selector)]
    .find(button => String(button.dataset[selector.includes('data-format') ? 'format'
      : selector.includes('data-count') ? 'count'
        : selector.includes('data-opponent-mode') ? 'opponentMode'
          : selector.includes('data-match-mode') ? 'matchMode'
            : 'difficulty']) === String(value));
  if (target) {
    target.click();
    scheduleTournamentPresetTask(onComplete);
    return;
  }
  if (retry < 8) {
    scheduleTournamentPresetTask(() => clickTournamentPresetOption(selector, value, onComplete, retry + 1));
    return;
  }
  onComplete();
}

function clickClosestTournamentCount(targetCount, onComplete, retry = 0) {
  const buttons = [...document.querySelectorAll('[data-count]')];
  if (buttons.length) {
    const available = buttons
      .map(button => ({ button, count: Number(button.dataset.count) }))
      .filter(item => Number.isFinite(item.count));
    available.sort((a, b) => Math.abs(a.count - targetCount) - Math.abs(b.count - targetCount) || b.count - a.count);
    available[0]?.button?.click?.();
    scheduleTournamentPresetTask(onComplete);
    return;
  }
  if (retry < 8) {
    scheduleTournamentPresetTask(() => clickClosestTournamentCount(targetCount, onComplete, retry + 1));
    return;
  }
  onComplete();
}

function markTournamentPresetSelection(key, message = '') {
  document.querySelectorAll(`${TOURNAMENT_PRESET_SECTION_SELECTOR} [data-quick-preset]`).forEach(button => {
    const selected = button.dataset.quickPreset === key;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
  document.querySelectorAll(`${TOURNAMENT_PRESET_SECTION_SELECTOR} [data-preset-status]`).forEach(status => {
    status.textContent = message;
  });
}

function finishTournamentPresetApplication(preset) {
  const draft = readDraft();
  if (draft) saveDraft({ ...draft, quickPreset: preset.key });
  delete document.documentElement.dataset[TOURNAMENT_PRESET_APPLYING];
  markTournamentPresetSelection(preset.key, `${preset.title} beállítva. Minden részlet tovább módosítható.`);
}

function applyTournamentQuickPreset(preset) {
  if (!preset || document.documentElement.dataset[TOURNAMENT_PRESET_APPLYING] === 'true') return;
  document.documentElement.dataset[TOURNAMENT_PRESET_APPLYING] = 'true';
  markTournamentPresetSelection('', 'Beállítás folyamatban…');
  clickTournamentPresetOption('[data-format]', preset.format, () => {
    clickClosestTournamentCount(preset.count, () => {
      clickTournamentPresetOption('[data-opponent-mode]', preset.opponentMode, () => {
        clickTournamentPresetOption('[data-match-mode]', preset.matchMode, () => {
          clickTournamentPresetOption('[data-difficulty]', preset.difficulty, () => finishTournamentPresetApplication(preset));
        });
      });
    });
  });
}

function enhanceTournamentCustomSettings(root = document) {
  ensureTournamentPresetStyle();
  const panels = [...root.querySelectorAll?.('.tournament-experience-v2') ?? []];
  panels.forEach(panel => {
    if (!panel.querySelector('[data-name]') || !panel.querySelector('[data-format]') || panel.querySelector(TOURNAMENT_PRESET_SECTION_SELECTOR)) return;
    const firstSection = panel.querySelector(':scope > .tx-section');
    if (!firstSection) return;
    const draft = readDraft();
    const section = document.createElement('section');
    section.className = 'tx-section tx-quick-presets';
    section.dataset.tournamentQuickPresets = 'true';
    section.innerHTML = `<div class="tx-quick-presets__intro"><div><h2>Gyors beállítás</h2><p>Válassz egy kész tornaformát, majd szükség esetén módosítsd az alatta lévő részletes beállításokat.</p></div><span aria-hidden="true">✨</span></div><div class="tx-quick-presets__grid">${TOURNAMENT_QUICK_PRESETS.map(preset => `<button type="button" class="tx-quick-preset ${draft?.quickPreset === preset.key ? 'is-selected' : ''}" data-quick-preset="${preset.key}" aria-pressed="${draft?.quickPreset === preset.key}"><span class="tx-quick-preset__icon" aria-hidden="true">${preset.icon}</span><span><strong>${preset.title}</strong><small>${preset.description}</small></span><span class="tx-quick-preset__check" aria-hidden="true">✓</span></button>`).join('')}</div><p class="tx-quick-presets__status" data-preset-status aria-live="polite"></p>`;
    firstSection.before(section);
    section.querySelectorAll('[data-quick-preset]').forEach(button => button.addEventListener('click', () => {
      applyTournamentQuickPreset(TOURNAMENT_QUICK_PRESETS.find(preset => preset.key === button.dataset.quickPreset));
    }));
  });
}

function installTournamentQuickPresets() {
  ensureTournamentPresetStyle();
  if (globalThis.__FOCISKARTYAK_TOURNAMENT_QUICK_PRESETS__) return globalThis.__FOCISKARTYAK_TOURNAMENT_QUICK_PRESETS__;
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      enhanceTournamentCustomSettings(node.matches?.('.tournament-experience-v2') ? node.parentElement ?? document : node);
    }));
    enhanceTournamentCustomSettings(document);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  globalThis.__FOCISKARTYAK_TOURNAMENT_QUICK_PRESETS__ = observer;
  globalThis.FociskartyakTournamentQuickPresets = Object.freeze({
    presets: TOURNAMENT_QUICK_PRESETS,
    refresh: () => enhanceTournamentCustomSettings(document),
  });
  enhanceTournamentCustomSettings(document);
  return observer;
}

installTournamentQuickPresets();

export {
  TOURNAMENT_QUICK_PRESETS,
  applyTournamentQuickPreset,
  enhanceTournamentCustomSettings,
  installTournamentQuickPresets,
};
