/** Torna megjelenítési kiegészítés: klublogók, kupaág, kupaikon, büntetőszöveg és győzelmi konfetti. */

const STYLE_ID = 'tournament-presentation-upgrade-style';
const SVG_NS = 'http://www.w3.org/2000/svg';
const TOURNAMENT_STORAGE_KEY = 'fociskartyak.tournament.v1';
const CONFETTI_CLASS = 'victory-confetti';
const DEFAULT_CONFETTI_COLORS = Object.freeze(['#ffd65a', '#fff7df', '#d69a35']);

const foldLabel = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const CLUB_BRANDS = Object.freeze([
  { aliases: ['dvsc', 'debreceni vsc'], short: 'DVSC', primary: '#c8192e', secondary: '#ffffff' },
  { aliases: ['dvtk', 'diosgyori vtk'], short: 'DVTK', primary: '#d71920', secondary: '#ffffff' },
  { aliases: ['eto fc', 'gyori eto'], short: 'ETO', primary: '#159447', secondary: '#ffffff' },
  { aliases: ['ferencvarosi tc', 'ferencvaros'], short: 'FTC', primary: '#16854a', secondary: '#ffffff' },
  { aliases: ['kisvarda master good', 'kisvarda'], short: 'KISV', primary: '#d8222a', secondary: '#ffffff' },
  { aliases: ['kolorcity kazincbarcika sc', 'kazincbarcika'], short: 'KBSC', primary: '#2468a9', secondary: '#f2cf2f' },
  { aliases: ['mtk budapest', 'mtk'], short: 'MTK', primary: '#246eb9', secondary: '#ffffff' },
  { aliases: ['nyiregyhaza spartacus fc', 'nyiregyhaza'], short: 'NYÍR', primary: '#c61f30', secondary: '#254f9a' },
  { aliases: ['paksi fc', 'paks'], short: 'PAKS', primary: '#23864a', secondary: '#ffffff' },
  { aliases: ['puskas akademia fc', 'puskas akademia'], short: 'PAFC', primary: '#1f66ad', secondary: '#f0c640' },
  { aliases: ['ujpest fc', 'ujpest'], short: 'UTE', primary: '#6d3a93', secondary: '#ffffff' },
  { aliases: ['zte fc', 'zalaegerszegi te'], short: 'ZTE', primary: '#185ea9', secondary: '#ffffff' },
]);

export const clubBrandForLabel = label => {
  const folded = foldLabel(label);
  return CLUB_BRANDS.find(brand => brand.aliases.some(alias => folded === alias || folded.includes(alias))) ?? null;
};

const validColor = value => /^#[0-9a-f]{6}$/i.test(String(value ?? '').trim());

export const victoryColorsForLabel = (label, explicitColors = null) => {
  const brand = clubBrandForLabel(label);
  const candidates = [
    explicitColors?.primary,
    explicitColors?.secondary,
    explicitColors?.accent,
    brand?.primary,
    brand?.secondary,
    ...DEFAULT_CONFETTI_COLORS,
  ].filter(validColor);
  return Object.freeze([...new Set(candidates)].slice(0, 5));
};

const svgElement = (documentRef, name, attributes = {}) => {
  const node = documentRef.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
};

const buildClubLogo = (documentRef, label, brand) => {
  const svg = svgElement(documentRef, 'svg', {
    class: 'tournament-team-mark__club-svg',
    viewBox: '0 0 120 140',
    role: 'img',
    'aria-hidden': 'true',
  });
  svg.append(
    svgElement(documentRef, 'path', {
      d: 'M60 5 108 24 101 97 60 132 19 97 12 24Z',
      fill: brand.primary,
      stroke: brand.secondary,
      'stroke-width': 7,
    }),
    svgElement(documentRef, 'path', {
      d: 'M25 33h70v15H25z',
      fill: brand.secondary,
      opacity: '.94',
    }),
    svgElement(documentRef, 'circle', {
      cx: 60,
      cy: 82,
      r: 25,
      fill: 'none',
      stroke: brand.secondary,
      'stroke-width': 6,
    }),
    svgElement(documentRef, 'path', {
      d: 'm60 65 10 7-4 12H54l-4-12z',
      fill: brand.secondary,
    }),
  );
  const title = svgElement(documentRef, 'title');
  title.textContent = `${label} klublogó`;
  const logoText = svgElement(documentRef, 'text', {
    x: 60,
    y: 42,
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    fill: brand.primary,
    'font-size': 19,
    'font-family': 'system-ui, sans-serif',
    'font-weight': 1000,
  });
  logoText.textContent = brand.short;
  svg.prepend(title);
  svg.append(logoText);
  return svg;
};

