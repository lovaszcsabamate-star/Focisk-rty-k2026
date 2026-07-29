/** Torna megjelenítési kiegészítés: klublogók, kupaág és büntető-döntetlen szövegek. */

const STYLE_ID = 'tournament-presentation-upgrade-style';
const SVG_NS = 'http://www.w3.org/2000/svg';

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

const svgElement = (name, attributes = {}) => {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
};

const buildClubLogo = (label, brand) => {
  const svg = svgElement('svg', {
    class: 'tournament-team-mark__club-svg',
    viewBox: '0 0 120 140',
    role: 'img',
    'aria-hidden': 'true',
  });
  svg.append(
    svgElement('path', {
      d: 'M60 5 108 24 101 97 60 132 19 97 12 24Z',
      fill: brand.primary,
      stroke: brand.secondary,
      'stroke-width': 7,
    }),
    svgElement('path', {
      d: 'M25 33h70v15H25z',
      fill: brand.secondary,
      opacity: '.94',
    }),
    svgElement('circle', {
      cx: 60,
      cy: 82,
      r: 25,
      fill: 'none',
      stroke: brand.secondary,
      'stroke-width': 6,
    }),
    svgElement('path', {
      d: 'm60 65 10 7-4 12H54l-4-12z',
      fill: brand.secondary,
    }),
  );
  const title = svgElement('title');
  title.textContent = `${label} klublogó`;
  const text = svgElement('text', {
    x: 60,
    y: 42,
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    fill: brand.primary,
    'font-size': 19,
    'font-family': 'system-ui, sans-serif',
    'font-weight': 1000,
  });
  text.textContent = brand.short;
  svg.prepend(title);
  svg.append(text);
  return svg;
};

const enhanceClubMarks = root => {
  const marks = [];
  if (root?.matches?.('.tournament-team-mark--generated')) marks.push(root);
  root?.querySelectorAll?.('.tournament-team-mark--generated').forEach(mark => marks.push(mark));
  for (const mark of marks) {
    const label = mark.getAttribute('aria-label') || mark.textContent;
    const brand = clubBrandForLabel(label);
    if (!brand) continue;
    mark.replaceChildren(buildClubLogo(label, brand));
    mark.classList.remove('tournament-team-mark--generated');
    mark.classList.add('tournament-team-mark--club');
    mark.removeAttribute('style');
  }
};

const enhanceBrackets = root => {
  const brackets = [];
  if (root?.matches?.('.tournament-bracket')) brackets.push(root);
  root?.querySelectorAll?.('.tournament-bracket').forEach(bracket => brackets.push(bracket));
  for (const bracket of brackets) {
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
    const hint = document.createElement('p');
    hint.className = 'tournament-bracket__scroll-hint';
    hint.textContent = 'Húzd oldalra az ág­rajz további fordulóihoz →';
    bracket.before(hint);
  }
};

const TEXT_REPLACEMENTS = Object.freeze([
  [' · nincs gól', ' · mindkét csapat gólt és pontot kapott'],
  ['azonos értéknél nincs gól.', 'azonos értéknél mindkét csapat gólt és pontot kap.'],
]);

const replaceOutdatedPenaltyText = root => {
  if (!root || typeof document === 'undefined') return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  for (const node of textNodes) {
    let value = node.nodeValue;
    for (const [from, to] of TEXT_REPLACEMENTS) value = value.replaceAll(from, to);
    if (value !== node.nodeValue) node.nodeValue = value;
  }
};

const installStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .tournament-team-mark--club{overflow:visible;background:none;border:0;clip-path:none}
    .tournament-team-mark__club-svg{width:100%;height:100%;overflow:visible;filter:drop-shadow(0 4px 8px rgba(0,0,0,.48))}
    .tournament-team-mark--club.is-compact .tournament-team-mark__club-svg{filter:drop-shadow(0 2px 4px rgba(0,0,0,.42))}
    .tournament-v3 .tournament-bracket__scroll-hint{width:max-content;margin:0 0 10px;padding:5px 9px;border:1px solid rgba(255,214,90,.25);border-radius:999px;background:rgba(36,23,14,.94);color:#d9c9a7;font-size:.72rem}
    .tournament-v3 .tournament-bracket--tree{display:grid!important;grid-auto-flow:column;grid-auto-columns:minmax(220px,260px);align-items:stretch;gap:52px;width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;padding:4px 28px 18px 2px;scroll-snap-type:x proximity;overscroll-behavior-inline:contain}
    .tournament-v3 .tournament-bracket--tree>.tournament-bracket__round{position:relative;display:flex!important;min-height:310px;flex-direction:column;justify-content:space-around;gap:18px;scroll-snap-align:start}
    .tournament-v3 .tournament-bracket--tree>.tournament-bracket__round>h3{margin:0 0 12px;padding:7px 10px;border:1px solid rgba(255,239,183,.17);border-radius:10px;background:rgba(52,33,18,.96);color:#fff0ad;text-align:center}
    .tournament-v3 .tournament-bracket__match--connected{position:relative;min-height:100px;overflow:visible}
    .tournament-v3 .tournament-bracket__round:not(.is-final) .tournament-bracket__match--connected::after{content:"";position:absolute;right:-53px;top:50%;width:53px;border-top:2px solid rgba(255,214,90,.48)}
    .tournament-v3 .tournament-bracket__round:not(:first-child)::before{content:"";position:absolute;left:-27px;top:12%;bottom:12%;border-left:2px solid rgba(255,214,90,.34)}
    .tournament-v3 .tournament-bracket__match span.is-winner{color:#d9ffe2;background:rgba(79,196,112,.12)}
    .tournament-v3 .tournament-bracket__match span:not(.is-winner){opacity:.78}
    @media (min-width:861px){.tournament-v3 .tournament-bracket__scroll-hint{display:none}}
    @media (max-width:860px){
      .tournament-v3 .tournament-bracket--tree{grid-auto-columns:minmax(210px,78vw);gap:44px}
      .tournament-v3 .tournament-bracket__round:not(.is-final) .tournament-bracket__match--connected::after{right:-45px;width:45px}
      .tournament-v3 .tournament-bracket__round:not(:first-child)::before{left:-23px}
      .tournament-v3 .tournament-result-row .tournament-team-mark{display:inline-grid}
    }
  `;
  document.head.append(style);
};

export function installTournamentPresentationUpgrade(documentRef = globalThis.document) {
  if (!documentRef?.body) return () => {};
  installStyles();
  const enhance = root => {
    enhanceClubMarks(root);
    enhanceBrackets(root);
    replaceOutdatedPenaltyText(root);
  };
  enhance(documentRef.body);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) enhance(node);
        else if (node.nodeType === Node.TEXT_NODE) replaceOutdatedPenaltyText(node.parentElement);
      });
    }
  });
  observer.observe(documentRef.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

if (globalThis.document) installTournamentPresentationUpgrade();
