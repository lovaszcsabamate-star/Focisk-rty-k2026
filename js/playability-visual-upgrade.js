/** Playability, pacing and match-presentation upgrades layered over the existing game. */

import { ATTRIBUTES } from './data/players.js';
import { AI, Game, HUMAN, PHASE } from './engine.js';
import { GameRuntime } from './game/game-runtime.js';
import { UI, el } from './ui.js';

const STYLE_ID = 'playability-visual-upgrade-styles';
const MATCH_LENGTH_KEY = 'fociskartyak:match-length:v1';
const AUTO_ADVANCE_KEY = 'fociskartyak:experience:auto-advance:v1';
const DISCOVERED_KEY = 'fociskartyak:experience:discovered:v1';
const DAILY_KEY = 'fociskartyak:experience:daily:v1';
const DAILY_FALLBACK_NOTICE_KEY = 'fociskartyak:experience:daily-fallback-notice:v1';

const MATCH_LENGTHS = Object.freeze({
  quick: Object.freeze({ id: 'quick', label: 'Gyors', detail: 'max. 10 párbaj', cards: 20 }),
  normal: Object.freeze({ id: 'normal', label: 'Normál', detail: 'max. 18 párbaj', cards: 36 }),
  full: Object.freeze({ id: 'full', label: 'Teljes', detail: 'max. 26 párbaj', cards: 52 }),
});

const DAILY_CATEGORIES = Object.freeze([
  'goals', 'appearances', 'birthDate', 'yellowCards', 'starts', 'marketValue',
]);
const DAILY_FALLBACK_CATEGORY = 'totalDismissals';