const collect = (root, selector) => {
  const nodes = [];
  if (root?.matches?.(selector)) nodes.push(root);
  root?.querySelectorAll?.(selector).forEach(node => nodes.push(node));
  return nodes;
};

const enhanceClubMarks = (root, documentRef) => {
  for (const mark of collect(root, '.tournament-team-mark--generated')) {
    const label = mark.getAttribute('aria-label') || mark.textContent;
    const brand = clubBrandForLabel(label);
    if (!brand) continue;
    mark.replaceChildren(buildClubLogo(documentRef, label, brand));
    mark.classList.remove('tournament-team-mark--generated');
    mark.classList.add('tournament-team-mark--club');
    mark.removeAttribute('style');
  }
};

const enhanceBrackets = (root, documentRef) => {
  for (const bracket of collect(root, '.tournament-bracket')) {
    if (bracket.dataset.treeEnhanced === 'true') continue;
    bracket.dataset.treeEnhanced = 'true';
    bracket.classList.add('tournament-bracket--tree');
    bracket.tabIndex = 0;
    bracket.setAttribute('role', 'group');
    bracket.setAttribute('aria-label', 'Kieséses kupaág, vízszintesen görgethető');
    const rounds = [...bracket.querySelectorAll(':scope > .tournament-bracket__round')];
    rounds.at(-1)?.classList.add('is-final');
    rounds.forEach((round, roundIndex) => {
      round.dataset.roundIndex = String(roundIndex);
      round.querySelectorAll('.tournament-bracket__match').forEach(match => {
        match.classList.add('tournament-bracket__match--connected');
      });
    });
    const hint = documentRef.createElement('p');
    hint.className = 'tournament-bracket__scroll-hint';
    hint.textContent = 'Húzd oldalra az ág­rajz további fordulóihoz →';
    bracket.before(hint);
  }
};

const enhanceTrophyIcons = root => {
  for (const trophy of collect(root, '.tournament-trophy')) {
    if (!trophy.closest('.tournament-complete')) continue;
    trophy.textContent = '🏆';
    trophy.setAttribute('role', 'img');
    trophy.setAttribute('aria-label', 'Kupa');
    trophy.title = 'Kupa';
  }
};

const TEXT_REPLACEMENTS = Object.freeze([
  [' · nincs gól', ' · mindkét csapat gólt és pontot kapott'],
  ['azonos értéknél nincs gól.', 'azonos értéknél mindkét csapat gólt és pontot kap.'],
  ['azonos értéknél nincs gól', 'azonos értéknél mindkét csapat gólt és pontot kap'],
]);

const replaceOutdatedPenaltyText = (root, documentRef) => {
  if (!root) return;
  const showText = documentRef.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
  const walker = documentRef.createTreeWalker(root, showText);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  for (const node of textNodes) {
    let value = node.nodeValue;
    for (const [from, to] of TEXT_REPLACEMENTS) value = value.replaceAll(from, to);
    if (value !== node.nodeValue) node.nodeValue = value;
  }
};

