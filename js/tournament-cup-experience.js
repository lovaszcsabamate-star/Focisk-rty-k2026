/**
 * Látványos kupaélmény a meglévő Torna mód fölött.
 * Csak a megjelenítést bővíti; a sorsolást, a tornaállapotot és a mentést nem módosítja.
 */

import {
  QUICK_MATCH_CATEGORY,
  buildQuickMatchCatalog,
  quickMatchEntriesForCategory,
} from './deck-selection.js';
import { tournamentStorageService } from './services/tournament-storage-service.js';
import {
  TOURNAMENT_FORMAT,
  tournamentNextHumanMatch,
  tournamentTeamById,
} from './tournament/tournament-domain.js';

const CUP_EXPERIENCE_STYLE_ID = 'tournament-cup-experience-styles';
const CUP_EXPERIENCE_FINAL_KEY = 'fociskartyak.tournament-final-intro.v1';
const CUP_EXPERIENCE_FORMATS = Object.freeze({
  [TOURNAMENT_FORMAT.GROUP_KNOCKOUT]: Object.freeze({
    key: 'group-knockout', icon: '🏆', eyebrow: 'Csoportból a döntőig',
    title: 'Csoportkör + kupaág',
    description: 'A tabelláról a kieséses szakaszba, majd a döntőbe vezet az út.',
  }),
  [TOURNAMENT_FORMAT.KNOCKOUT]: Object.freeze({
    key: 'knockout', icon: '🏆', eyebrow: 'Minden párbaj számít',
    title: 'Egyenes kieséses kupa',
    description: 'A vesztes kiesik, a győztes továbbjut. A végén egy csapat emeli magasba a serleget.',
  }),
  [TOURNAMENT_FORMAT.LEAGUE]: Object.freeze({
    key: 'league', icon: '▦', eyebrow: 'Hosszú távú verseny',
    title: 'Bajnoki liga',
    description: 'Mindenki játszik mindenkivel, a teljesítmény a tabellán áll össze.',
  }),
});

const cupExperienceText = value => String(value ?? '').trim();
const cupExperienceFold = value => cupExperienceText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
const cupExperienceInitials = value => cupExperienceText(value).split(/\s+/).filter(Boolean)
  .slice(0, 3).map(word => word[0]).join('').toUpperCase();
const cupExperienceHue = value => [...cupExperienceText(value)]
  .reduce((sum, char) => (sum + char.charCodeAt(0) * 7) % 360, 28);

const cupExperiencePlayers = () => {
  const payload = globalThis.__FOCISKARTYAK_FULL_PLAYER_DATA__ ?? globalThis.__EMBEDDED_PLAYER_DATA__;
  return Array.isArray(payload?.players) ? payload.players : [];
};

const cupExperienceCatalogEntries = () => {
  try {
    const catalog = buildQuickMatchCatalog(cupExperiencePlayers());
    return [
      ...quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.HUNGARIAN),
      ...quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.NATIONAL),
      ...quickMatchEntriesForCategory(catalog, QUICK_MATCH_CATEGORY.FEDERATION),
    ].filter(entry => entry?.usable !== false);
  } catch (error) {
    console.warn('[tournament-cup] A csapatkatalógus nem olvasható:', error);
    return [];
  }
};

const cupExperienceEntryForText = (text, entries) => {
  const folded = cupExperienceFold(text);
  if (!folded) return null;
  return entries.find(entry => cupExperienceFold(entry?.label) === folded)
    ?? entries.filter(entry => folded.endsWith(cupExperienceFold(entry?.label)))
      .sort((left, right) => cupExperienceText(right?.label).length - cupExperienceText(left?.label).length)[0]
    ?? null;
};

const cupExperienceCreateMark = (team, size = 'normal') => {
  const mark = document.createElement('span');
  mark.className = `cup-experience-team-mark cup-experience-team-mark--${size}`;
  mark.setAttribute('aria-hidden', 'true');
  if (team?.badge) {
    const image = document.createElement('img');
    image.src = team.badge;
    image.alt = '';
    image.loading = 'lazy';
    mark.appendChild(image);
    return mark;
  }
  if (team?.icon) {
    mark.classList.add('cup-experience-team-mark--icon');
    mark.textContent = cupExperienceText(team.icon);
    return mark;
  }
  mark.classList.add('cup-experience-team-mark--generated');
  mark.style.setProperty('--cup-team-hue', String(cupExperienceHue(team?.label)));
  mark.textContent = cupExperienceInitials(team?.label) || 'FK';
  return mark;
};