const safeStorageGet = (key, fallback = null) => {
  try {
    const value = globalThis.localStorage?.getItem(key);
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
};

const safeStorageSet = (key, value) => {
  try {
    globalThis.localStorage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const safeJson = (value, fallback) => {
  try {
    const parsed = JSON.parse(value);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
};

if (safeStorageGet(MATCH_LENGTH_KEY) == null) safeStorageSet(MATCH_LENGTH_KEY, 'quick');
if (safeStorageGet(AUTO_ADVANCE_KEY) == null) safeStorageSet(AUTO_ADVANCE_KEY, JSON.stringify(true));

const selectedMatchLength = () => MATCH_LENGTHS[safeStorageGet(MATCH_LENGTH_KEY)] ?? MATCH_LENGTHS.quick;

const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const scheduledDailyCategory = dateKey => {
  const numeric = [...String(dateKey)].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return DAILY_CATEGORIES[numeric % DAILY_CATEGORIES.length];
};

const dailyUsesFallback = () => scheduledDailyCategory(todayKey()) === 'marketValue';

const playerPool = () => {
  const full = globalThis.__FOCISKARTYAK_FULL_PLAYER_DATA__;
  const embedded = globalThis.__EMBEDDED_PLAYER_DATA__;
  if (Array.isArray(full?.players)) return full.players;
  if (Array.isArray(full)) return full;
  if (Array.isArray(embedded?.players)) return embedded.players;
  return Array.isArray(embedded) ? embedded : [];
};

const discoveredIds = () => new Set(
  safeJson(safeStorageGet(DISCOVERED_KEY, '[]'), [])
    .filter(value => typeof value === 'string'),
);

const textHashHue = value => {
  let hash = 0;
  for (const character of String(value ?? '')) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return Math.abs(hash) % 360;
};

const installStyles = () => {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .match-length-panel { display:grid; gap:8px; margin:12px 0 4px; padding:12px; border:1px solid rgba(239,212,144,.32); border-radius:15px; background:rgba(0,0,0,.2); }
    .match-length-panel h2 { margin:0; font-size:14px; }
    .match-length-panel > p { margin:0; color:#c7b99f; font-size:10px; line-height:1.35; }
    .match-length-options { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:7px; }
    .match-length-option { min-width:0; min-height:54px; display:grid; place-items:center; gap:2px; padding:7px; border:1px solid rgba(239,212,144,.3); border-radius:11px; background:rgba(255,255,255,.035); color:#fff7df; cursor:pointer; }
    .match-length-option strong { font-size:12px; }
    .match-length-option small { color:#baa98d; font-size:9px; }
    .match-length-option.is-selected { border-color:#efd490; background:linear-gradient(180deg,rgba(239,212,144,.22),rgba(201,156,66,.12)); box-shadow:0 0 0 2px rgba(239,212,144,.12); }
    .album-open-button { width:100%; margin-top:7px; }
    .album-panel { width:min(760px,100%); }
    .album-summary { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; margin:12px 0; }
    .album-summary > div { padding:12px; border-radius:13px; background:rgba(255,255,255,.045); }
    .album-summary strong { display:block; color:#fff7df; font-size:20px; }
    .album-summary small { color:#bdae94; font-size:10px; }
    .album-clubs { display:grid; gap:7px; max-height:min(48dvh,430px); overflow:auto; padding-right:3px; }
    .album-club { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:5px 10px; padding:10px; border:1px solid rgba(239,212,144,.18); border-radius:12px; background:rgba(0,0,0,.18); }
    .album-club strong { min-width:0; overflow-wrap:anywhere; }
    .album-club__bar { grid-column:1/-1; height:6px; overflow:hidden; border-radius:999px; background:rgba(255,255,255,.08); }
    .album-club__bar span { display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,#c99c42,#efd490); }
    .album-recent { display:flex; gap:6px; margin-top:10px; padding-bottom:3px; overflow-x:auto; }
    .album-player-chip { flex:0 0 auto; max-width:180px; padding:6px 9px; border-radius:999px; background:rgba(239,212,144,.1); color:#fff7df; font-size:10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .category-filter-toolbar { grid-column:1/-1; position:sticky; z-index:7; top:-1px; display:flex; gap:6px; padding:4px 0 9px; overflow-x:auto; background:linear-gradient(180deg,rgba(20,15,11,.98) 72%,transparent); scrollbar-width:none; }
    .category-filter-toolbar::-webkit-scrollbar { display:none; }
    .category-filter-button { flex:0 0 auto; min-height:34px; padding:6px 10px; border:1px solid rgba(239,212,144,.28); border-radius:999px; background:rgba(0,0,0,.3); color:#dfd2bb; font-size:10px; font-weight:850; }
    .category-filter-button[aria-pressed='true'] { border-color:#efd490; background:rgba(239,212,144,.18); color:#fff7df; }
    .match-scoreboard--team-identity { --home-accent:#4aa36b; --away-accent:#b65d59; background:linear-gradient(90deg,color-mix(in srgb,var(--home-accent) 20%,transparent),rgba(12,10,8,.95) 42% 58%,color-mix(in srgb,var(--away-accent) 20%,transparent)); }
    .match-scoreboard--team-identity .match-team--home { border-left:4px solid var(--home-accent); padding-left:7px; }
    .match-scoreboard--team-identity .match-team--away { border-right:4px solid var(--away-accent); padding-right:7px; }
    .match-scoreboard__status-copy { display:grid; gap:2px; text-align:center; }
    .match-scoreboard__status-copy small { color:#c9bda6; font-size:8px; font-weight:750; letter-spacing:.02em; text-transform:none; }
    #pub.has-team-identity #felt { background-image:linear-gradient(90deg,color-mix(in srgb,var(--team-home-accent) 9%,transparent),transparent 38% 62%,color-mix(in srgb,var(--team-away-accent) 9%,transparent)),var(--felt-background-image,none); }
    @media (max-width:620px) {
      .match-length-options { grid-template-columns:1fr; }
      .match-length-option { grid-template-columns:1fr auto; justify-items:start; min-height:44px; }
      .match-length-option small { justify-self:end; }
      .album-summary { grid-template-columns:1fr; }
      .match-scoreboard--team-identity .match-team__name { max-width:28vw; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    }
    @media (forced-colors:active) {
      .match-length-option,.album-club,.category-filter-button { border-color:ButtonText; background:Canvas; color:CanvasText; forced-color-adjust:auto; }
    }
  `;
  document.head.appendChild(style);
};

const previousRuntimeStart = GameRuntime.prototype.start;
GameRuntime.prototype.start = function startWithSelectedLength(mode, difficulty) {
  const state = previousRuntimeStart.call(this, mode, difficulty);
  const game = this.game;
  if (this.mode !== 'classic' || !game || !Array.isArray(game.deck)) return state;

  const selected = selectedMatchLength();
  const cardsAlreadyDealt = Object.values(game.hands ?? {}).reduce(
    (sum, hand) => sum + (Array.isArray(hand) ? hand.length : 0),
    0,
  );
  game.matchDeckSize = Math.min(selected.cards, cardsAlreadyDealt + game.deck.length);
  game.matchLengthPreset = selected.id;
  return this.state();
};

const previousClassicNextRound = Game.prototype.nextRound;
Game.prototype.nextRound = function nextRoundWithSelectedLength(...args) {
  if (this.mode === 'classic' && this.phase === PHASE.REVEAL) {
    const selected = MATCH_LENGTHS[this.matchLengthPreset] ?? selectedMatchLength();
    const targetDuels = Math.max(1, Math.floor(selected.cards / 2));
    if (this.round >= targetDuels) {
      this.played = { [HUMAN]: null, [AI]: null };
      this.attribute = null;
      this.phase = PHASE.GAME_OVER;
      return this;
    }
  }
  return previousClassicNextRound.apply(this, args);
};

const matchSideName = (game, side) => {
  const matchup = globalThis.__FOCISKARTYAK_QUICK_MATCH__;
  if (side === HUMAN) {
    return matchup?.human?.label
      ?? game?.quickMatch?.humanTeam
      ?? safeStorageGet('fociskartyak:player-name:v1', 'Játékos');
  }
  return matchup?.ai?.label ?? game?.quickMatch?.aiTeam ?? 'Gép';
};

const matchSideIcon = side => {
  const matchup = globalThis.__FOCISKARTYAK_QUICK_MATCH__;
  return side === HUMAN ? (matchup?.human?.icon || '⚽') : (matchup?.ai?.icon || '🤖');
};

const matchStatus = game => {
  if (game.phase === PHASE.GAME_OVER) return 'VÉGEREDMÉNY';
  if (game.phase === PHASE.REVEAL) {
    const next = game.mode === 'penalties'
      ? (game.chooser === HUMAN ? AI : HUMAN)
      : game.chooser;
    return `KÖVETKEZŐ VÁLASZTÓ: ${matchSideName(game, next).toUpperCase()}`;
  }
  return `KATEGÓRIÁT VÁLASZT: ${matchSideName(game, game.chooser).toUpperCase()}`;
};

const duelWins = (game, side) => (Array.isArray(game?.log)
  ? game.log.filter(result => result?.winner === side).length
  : 0);

UI.prototype._renderMatchScoreboard = function renderTeamMatchScoreboard(game, humanScore, aiScore) {
  const penalties = game.mode === 'penalties';
  const matchup = globalThis.__FOCISKARTYAK_QUICK_MATCH__;
  const humanName = matchSideName(game, HUMAN);
  const aiName = matchSideName(game, AI);
  const human = penalties ? humanScore : duelWins(game, HUMAN);
  const ai = penalties ? aiScore : duelWins(game, AI);
  const status = matchStatus(game);
  const competition = penalties
    ? 'TIZENEGYESEK'
    : matchup?.category === 'national' ? 'VÁLOGATOTT PÁRBAJ'
      : matchup?.enabled ? 'GYORS MECCS' : 'NB I KÁRTYAMECCS';

  const board = el('div', `match-scoreboard match-scoreboard--team-identity${penalties ? ' match-scoreboard--penalties' : ''}`);
  const homeAccent = `hsl(${textHashHue(humanName)} 48% 47%)`;
  const awayAccent = `hsl(${textHashHue(aiName) + 37} 48% 47%)`;
  board.style.setProperty('--home-accent', homeAccent);
  board.style.setProperty('--away-accent', awayAccent);
  this.dom?.pub?.classList.add('has-team-identity');
  this.dom?.pub?.style.setProperty('--team-home-accent', homeAccent);
  this.dom?.pub?.style.setProperty('--team-away-accent', awayAccent);
  board.setAttribute('role', 'status');
  board.setAttribute('aria-live', 'polite');
  board.setAttribute('aria-label', `${humanName} ${human}, ${aiName} ${ai}. ${status.toLowerCase()}.`);

  const competitionNode = el('div', 'match-scoreboard__competition', competition);
  const home = el('div', 'match-team match-team--home');
  home.append(el('span', 'match-team__crest', matchSideIcon(HUMAN)), el('span', 'match-team__name', humanName));

  const score = el('div', 'match-scoreboard__score');
  score.append(
    el('strong', 'match-scoreboard__number', String(human)),
    el('span', 'match-scoreboard__separator', '–'),
    el('strong', 'match-scoreboard__number', String(ai)),
  );

  const away = el('div', 'match-team match-team--away');
  away.append(el('span', 'match-team__name', aiName), el('span', 'match-team__crest', matchSideIcon(AI)));

  const possession = el('div', 'match-scoreboard__status match-scoreboard__status-copy');
  possession.append(el('span', null, status));
  if (!penalties) {
    const pot = Number(game?.pot?.length) || 0;
    possession.append(el('small', null, `Megnyert lapok: ${humanScore}–${aiScore}${pot ? ` · Asztalon: ${pot}` : ''}`));
  }
  board.append(competitionNode, home, score, away, possession);
  return board;
};

const decorateMatchLength = (ui, panel) => {
  if (!panel?.classList.contains('mobile-home') || panel.querySelector('.match-length-panel')) return;
  const section = el('section', 'match-length-panel');
  section.append(
    el('h2', null, 'Mérkőzés hossza'),
    el('p', null, 'A Gyors mód mobilon feszesebb ritmust ad. A választást a játék megjegyzi.'),
  );
  const options = el('div', 'match-length-options');
  const renderSelection = () => {
    const selected = selectedMatchLength().id;
    options.querySelectorAll('.match-length-option').forEach(button => {
      const active = button.dataset.length === selected;
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };
  for (const item of Object.values(MATCH_LENGTHS)) {
    const button = el('button', 'match-length-option');
    button.type = 'button';
    button.dataset.length = item.id;
    button.append(el('strong', null, item.label), el('small', null, item.detail));
    button.addEventListener('click', () => {
      safeStorageSet(MATCH_LENGTH_KEY, item.id);
      renderSelection();
      ui.showToast?.(`${item.label} mérkőzéshossz kiválasztva`);
    });
    options.appendChild(button);
  }
  section.appendChild(options);
  renderSelection();
  panel.querySelector('.primary-mode-actions')?.after(section);
};

const createAlbumPanel = (ui, returnPanel) => {
  const players = playerPool();
  const discovered = discoveredIds();
  const clubs = new Map();
  for (const player of players) {
    const club = String(player?.clubName ?? player?.club ?? 'Ismeretlen klub').trim() || 'Ismeretlen klub';
    const state = clubs.get(club) ?? { total: 0, found: 0 };
    state.total += 1;
    if (discovered.has(player?.id)) state.found += 1;
    clubs.set(club, state);
  }

  const panel = el('div', 'album-panel mobile-sheet');
  panel.append(el('p', 'eyebrow', 'Gyűjtemény'), el('h1', null, 'Kártyaalbum'));
  const summary = el('div', 'album-summary');
  const found = [...discovered].filter(id => players.some(player => player?.id === id)).length;
  const foundCard = el('div');
  foundCard.append(el('strong', null, `${found} / ${players.length}`), el('small', null, 'megismert játékos'));
  const completeClubs = [...clubs.values()].filter(item => item.total > 0 && item.found === item.total).length;
  const clubCard = el('div');
  clubCard.append(el('strong', null, `${completeClubs} / ${clubs.size}`), el('small', null, 'teljes klubgyűjtemény'));
  summary.append(foundCard, clubCard);
  panel.appendChild(summary);

  const clubList = el('div', 'album-clubs');
  [...clubs.entries()]
    .sort((left, right) => right[1].found / right[1].total - left[1].found / left[1].total || left[0].localeCompare(right[0], 'hu-HU'))
    .forEach(([club, state]) => {
      const row = el('div', 'album-club');
      row.append(el('strong', null, club), el('span', null, `${state.found}/${state.total}`));
      const bar = el('div', 'album-club__bar');
      const fill = el('span');
      fill.style.width = `${state.total ? state.found / state.total * 100 : 0}%`;
      bar.appendChild(fill);
      row.appendChild(bar);
      clubList.appendChild(row);
    });
  panel.appendChild(clubList);

  const recentPlayers = players.filter(player => discovered.has(player?.id)).slice(-20).reverse();
  if (recentPlayers.length) {
    panel.append(el('h2', null, 'Legutóbb megismert játékosok'));
    const recent = el('div', 'album-recent');
    recentPlayers.forEach(player => recent.appendChild(el('span', 'album-player-chip', player.name ?? 'Ismeretlen játékos')));
    panel.appendChild(recent);
  }

  const actions = el('div', 'result-actions');
  const back = el('button', 'btn', 'Vissza a főmenübe');
  back.type = 'button';
  back.addEventListener('click', () => ui.showOverlay(returnPanel), { once: true });
  actions.appendChild(back);
  panel.appendChild(actions);
  return panel;
};

const decorateAlbumButton = (ui, panel) => {
  if (!panel?.classList.contains('mobile-home') || panel.querySelector('.album-open-button')) return;
  const button = el('button', 'btn btn--ghost album-open-button', '🗂 Kártyaalbum');
  button.type = 'button';
  button.addEventListener('click', () => ui.showOverlay(createAlbumPanel(ui, panel)), { once: true });
  panel.querySelector('.secondary-menu-actions')?.before(button);
};

const repairClassicRuleCopy = panel => {
  const classic = panel?.querySelector?.('[data-rules="classic"] p');
  if (!classic) return;
  classic.innerHTML = '<b>Klasszikus szabály:</b> A kör győztese választ kategóriát a következő körben. Döntetlennél az előző választó marad. A győztes viszi a két lapot és a döntetlenpaklit.';
};

const repairDailyChallenge = panel => {
  if (!dailyUsesFallback() || !panel?.classList.contains('mobile-home')) return;
  const challenges = [...panel.querySelectorAll('.experience-challenge')];
  const categoryChallenge = challenges[2];
  if (!categoryChallenge) return;
  const label = ATTRIBUTES.find(attribute => attribute.key === DAILY_FALLBACK_CATEGORY);
  const spans = categoryChallenge.querySelectorAll('span');
  if (spans[1]) spans[1].textContent = `Nyerj ebben: ${label ? `${label.icon} ${label.shortLabel ?? label.label}` : 'Több kiállítás'}`;
  const daily = safeJson(safeStorageGet(DAILY_KEY, '{}'), {});
  const complete = Array.isArray(daily.categoryWins) && daily.categoryWins.includes(DAILY_FALLBACK_CATEGORY);
  categoryChallenge.classList.toggle('is-complete', complete);
  if (spans[0]) spans[0].textContent = complete ? '✓' : '○';
  const progress = categoryChallenge.querySelector('b');
  if (progress) progress.textContent = complete ? '1/1' : '0/1';
};

const decorateCategoryFilters = ui => {
  const grid = ui.dom?.picker?.querySelector('.category-grid');
  if (!grid || grid.querySelector('.category-filter-toolbar')) return;
  const tiles = [...grid.querySelectorAll(':scope > .category-tile[data-attribute]')];
  if (!tiles.length) return;
  const toolbar = el('div', 'category-filter-toolbar');
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Kategóriaszűrők');
  const filters = [
    { id: 'available', label: 'Most választható' },
    { id: 'Támadás', label: 'Támadás' },
    { id: 'Fegyelem', label: 'Fegyelem' },
    { id: 'Alapadatok', label: 'Alapadatok' },
    { id: 'all', label: 'Összes' },
  ];
  const apply = filter => {
    for (const tile of tiles) {
      const attribute = ATTRIBUTES.find(item => item.key === tile.dataset.attribute);
      const visible = filter === 'all'
        || (filter === 'available' && tile.dataset.available !== 'false')
        || attribute?.group === filter;
      tile.hidden = !visible;
    }
    toolbar.querySelectorAll('.category-filter-button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.filter === filter));
    });
  };
  for (const filter of filters) {
    const button = el('button', 'category-filter-button', filter.label);
    button.type = 'button';
    button.dataset.filter = filter.id;
    button.addEventListener('click', () => apply(filter.id));
    toolbar.appendChild(button);
  }
  grid.prepend(toolbar);
  apply('available');
};

const previousShowAttributePicker = UI.prototype.showAttributePicker;
UI.prototype.showAttributePicker = function showFilteredAttributePicker(game) {
  const output = previousShowAttributePicker.call(this, game);
  decorateCategoryFilters(this);
  return output;
};

const previousShowVerdict = UI.prototype.showVerdict;
UI.prototype.showVerdict = function showVerdictWithDailyFallback(result, game) {
  const output = previousShowVerdict.call(this, result, game);
  if (dailyUsesFallback() && result?.winner === HUMAN && result?.attribute === DAILY_FALLBACK_CATEGORY) {
    const date = todayKey();
    if (safeStorageGet(DAILY_FALLBACK_NOTICE_KEY) !== date) {
      safeStorageSet(DAILY_FALLBACK_NOTICE_KEY, date);
      this.showToast?.('✅ Napi kihívás teljesítve: nyerj a több kiállítás kategóriában', 'success', 2800);
    }
  }
  return output;
};

const previousShowOverlay = UI.prototype.showOverlay;
UI.prototype.showOverlay = function showOverlayWithPlayabilityUpgrades(panel) {
  const output = previousShowOverlay.call(this, panel);
  decorateMatchLength(this, panel);
  decorateAlbumButton(this, panel);
  repairClassicRuleCopy(panel);
  repairDailyChallenge(panel);
  return output;
};

installStyles();