const readStoredTournament = () => {
  try {
    const raw = globalThis.localStorage?.getItem(TOURNAMENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const humanTournamentTeam = state => (
  state?.participants?.find?.(team => team?.id === state?.humanTeamId) ?? null
);

const embeddedHumanTeamLabel = () => {
  const payload = globalThis.__EMBEDDED_PLAYER_DATA__;
  const players = Array.isArray(payload) ? payload : payload?.players;
  return players?.find?.(player => player?.meta?.quickMatchSide === 'human')?.meta?.quickMatchTeamLabel ?? '';
};

const victoryTeamForNode = node => {
  const tournament = readStoredTournament();
  const tournamentTeam = humanTournamentTeam(tournament);
  if (node.classList.contains('tournament-complete') || tournament?.currentMatchId) {
    if (tournamentTeam) return tournamentTeam;
  }
  const quickTeam = globalThis.__FOCISKARTYAK_QUICK_MATCH__?.human;
  if (quickTeam) return quickTeam;
  const label = embeddedHumanTeamLabel();
  return label ? { label } : { label: 'Fociskártyák 2026' };
};

const reducedMotionRequested = documentRef => (
  documentRef.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true
);

export function launchVictoryConfetti({
  documentRef = globalThis.document,
  teamLabel = '',
  colors = null,
  tournamentVictory = false,
} = {}) {
  if (!documentRef?.body || reducedMotionRequested(documentRef)) return null;
  documentRef.querySelectorAll(`.${CONFETTI_CLASS}`).forEach(node => node.remove());
  const palette = victoryColorsForLabel(teamLabel, colors);
  const layer = documentRef.createElement('div');
  layer.className = `${CONFETTI_CLASS}${tournamentVictory ? ' victory-confetti--tournament' : ''}`;
  layer.setAttribute('aria-hidden', 'true');
  layer.dataset.team = String(teamLabel || 'Fociskártyák 2026');
  const count = tournamentVictory ? 104 : 68;
  for (let index = 0; index < count; index += 1) {
    const piece = documentRef.createElement('i');
    piece.className = `victory-confetti__piece victory-confetti__piece--${index % 3}`;
    const duration = 2.7 + Math.random() * 1.65;
    const delay = Math.random() * (tournamentVictory ? 1.15 : 0.75);
    piece.style.setProperty('--confetti-x', `${Math.random() * 100}vw`);
    piece.style.setProperty('--confetti-drift', `${-75 + Math.random() * 150}px`);
    piece.style.setProperty('--confetti-spin', `${360 + Math.random() * 1080}deg`);
    piece.style.setProperty('--confetti-delay', `${delay.toFixed(2)}s`);
    piece.style.setProperty('--confetti-duration', `${duration.toFixed(2)}s`);
    piece.style.setProperty('--confetti-size', `${5 + Math.random() * 7}px`);
    piece.style.setProperty('--confetti-color', palette[index % palette.length]);
    layer.appendChild(piece);
  }
  documentRef.body.appendChild(layer);
  const timeout = documentRef.defaultView?.setTimeout ?? globalThis.setTimeout;
  timeout?.(() => layer.remove(), tournamentVictory ? 5600 : 4800);
  return layer;
}

const isVictoryPanel = node => {
  if (node.classList.contains('result-panel--win')) return true;
  if (!node.classList.contains('tournament-complete')) return false;
  return foldLabel(node.querySelector('h1')?.textContent).includes('tornagyozelem');
};

const enhanceVictoryCelebrations = (root, documentRef) => {
  const candidates = [
    ...collect(root, '.result-panel--win'),
    ...collect(root, '.tournament-complete'),
  ];
  for (const node of [...new Set(candidates)]) {
    if (!isVictoryPanel(node) || node.dataset.victoryConfetti === 'true') continue;
    node.dataset.victoryConfetti = 'true';
    const team = victoryTeamForNode(node);
    launchVictoryConfetti({
      documentRef,
      teamLabel: team?.label ?? '',
      colors: team?.colors ?? null,
      tournamentVictory: node.classList.contains('tournament-complete'),
    });
  }
};

const installStyles = documentRef => {
  if (documentRef.getElementById(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .tournament-team-mark--club{overflow:visible;background:none;border:0;clip-path:none}
    .tournament-team-mark__club-svg{width:100%;height:100%;overflow:visible;filter:drop-shadow(0 4px 8px rgba(0,0,0,.48))}
    .tournament-team-mark--club.is-compact .tournament-team-mark__club-svg{filter:drop-shadow(0 2px 4px rgba(0,0,0,.42))}
    .tournament-complete .tournament-trophy{filter:drop-shadow(0 8px 16px rgba(255,196,52,.32));animation:tournament-cup-arrive .7s cubic-bezier(.2,.9,.22,1.2) both}
    .tournament-v3 .tournament-bracket__scroll-hint{width:max-content;margin:0 0 10px;padding:5px 9px;border:1px solid rgba(255,214,90,.25);border-radius:999px;background:rgba(36,23,14,.94);color:#d9c9a7;font-size:.72rem}
    .tournament-v3 .tournament-bracket--tree{display:grid!important;grid-auto-flow:column;grid-auto-columns:minmax(220px,260px);align-items:stretch;gap:52px;width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;padding:4px 28px 18px 2px;scroll-snap-type:x proximity;overscroll-behavior-inline:contain}
    .tournament-v3 .tournament-bracket--tree>.tournament-bracket__round{position:relative;display:flex!important;min-height:310px;flex-direction:column;justify-content:space-around;gap:18px;scroll-snap-align:start}
    .tournament-v3 .tournament-bracket--tree>.tournament-bracket__round>h3{margin:0 0 12px;padding:7px 10px;border:1px solid rgba(255,239,183,.17);border-radius:10px;background:rgba(52,33,18,.96);color:#fff0ad;text-align:center}
    .tournament-v3 .tournament-bracket__match--connected{position:relative;min-height:100px;overflow:visible}
    .tournament-v3 .tournament-bracket__round:not(.is-final) .tournament-bracket__match--connected::after{content:"";position:absolute;right:-53px;top:50%;width:53px;border-top:2px solid rgba(255,214,90,.48)}
    .tournament-v3 .tournament-bracket__round:not(:first-child)::before{content:"";position:absolute;left:-27px;top:12%;bottom:12%;border-left:2px solid rgba(255,214,90,.34)}
    .tournament-v3 .tournament-bracket__match span.is-winner{color:#d9ffe2;background:rgba(79,196,112,.12)}
    .tournament-v3 .tournament-bracket__match span:not(.is-winner){opacity:.78}
    .victory-confetti{position:fixed;inset:0;z-index:2147483000;overflow:hidden;pointer-events:none;contain:strict}
    .victory-confetti__piece{position:absolute;top:-12vh;left:var(--confetti-x);display:block;width:var(--confetti-size);height:calc(var(--confetti-size)*1.7);border-radius:2px;background:var(--confetti-color);box-shadow:0 1px 2px rgba(0,0,0,.2);opacity:0;will-change:transform;animation:victory-confetti-fall var(--confetti-duration) cubic-bezier(.18,.72,.24,1) var(--confetti-delay) forwards}
    .victory-confetti__piece--1{height:var(--confetti-size);border-radius:50%}
    .victory-confetti__piece--2{width:calc(var(--confetti-size)*1.6);height:calc(var(--confetti-size)*.55);border-radius:999px}
    .victory-confetti--tournament .victory-confetti__piece{filter:drop-shadow(0 2px 3px rgba(0,0,0,.22))}
    @keyframes tournament-cup-arrive{0%{opacity:0;transform:translateY(-18px) scale(.72) rotate(-8deg)}70%{opacity:1;transform:translateY(2px) scale(1.08) rotate(2deg)}100%{opacity:1;transform:none}}
    @keyframes victory-confetti-fall{0%{opacity:0;transform:translate3d(0,-8vh,0) rotate(0deg)}8%{opacity:1}100%{opacity:.94;transform:translate3d(var(--confetti-drift),116vh,0) rotate(var(--confetti-spin))}}
    @media (min-width:861px){.tournament-v3 .tournament-bracket__scroll-hint{display:none}}
    @media (max-width:860px){
      .tournament-v3 .tournament-bracket--tree{grid-auto-columns:minmax(210px,78vw);gap:44px}
      .tournament-v3 .tournament-bracket__round:not(.is-final) .tournament-bracket__match--connected::after{right:-45px;width:45px}
      .tournament-v3 .tournament-bracket__round:not(:first-child)::before{left:-23px}
      .tournament-v3 .tournament-result-row .tournament-team-mark{display:inline-grid}
    }
    @media (prefers-reduced-motion:reduce){
      .victory-confetti{display:none}
      .tournament-complete .tournament-trophy{animation:none}
    }
  `;
  documentRef.head.append(style);
};

export function installTournamentPresentationUpgrade(documentRef = globalThis.document) {
  if (!documentRef?.body) return () => {};
  installStyles(documentRef);
  const enhance = root => {
    enhanceClubMarks(root, documentRef);
    enhanceBrackets(root, documentRef);
    enhanceTrophyIcons(root);
    replaceOutdatedPenaltyText(root, documentRef);
    enhanceVictoryCelebrations(root, documentRef);
  };
  enhance(documentRef.body);
  const Observer = documentRef.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  const observer = new Observer(records => {
    for (const record of records) {
      record.addedNodes.forEach(node => {
        if (node.nodeType === 1) enhance(node);
        else if (node.nodeType === 3) replaceOutdatedPenaltyText(node.parentElement, documentRef);
      });
    }
  });
  observer.observe(documentRef.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

if (globalThis.document) installTournamentPresentationUpgrade();