const cupExperienceRounds = (format, count) => {
  const participants = Math.max(4, Number(count) || 4);
  if (format === TOURNAMENT_FORMAT.LEAGUE) return ['Fordulók', 'Tabella', 'Bajnok'];
  if (format === TOURNAMENT_FORMAT.GROUP_KNOCKOUT) return ['Csoportkör', 'Kieséses ág', 'Elődöntő', 'Döntő'];
  if (participants <= 4) return ['Elődöntő', 'Döntő'];
  if (participants <= 8) return ['Negyeddöntő', 'Elődöntő', 'Döntő'];
  if (participants === 12) return ['1. kör', 'Negyeddöntő', 'Elődöntő', 'Döntő'];
  if (participants <= 16) return ['Nyolcaddöntő', 'Negyeddöntő', 'Elődöntő', 'Döntő'];
  return ['Legjobb 32', 'Nyolcaddöntő', 'Negyeddöntő', 'Elődöntő', 'Döntő'];
};

const cupExperienceEnsureStyles = () => {
  if (document.getElementById(CUP_EXPERIENCE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = CUP_EXPERIENCE_STYLE_ID;
  style.textContent = `
    .tournament-preset[data-cup-card]{position:relative;display:grid;grid-template-columns:52px minmax(0,1fr);align-items:center;gap:11px;min-height:86px;overflow:hidden;isolation:isolate}
    .tournament-preset[data-cup-card]::after{content:'';position:absolute;z-index:-1;inset:-50%;opacity:0;background:linear-gradient(110deg,transparent 35%,rgba(255,243,189,.18) 50%,transparent 65%);transform:translateX(-40%);transition:.45s ease}
    .tournament-preset[data-cup-card]:hover::after,.tournament-preset[data-cup-card]:focus-visible::after,.tournament-preset.is-cup-active::after{opacity:1;transform:translateX(40%)}
    .tournament-preset.is-cup-active{border-color:#ffd65a;background:radial-gradient(circle at 12% 30%,rgba(255,214,90,.22),transparent 44%),rgba(255,214,90,.1);box-shadow:inset 0 0 0 1px rgba(255,214,90,.34),0 12px 28px rgba(0,0,0,.24)}
    .tournament-preset__icon{display:grid;place-items:center;width:48px;height:56px;border:1px solid rgba(255,239,183,.36);border-radius:16px 16px 21px 21px;background:linear-gradient(155deg,rgba(255,221,105,.22),rgba(45,28,17,.72));font-size:24px;filter:drop-shadow(0 8px 12px rgba(0,0,0,.38))}
    .tournament-preset[data-preset*='cup'] .tournament-preset__icon,.tournament-preset[data-preset='nations'] .tournament-preset__icon{animation:cup-trophy-float 2.6s ease-in-out infinite}

    .tournament-format-grid label[data-cup-format]>span{position:relative;display:grid;grid-template-columns:60px minmax(0,1fr);align-items:center;gap:12px;min-height:120px;padding:14px;overflow:hidden;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
    .tournament-format-grid label[data-cup-format]:hover>span,.tournament-format-grid label[data-cup-format] input:checked+span{transform:translateY(-2px)}
    .tournament-format-grid label[data-cup-format] input:checked+span{box-shadow:inset 0 0 0 1px rgba(255,214,90,.48),0 16px 32px rgba(0,0,0,.25)}
    .tournament-format-grid label[data-cup-format='knockout'] input:checked+span,.tournament-format-grid label[data-cup-format='group-knockout'] input:checked+span{background:radial-gradient(circle at 18% 22%,rgba(255,214,90,.2),transparent 42%),linear-gradient(145deg,rgba(112,72,21,.38),rgba(42,26,15,.88))}
    .tournament-format-grid label[data-cup-format='league'] input:checked+span{background:radial-gradient(circle at 18% 22%,rgba(106,188,128,.17),transparent 42%),linear-gradient(145deg,rgba(54,82,62,.34),rgba(35,25,17,.88))}
    .tournament-format-emblem{position:relative;display:grid;place-items:center;width:56px;height:68px;border:1px solid rgba(255,239,183,.38);border-radius:18px 18px 24px 24px;background:linear-gradient(155deg,rgba(255,229,139,.22),rgba(51,31,18,.82));color:#ffe071;font-size:30px;box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 10px 18px rgba(0,0,0,.3)}
    label[data-cup-format='league'] .tournament-format-emblem{color:#b9e7c5;background:linear-gradient(155deg,rgba(103,175,122,.2),rgba(39,49,35,.82))}
    .tournament-format-copy{min-width:0}.tournament-format-copy b,.tournament-format-copy small{display:block}

    .tournament-format-showcase{position:relative;display:grid;grid-template-columns:136px minmax(0,1fr);gap:22px;margin:16px 0;padding:22px;overflow:hidden;border:1px solid rgba(255,214,90,.42);border-radius:24px;background:radial-gradient(circle at 12% 30%,rgba(255,214,90,.18),transparent 32%),linear-gradient(145deg,rgba(76,47,19,.92),rgba(24,16,11,.98));box-shadow:0 22px 48px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.08)}
    .tournament-format-showcase[data-tone='league']{border-color:rgba(145,214,164,.35);background:radial-gradient(circle at 12% 30%,rgba(88,167,112,.17),transparent 32%),linear-gradient(145deg,rgba(43,67,49,.88),rgba(24,16,11,.98))}
    .tournament-format-showcase__trophy{display:grid;place-items:center;min-height:150px;border:1px solid rgba(255,239,183,.34);border-radius:24px;background:radial-gradient(circle at 50% 30%,rgba(255,241,174,.28),transparent 50%),rgba(0,0,0,.19);font-size:clamp(4rem,10vw,6rem);filter:drop-shadow(0 18px 20px rgba(0,0,0,.4))}
    .tournament-format-showcase:not([data-tone='league']) .tournament-format-showcase__trophy{animation:cup-trophy-float 2.6s ease-in-out infinite}
    .tournament-format-showcase__copy{min-width:0;align-self:center}.tournament-format-showcase__copy h3{margin:0;font-size:clamp(1.3rem,4vw,2rem)}
    .tournament-format-showcase__eyebrow{margin:0 0 5px;color:#ffe071;font-size:.7rem;font-weight:950;letter-spacing:.14em;text-transform:uppercase}
    .tournament-format-showcase__description{margin:9px 0 0;color:#ddcfb5;line-height:1.48}
    .tournament-format-showcase__facts{display:flex;flex-wrap:wrap;gap:7px;margin-top:13px}.tournament-format-showcase__facts span{padding:5px 9px;border:1px solid rgba(255,239,183,.2);border-radius:999px;background:rgba(255,255,255,.05);color:#fff0ad;font-size:.72rem;font-weight:900}
    .tournament-format-showcase__route{display:flex;align-items:stretch;gap:6px;margin-top:15px;overflow-x:auto;padding:2px 2px 6px}.tournament-format-showcase__stage{position:relative;display:grid;place-items:center;flex:1 0 102px;min-height:50px;padding:8px 10px;border:1px solid rgba(255,239,183,.18);border-radius:13px;background:rgba(0,0,0,.2);font-size:.72rem;font-weight:900;text-align:center}.tournament-format-showcase__stage:not(:last-child)::after{content:'›';position:absolute;right:-8px;color:#ffd65a;font-size:18px}
    .tournament-format-showcase__participants{display:flex;align-items:center;margin-top:14px;padding-left:4px}.tournament-format-showcase__participants .cup-experience-team-mark{margin-left:-5px;box-shadow:0 5px 12px rgba(0,0,0,.42)}.tournament-format-showcase__participants .cup-experience-team-mark:first-child{margin-left:0}.tournament-format-showcase__more{display:grid;place-items:center;min-width:34px;height:34px;margin-left:4px;border:1px solid rgba(255,239,183,.3);border-radius:50%;background:rgba(0,0,0,.35);font-size:.67rem;font-weight:900}

    .tournament-team-chip--visual{display:inline-flex;align-items:center;gap:7px;min-height:42px;padding:5px 10px 5px 6px}
    .cup-experience-team-mark{--cup-team-hue:28;display:grid;place-items:center;flex:0 0 auto;width:38px;height:38px;overflow:hidden;border:2px solid rgba(255,255,255,.78);border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font-size:20px;font-weight:950;text-shadow:0 1px 3px rgba(0,0,0,.8)}
    .cup-experience-team-mark img{width:100%;height:100%;object-fit:contain;padding:3px;box-sizing:border-box}.cup-experience-team-mark--icon{background:rgba(255,255,255,.94);color:#111;text-shadow:none}.cup-experience-team-mark--generated{border-radius:43% 43% 48% 48%/30% 30% 62% 62%;background:linear-gradient(145deg,hsl(var(--cup-team-hue) 62% 42%),hsl(var(--cup-team-hue) 58% 25%));font-size:10px}.cup-experience-team-mark--small{width:27px;height:27px;border-width:1px;font-size:14px}.cup-experience-team-mark--small.cup-experience-team-mark--generated{font-size:7px}.cup-experience-team-mark--large{width:clamp(74px,18vw,112px);height:clamp(74px,18vw,112px);border-width:4px;font-size:clamp(36px,9vw,58px);box-shadow:0 18px 32px rgba(0,0,0,.45)}.cup-experience-team-mark--large.cup-experience-team-mark--generated{font-size:clamp(16px,4vw,25px)}
    .tournament-bracket-team{display:inline-flex;align-items:center;gap:6px;min-width:0}.tournament-bracket-team__label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tournament-bracket__match:has(.tournament-bracket-team){min-height:62px;align-items:center}

    .tournament-final-intro{position:fixed;z-index:13050;inset:0;display:grid;place-items:center;width:100%;padding:max(18px,env(safe-area-inset-top,0px)) max(18px,env(safe-area-inset-right,0px)) max(18px,env(safe-area-inset-bottom,0px)) max(18px,env(safe-area-inset-left,0px));border:0;background:radial-gradient(circle at 50% 34%,rgba(255,214,90,.23),transparent 35%),rgba(7,6,5,.94);color:#fff7df;cursor:pointer;animation:cup-final-fade 2.35s ease both}
    .tournament-final-intro__card{width:min(760px,100%);padding:clamp(23px,5vw,42px);border:1px solid rgba(255,214,90,.62);border-radius:30px;background:radial-gradient(circle at 50% 0,rgba(255,214,90,.18),transparent 42%),linear-gradient(150deg,rgba(67,42,19,.98),rgba(17,12,8,.99));box-shadow:0 30px 90px rgba(0,0,0,.7);text-align:center;animation:cup-final-card .55s cubic-bezier(.2,.9,.24,1) both}
    .tournament-final-intro__eyebrow{display:block;color:#ffe071;font-size:.72rem;font-weight:950;letter-spacing:.18em;text-transform:uppercase}.tournament-final-intro__card h2{margin:7px 0 22px;font-size:clamp(2rem,8vw,4.6rem);line-height:.95}.tournament-final-intro__matchup{display:grid;grid-template-columns:minmax(0,1fr) 130px minmax(0,1fr);align-items:center;gap:20px}.tournament-final-intro__team{display:grid;justify-items:center;gap:10px;min-width:0}.tournament-final-intro__team strong{max-width:100%;overflow:hidden;font-size:clamp(1rem,3.5vw,1.55rem);text-overflow:ellipsis;white-space:nowrap}.tournament-final-intro__trophy{font-size:clamp(4.4rem,12vw,7.6rem);filter:drop-shadow(0 18px 20px rgba(0,0,0,.45));animation:cup-trophy-float 1.65s ease-in-out infinite}.tournament-final-intro__skip{display:block;margin-top:20px;color:#b7a98f;font-size:.7rem;font-weight:800}
    .tournament-complete .tournament-trophy{animation:cup-trophy-float 2.1s ease-in-out infinite}

    @keyframes cup-trophy-float{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-4px) scale(1.035)}}@keyframes cup-final-fade{0%{opacity:0}10%,78%{opacity:1}100%{opacity:0}}@keyframes cup-final-card{from{opacity:0;transform:translateY(20px) scale(.95)}to{opacity:1;transform:none}}
    @media(max-width:760px){.tournament-format-grid label[data-cup-format]>span{grid-template-columns:52px minmax(0,1fr);min-height:96px}.tournament-format-emblem{width:49px;height:60px;font-size:26px}.tournament-format-showcase{grid-template-columns:88px minmax(0,1fr);gap:15px;padding:17px}.tournament-format-showcase__trophy{min-height:120px;font-size:3.8rem}.tournament-final-intro__matchup{grid-template-columns:minmax(0,1fr) 82px minmax(0,1fr)}}
    @media(max-width:480px){.tournament-format-showcase{grid-template-columns:1fr}.tournament-format-showcase__trophy{min-height:100px}.tournament-final-intro__matchup{grid-template-columns:1fr}.tournament-final-intro__trophy{font-size:4.5rem}.tournament-final-intro__team strong{white-space:normal}}
    @media(prefers-reduced-motion:reduce){.tournament-preset[data-cup-card]::after,.tournament-format-grid label[data-cup-format]>span{transition:none}.tournament-preset__icon,.tournament-format-showcase__trophy,.tournament-final-intro,.tournament-final-intro__card,.tournament-final-intro__trophy,.tournament-complete .tournament-trophy{animation-duration:1ms!important;animation-iteration-count:1!important}}
  `;
  document.head.appendChild(style);
};

const cupExperienceCurrentSetup = panel => ({
  format: panel.querySelector('input[name="tournament-format"]:checked')?.value ?? TOURNAMENT_FORMAT.LEAGUE,
  category: panel.querySelector('input[name="tournament-category"]:checked')?.value ?? '',
  count: Number(panel.querySelector('#tournament-count')?.value) || 0,
});

const cupExperienceDecoratePresets = (panel, setup) => {
  const meta = {
    'hungarian-league': ['▦', setup.category === 'hungarian' && setup.format === TOURNAMENT_FORMAT.LEAGUE && setup.count === 12],
    'hungarian-cup': ['🏆', setup.category === 'hungarian' && setup.format === TOURNAMENT_FORMAT.KNOCKOUT && setup.count === 12],
    nations: ['🌍🏆', setup.category === 'nations' && setup.format === TOURNAMENT_FORMAT.GROUP_KNOCKOUT],
    'quick-cup': ['⚡🏆', setup.category === 'nations' && setup.format === TOURNAMENT_FORMAT.KNOCKOUT && setup.count === 8],
  };
  panel.querySelectorAll('.tournament-preset[data-preset]').forEach(button => {
    const [iconText, active] = meta[button.dataset.preset] ?? ['🏆', false];
    button.dataset.cupCard = 'true';
    if (!button.querySelector('.tournament-preset__icon')) {
      const icon = document.createElement('span');
      icon.className = 'tournament-preset__icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = iconText;
      const copy = document.createElement('span');
      copy.className = 'tournament-preset__copy';
      while (button.firstChild) copy.appendChild(button.firstChild);
      button.append(icon, copy);
    }
    button.classList.toggle('is-cup-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
};

const cupExperienceDecorateFormatCards = panel => {
  panel.querySelectorAll('input[name="tournament-format"]').forEach(input => {
    const config = CUP_EXPERIENCE_FORMATS[input.value];
    const label = input.closest('label');
    const span = label?.querySelector(':scope > span');
    if (!config || !label || !span) return;
    label.dataset.cupFormat = config.key;
    if (span.querySelector('.tournament-format-emblem')) return;
    const original = [...span.childNodes];
    const emblem = document.createElement('span');
    emblem.className = 'tournament-format-emblem';
    emblem.setAttribute('aria-hidden', 'true');
    emblem.textContent = config.icon;
    const copy = document.createElement('span');
    copy.className = 'tournament-format-copy';
    original.forEach(node => copy.appendChild(node));
    span.append(emblem, copy);
  });
};

const cupExperienceDecorateParticipants = panel => {
  const entries = cupExperienceCatalogEntries();
  const participants = [];
  panel.querySelectorAll('.tournament-team-chip').forEach(chip => {
    const labelText = chip.querySelector('.tournament-team-chip__label')?.textContent ?? chip.textContent;
    const entry = cupExperienceEntryForText(labelText, entries);
    if (!entry) return;
    participants.push(entry);
    if (chip.dataset.cupDecorated === 'true') return;
    chip.dataset.cupDecorated = 'true';
    chip.classList.add('tournament-team-chip--visual');
    const label = document.createElement('span');
    label.className = 'tournament-team-chip__label';
    label.textContent = entry.label;
    chip.replaceChildren(cupExperienceCreateMark(entry, 'small'), label);
  });
  return participants;
};

const cupExperienceShowcaseSignature = (setup, participants) => [
  setup.format,
  setup.category,
  setup.count,
  ...participants.map(team => team.id ?? team.label),
].join('|');

const cupExperienceCreateShowcase = (setup, participants) => {
  const config = CUP_EXPERIENCE_FORMATS[setup.format] ?? CUP_EXPERIENCE_FORMATS[TOURNAMENT_FORMAT.KNOCKOUT];
  const section = document.createElement('section');
  section.className = 'tournament-format-showcase';
  section.dataset.tone = config.key === 'league' ? 'league' : 'cup';
  section.dataset.signature = cupExperienceShowcaseSignature(setup, participants);
  section.setAttribute('aria-live', 'polite');
  section.setAttribute('aria-label', `${config.title}. ${setup.count} résztvevő.`);

  const trophy = document.createElement('div');
  trophy.className = 'tournament-format-showcase__trophy';
  trophy.setAttribute('aria-hidden', 'true');
  trophy.textContent = config.icon;

  const copy = document.createElement('div');
  copy.className = 'tournament-format-showcase__copy';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'tournament-format-showcase__eyebrow';
  eyebrow.textContent = config.eyebrow;
  const title = document.createElement('h3');
  title.textContent = config.title;
  const description = document.createElement('p');
  description.className = 'tournament-format-showcase__description';
  description.textContent = config.description;

  const facts = document.createElement('div');
  facts.className = 'tournament-format-showcase__facts';
  const labels = setup.format === TOURNAMENT_FORMAT.LEAGUE
    ? [`${setup.count} csapat`, 'Tabella', '1 bajnok']
    : [`${setup.count} csapat`, 'Kieséses mérkőzések', '1 serleg'];
  labels.forEach(text => {
    const item = document.createElement('span');
    item.textContent = text;
    facts.appendChild(item);
  });

  const route = document.createElement('div');
  route.className = 'tournament-format-showcase__route';
  route.setAttribute('aria-label', 'A verseny szakaszai');
  cupExperienceRounds(setup.format, setup.count).forEach(text => {
    const stage = document.createElement('span');
    stage.className = 'tournament-format-showcase__stage';
    stage.textContent = text;
    route.appendChild(stage);
  });

  const badges = document.createElement('div');
  badges.className = 'tournament-format-showcase__participants';
  badges.setAttribute('aria-label', 'Várható résztvevők jelvényei');
  participants.slice(0, 8).forEach(team => badges.appendChild(cupExperienceCreateMark(team, 'small')));
  if (participants.length > 8) {
    const more = document.createElement('span');
    more.className = 'tournament-format-showcase__more';
    more.textContent = `+${participants.length - 8}`;
    badges.appendChild(more);
  }

  copy.append(eyebrow, title, description, facts, route);
  if (participants.length) copy.appendChild(badges);
  section.append(trophy, copy);
  return section;
};

const cupExperienceDecorateSetup = panel => {
  const setup = cupExperienceCurrentSetup(panel);
  cupExperienceDecoratePresets(panel, setup);
  cupExperienceDecorateFormatCards(panel);
  const participants = cupExperienceDecorateParticipants(panel);
  const signature = cupExperienceShowcaseSignature(setup, participants);
  const existing = panel.querySelector('.tournament-format-showcase');
  if (existing?.dataset.signature === signature) return;
  existing?.remove();
  panel.querySelector('input[name="tournament-format"]')?.closest('.tournament-section')
    ?.after(cupExperienceCreateShowcase(setup, participants));
};

const cupExperienceDecorateBracket = panel => {
  const state = tournamentStorageService.read();
  if (!state) return;
  const byLabel = new Map((state.participants ?? []).map(team => [cupExperienceFold(team?.label), team]));
  panel.querySelectorAll('.tournament-bracket__match span').forEach(span => {
    if (span.dataset.cupDecorated === 'true') return;
    const team = byLabel.get(cupExperienceFold(span.textContent));
    if (!team) return;
    span.dataset.cupDecorated = 'true';
    span.classList.add('tournament-bracket-team');
    const label = document.createElement('span');
    label.className = 'tournament-bracket-team__label';
    label.textContent = team.label;
    span.replaceChildren(cupExperienceCreateMark(team, 'small'), label);
  });
};

const cupExperienceFinalWasShown = key => {
  try { return sessionStorage.getItem(key) === '1'; } catch { return false; }
};
const cupExperienceRememberFinal = key => {
  try { sessionStorage.setItem(key, '1'); } catch { /* Nem kötelező vizuális állapot. */ }
};

const cupExperienceMaybeShowFinal = panel => {
  if (!panel.querySelector('#tournament-play') || document.querySelector('.tournament-final-intro')) return;
  const state = tournamentStorageService.read();
  const match = state ? tournamentNextHumanMatch(state) : null;
  if (!state || !match) return;
  const round = state.rounds?.find(item => item.matches?.some(candidate => candidate.id === match.id));
  if (!cupExperienceFold(round?.label).includes('donto')) return;
  const finalKey = `${CUP_EXPERIENCE_FINAL_KEY}:${state.id}:${match.id}`;
  if (cupExperienceFinalWasShown(finalKey)) return;
  const home = tournamentTeamById(state, match.homeId);
  const away = tournamentTeamById(state, match.awayId);
  if (!home || !away) return;
  cupExperienceRememberFinal(finalKey);

  const overlay = document.createElement('button');
  overlay.type = 'button';
  overlay.className = 'tournament-final-intro';
  overlay.setAttribute('aria-label', `${state.name} döntő. ${home.label} és ${away.label}. Koppints az átugráshoz.`);
  const card = document.createElement('span');
  card.className = 'tournament-final-intro__card';
  const eyebrow = document.createElement('span');
  eyebrow.className = 'tournament-final-intro__eyebrow';
  eyebrow.textContent = state.name;
  const title = document.createElement('h2');
  title.textContent = 'DÖNTŐ';
  const matchup = document.createElement('span');
  matchup.className = 'tournament-final-intro__matchup';
  const teamNode = team => {
    const node = document.createElement('span');
    node.className = 'tournament-final-intro__team';
    const name = document.createElement('strong');
    name.textContent = team.label;
    node.append(cupExperienceCreateMark(team, 'large'), name);
    return node;
  };
  const trophy = document.createElement('span');
  trophy.className = 'tournament-final-intro__trophy';
  trophy.setAttribute('aria-hidden', 'true');
  trophy.textContent = '🏆';
  matchup.append(teamNode(home), trophy, teamNode(away));
  const skip = document.createElement('span');
  skip.className = 'tournament-final-intro__skip';
  skip.textContent = 'Koppints az átugráshoz';
  card.append(eyebrow, title, matchup, skip);
  overlay.appendChild(card);
  const dismiss = () => overlay.remove();
  overlay.addEventListener('click', dismiss, { once: true });
  document.body.appendChild(overlay);
  globalThis.setTimeout?.(dismiss, 2350);
};

const cupExperienceDecorateVisiblePanel = () => {
  document.querySelectorAll('.tournament-panel').forEach(panel => {
    if (panel.classList.contains('tournament-setup')) cupExperienceDecorateSetup(panel);
    if (panel.classList.contains('tournament-center') || panel.classList.contains('tournament-complete')) {
      cupExperienceDecorateBracket(panel);
    }
    if (panel.classList.contains('tournament-center')) cupExperienceMaybeShowFinal(panel);
  });
};

let cupExperienceTimer = 0;
const cupExperienceSchedule = () => {
  globalThis.clearTimeout?.(cupExperienceTimer);
  cupExperienceTimer = globalThis.setTimeout?.(cupExperienceDecorateVisiblePanel, 20) ?? 0;
};

export function installTournamentCupExperience() {
  if (typeof document === 'undefined') return null;
  cupExperienceEnsureStyles();
  const root = document.querySelector('#overlay-body') ?? document.body;
  const observer = new MutationObserver(cupExperienceSchedule);
  observer.observe(root, { childList: true });
  document.addEventListener('change', event => {
    if (event.target?.closest?.('.tournament-panel')) cupExperienceSchedule();
  });
  document.addEventListener('click', event => {
    if (event.target?.closest?.('.tournament-preset')) cupExperienceSchedule();
  });
  cupExperienceSchedule();
  return observer;
}

installTournamentCupExperience();
