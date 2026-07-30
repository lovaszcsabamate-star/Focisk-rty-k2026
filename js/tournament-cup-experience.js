/**
 * Látványos kupaélmény a meglévő Torna mód fölött.
 *
 * A réteg kizárólag a felületet egészíti ki: a résztvevőket a Gyors meccs
 * katalógusából, az aktív kupaágat pedig a meglévő torna-mentésből olvassa.
 * Nem módosítja a torna domaint, a sorsolást vagy a mentési sémát.
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
const CUP_EXPERIENCE_FINAL_SESSION_PREFIX = 'fociskartyak.tournament-final-intro.v1';
const CUP_EXPERIENCE_SCAN_DELAY = 24;

const cupExperienceText = value => String(value ?? '').trim();
const cupExperienceFold = value => cupExperienceText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('hu-HU')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
const cupExperienceInitials = label => cupExperienceText(label)
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 3)
  .map(word => word[0])
  .join('')
  .toUpperCase();
const cupExperienceHue = label => [...cupExperienceText(label)]
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

const cupExperienceEntryForLabel = (label, entries = cupExperienceCatalogEntries()) => {
  const folded = cupExperienceFold(label);
  if (!folded) return null;
  return entries.find(entry => cupExperienceFold(entry?.label) === folded)
    ?? entries
      .filter(entry => folded.endsWith(cupExperienceFold(entry?.label)))
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

const cupExperienceFormatMeta = Object.freeze({
  [TOURNAMENT_FORMAT.GROUP_KNOCKOUT]: Object.freeze({
    icon: '🏆',
    eyebrow: 'Csoportból a döntőig',
    title: 'Csoportkör + kupaág',
    description: 'A tabelláról a kieséses szakaszba, majd egyetlen döntőben dől el a serleg sorsa.',
    tone: 'hybrid',
  }),
  [TOURNAMENT_FORMAT.KNOCKOUT]: Object.freeze({
    icon: '🏆',
    eyebrow: 'Minden párbaj számít',
    title: 'Egyenes kieséses kupa',
    description: 'A vesztes kiesik, a győztes továbbjut. A végén csak egy csapat emelheti magasba a serleget.',
    tone: 'cup',
  }),
  [TOURNAMENT_FORMAT.LEAGUE]: Object.freeze({
    icon: '▦',
    eyebrow: 'Hosszú távú verseny',
    title: 'Bajnoki liga',
    description: 'Mindenki játszik mindenkivel, és a teljesítmény a tabellán áll össze bajnoki eredménnyé.',
    tone: 'league',
  }),
});

const cupExperienceRoundLabels = (format, count) => {
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
  if (typeof document === 'undefined' || document.getElementById(CUP_EXPERIENCE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = CUP_EXPERIENCE_STYLE_ID;
  style.textContent = `
    .tournament-preset[data-cup-experience] { position: relative; display: grid; grid-template-columns: 54px minmax(0,1fr); align-items: center; gap: 11px; min-height: 88px; overflow: hidden; isolation: isolate; }
    .tournament-preset[data-cup-experience]::after { content: ''; position: absolute; z-index: -1; inset: -55% -20%; opacity: 0; background: linear-gradient(110deg, transparent 35%, rgba(255,243,189,.18) 50%, transparent 65%); transform: translateX(-45%); transition: opacity .2s ease, transform .5s ease; }
    .tournament-preset[data-cup-experience]:hover::after, .tournament-preset[data-cup-experience]:focus-visible::after, .tournament-preset.is-cup-experience-active::after { opacity: 1; transform: translateX(45%); }
    .tournament-preset.is-cup-experience-active { border-color: #ffd65a; background: radial-gradient(circle at 12% 30%, rgba(255,214,90,.22), transparent 44%), rgba(255,214,90,.11); box-shadow: inset 0 0 0 1px rgba(255,214,90,.35), 0 10px 28px rgba(0,0,0,.22); }
    .tournament-preset__cup-icon { display: grid; place-items: center; width: 50px; height: 56px; border: 1px solid rgba(255,239,183,.34); border-radius: 16px 16px 21px 21px; background: linear-gradient(155deg, rgba(255,221,105,.22), rgba(45,28,17,.72)); font-size: 25px; filter: drop-shadow(0 8px 12px rgba(0,0,0,.38)); }
    .tournament-preset[data-preset*='cup'] .tournament-preset__cup-icon, .tournament-preset[data-preset='nations'] .tournament-preset__cup-icon { color: #ffe071; animation: cup-experience-trophy-breathe 2.6s ease-in-out infinite; }

    .tournament-format-grid label[data-cup-format] > span { position: relative; display: grid; grid-template-columns: 62px minmax(0,1fr); align-items: center; gap: 12px; min-height: 122px; overflow: hidden; padding: 14px; isolation: isolate; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease; }
    .tournament-format-grid label[data-cup-format] > span::after { content: ''; position: absolute; z-index: -1; inset: 0; opacity: 0; background: radial-gradient(circle at 22% 24%, rgba(255,222,111,.22), transparent 43%); transition: opacity .18s ease; }
    .tournament-format-grid label[data-cup-format]:hover > span { transform: translateY(-2px); border-color: rgba(255,239,183,.46); }
    .tournament-format-grid label[data-cup-format] input:checked + span { transform: translateY(-2px); box-shadow: inset 0 0 0 1px rgba(255,214,90,.48), 0 16px 32px rgba(0,0,0,.25); }
    .tournament-format-grid label[data-cup-format] input:checked + span::after { opacity: 1; }
    .tournament-format-grid label[data-cup-format='knockout'] input:checked + span, .tournament-format-grid label[data-cup-format='group-knockout'] input:checked + span { background: linear-gradient(145deg, rgba(112,72,21,.38), rgba(42,26,15,.88)); }
    .tournament-format-grid label[data-cup-format='league'] input:checked + span { background: linear-gradient(145deg, rgba(54,82,62,.34), rgba(35,25,17,.88)); }
    .tournament-format-copy { min-width: 0; }
    .tournament-format-copy b, .tournament-format-copy small { display: block; }
    .tournament-format-emblem { position: relative; display: grid; place-items: center; width: 58px; height: 70px; border: 1px solid rgba(255,239,183,.38); border-radius: 18px 18px 24px 24px; background: linear-gradient(155deg, rgba(255,229,139,.22), rgba(51,31,18,.82)); color: #ffe071; font-size: 31px; box-shadow: inset 0 1px 0 rgba(255,255,255,.1), 0 10px 18px rgba(0,0,0,.3); }
    .tournament-format-emblem::after { content: ''; position: absolute; bottom: -5px; width: 29px; height: 7px; border-radius: 50%; background: rgba(255,214,90,.3); filter: blur(4px); }
    label[data-cup-format='league'] .tournament-format-emblem { color: #b9e7c5; background: linear-gradient(155deg, rgba(103,175,122,.2), rgba(39,49,35,.82)); }

    .tournament-format-showcase { position: relative; display: grid; grid-template-columns: 146px minmax(0,1fr); gap: clamp(15px,3vw,26px); margin: 16px 0; padding: clamp(17px,3vw,25px); overflow: hidden; border: 1px solid rgba(255,214,90,.4); border-radius: 24px; background: radial-gradient(circle at 12% 30%, rgba(255,214,90,.18), transparent 32%), linear-gradient(145deg, rgba(76,47,19,.92), rgba(24,16,11,.98)); box-shadow: 0 22px 48px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.08); isolation: isolate; }
    .tournament-format-showcase[data-tone='league'] { border-color: rgba(145,214,164,.35); background: radial-gradient(circle at 12% 30%, rgba(88,167,112,.17), transparent 32%), linear-gradient(145deg, rgba(43,67,49,.88), rgba(24,16,11,.98)); }
    .tournament-format-showcase::after { content: ''; position: absolute; z-index: -1; inset: 0; pointer-events: none; background-image: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px); background-size: 28px 28px; mask-image: linear-gradient(90deg, #000, transparent 72%); }
    .tournament-format-showcase__trophy { position: relative; display: grid; place-items: center; min-height: 154px; border: 1px solid rgba(255,239,183,.34); border-radius: 24px; background: radial-gradient(circle at 50% 30%, rgba(255,241,174,.28), transparent 50%), rgba(0,0,0,.19); font-size: clamp(4.2rem,10vw,6.4rem); filter: drop-shadow(0 18px 20px rgba(0,0,0,.4)); }
    .tournament-format-showcase[data-tone='cup'] .tournament-format-showcase__trophy, .tournament-format-showcase[data-tone='hybrid'] .tournament-format-showcase__trophy { animation: cup-experience-trophy-breathe 2.6s ease-in-out infinite; }
    .tournament-format-showcase__trophy::after { content: ''; position: absolute; bottom: 15px; width: 62%; height: 14px; border-radius: 50%; background: rgba(255,214,90,.28); filter: blur(9px); }
    .tournament-format-showcase__copy { min-width: 0; align-self: center; }
    .tournament-format-showcase__eyebrow { margin: 0 0 5px; color: #ffe071; font-size: .7rem; font-weight: 950; letter-spacing: .14em; text-transform: uppercase; }
    .tournament-format-showcase[data-tone='league'] .tournament-format-showcase__eyebrow { color: #b9e7c5; }
    .tournament-format-showcase__copy h3 { margin: 0; font-size: clamp(1.3rem,4vw,2rem); }
    .tournament-format-showcase__copy > p:last-of-type { margin: 9px 0 0; color: #ddcfb5; line-height: 1.48; }
    .tournament-format-showcase__facts { display: flex; flex-wrap: wrap; gap: 7px; margin: 13px 0 0; }
    .tournament-format-showcase__facts span { padding: 5px 9px; border: 1px solid rgba(255,239,183,.2); border-radius: 999px; background: rgba(255,255,255,.05); color: #fff0ad; font-size: .72rem; font-weight: 900; }
    .tournament-format-showcase__route { display: flex; align-items: stretch; gap: 6px; margin-top: 15px; overflow-x: auto; padding: 2px 2px 6px; scrollbar-width: thin; }
    .tournament-format-showcase__stage { position: relative; display: grid; place-items: center; flex: 1 0 104px; min-height: 52px; padding: 8px 10px; border: 1px solid rgba(255,239,183,.18); border-radius: 13px; background: rgba(0,0,0,.2); color: #f9eacb; font-size: .72rem; font-weight: 900; text-align: center; }
    .tournament-format-showcase__stage:not(:last-child)::after { content: '›'; position: absolute; z-index: 2; right: -8px; color: #ffd65a; font-size: 18px; }
    .tournament-format-showcase__participants { display: flex; align-items: center; margin-top: 14px; padding-left: 5px; }
    .tournament-format-showcase__participants .cup-experience-team-mark { margin-left: -5px; border-color: rgba(255,239,183,.72); box-shadow: 0 5px 12px rgba(0,0,0,.42); }
    .tournament-format-showcase__participants .cup-experience-team-mark:first-child { margin-left: 0; }
    .tournament-format-showcase__more { display: grid; place-items: center; min-width: 35px; height: 35px; margin-left: 4px; border: 1px solid rgba(255,239,183,.3); border-radius: 50%; background: rgba(0,0,0,.35); color: #f5dfad; font-size: .67rem; font-weight: 900; }

    .tournament-team-chip--visual { display: inline-flex; align-items: center; gap: 7px; min-height: 42px; padding: 5px 10px 5px 6px; }
    .cup-experience-team-mark { --cup-team-hue: 28; display: grid; place-items: center; flex: 0 0 auto; width: 38px; height: 38px; overflow: hidden; border: 2px solid rgba(255,255,255,.78); border-radius: 50%; background: rgba(255,255,255,.08); color: white; font-size: 20px; font-weight: 950; line-height: 1; text-shadow: 0 1px 3px rgba(0,0,0,.8); }
    .cup-experience-team-mark img { width: 100%; height: 100%; object-fit: contain; padding: 3px; box-sizing: border-box; }
    .cup-experience-team-mark--generated { border-radius: 43% 43% 48% 48% / 30% 30% 62% 62%; background: linear-gradient(145deg, hsl(var(--cup-team-hue) 62% 42%), hsl(var(--cup-team-hue) 58% 25%)); font-size: 10px; }
    .cup-experience-team-mark--icon { background: rgba(255,255,255,.94); color: #111; text-shadow: none; }
    .cup-experience-team-mark--small { width: 27px; height: 27px; border-width: 1px; font-size: 14px; }
    .cup-experience-team-mark--small.cup-experience-team-mark--generated { font-size: 7px; }
    .cup-experience-team-mark--large { width: clamp(74px,18vw,112px); height: clamp(74px,18vw,112px); border-width: 4px; font-size: clamp(36px,9vw,58px); box-shadow: 0 18px 32px rgba(0,0,0,.45); }
    .cup-experience-team-mark--large.cup-experience-team-mark--generated { font-size: clamp(16px,4vw,25px); }

    .tournament-bracket-team { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
    .tournament-bracket-team__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tournament-bracket__match:has(.tournament-bracket-team) { min-height: 62px; align-items: center; }

    .tournament-final-intro { position: fixed; z-index: 13050; inset: 0; display: grid; place-items: center; width: 100%; padding: max(18px,env(safe-area-inset-top,0px)) max(18px,env(safe-area-inset-right,0px)) max(18px,env(safe-area-inset-bottom,0px)) max(18px,env(safe-area-inset-left,0px)); border: 0; background: radial-gradient(circle at 50% 34%, rgba(255,214,90,.23), transparent 35%), rgba(7,6,5,.94); color: #fff7df; cursor: pointer; animation: cup-experience-final-fade 2.35s ease both; }
    .tournament-final-intro__card { width: min(760px,100%); padding: clamp(23px,5vw,42px); border: 1px solid rgba(255,214,90,.62); border-radius: 30px; background: radial-gradient(circle at 50% 0, rgba(255,214,90,.18), transparent 42%), linear-gradient(150deg, rgba(67,42,19,.98), rgba(17,12,8,.99)); box-shadow: 0 30px 90px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.09); text-align: center; animation: cup-experience-final-card .55s cubic-bezier(.2,.9,.24,1) both; }
    .tournament-final-intro__eyebrow { display: block; color: #ffe071; font-size: .72rem; font-weight: 950; letter-spacing: .18em; text-transform: uppercase; }
    .tournament-final-intro__card h2 { margin: 7px 0 22px; font-size: clamp(2rem,8vw,4.6rem); line-height: .95; }
    .tournament-final-intro__matchup { display: grid; grid-template-columns: minmax(0,1fr) 130px minmax(0,1fr); align-items: center; gap: clamp(10px,3vw,24px); }
    .tournament-final-intro__team { display: grid; justify-items: center; gap: 10px; min-width: 0; }
    .tournament-final-intro__team strong { max-width: 100%; overflow: hidden; font-size: clamp(1rem,3.5vw,1.55rem); text-overflow: ellipsis; white-space: nowrap; }
    .tournament-final-intro__trophy { display: grid; place-items: center; font-size: clamp(4.4rem,12vw,7.6rem); filter: drop-shadow(0 18px 20px rgba(0,0,0,.45)); animation: cup-experience-trophy-breathe 1.65s ease-in-out infinite; }
    .tournament-final-intro__skip { display: block; margin-top: 20px; color: #b7a98f; font-size: .7rem; font-weight: 800; }

    .tournament-complete .tournament-trophy { animation: cup-experience-trophy-breathe 2.1s ease-in-out infinite; }

    @keyframes cup-experience-trophy-breathe { 0%,100% { transform: translateY(0) scale(1); filter: drop-shadow(0 12px 16px rgba(0,0,0,.38)); } 50% { transform: translateY(-4px) scale(1.035); filter: drop-shadow(0 17px 23px rgba(255,214,90,.18)); } }
    @keyframes cup-experience-final-fade { 0% { opacity: 0; } 10%,78% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes cup-experience-final-card { from { opacity: 0; transform: translateY(20px) scale(.95); } to { opacity: 1; transform: none; } }

    @media (max-width:760px) {
      .tournament-format-grid label[data-cup-format] > span { grid-template-columns: 54px minmax(0,1fr); min-height: 96px; }
      .tournament-format-emblem { width: 50px; height: 60px; font-size: 27px; }
      .tournament-format-showcase { grid-template-columns: 92px minmax(0,1fr); border-radius: 20px; }
      .tournament-format-showcase__trophy { min-height: 126px; border-radius: 19px; font-size: 4rem; }
      .tournament-final-intro__matchup { grid-template-columns: minmax(0,1fr) 84px minmax(0,1fr); }
      .tournament-final-intro__team strong { white-space: normal; text-wrap: balance; }
    }
    @media (max-width:480px) {
      .tournament-preset[data-cup-experience] { grid-template-columns: 47px minmax(0,1fr); min-height: 74px; }
      .tournament-preset__cup-icon { width: 43px; height: 49px; font-size: 22px; }
      .tournament-format-showcase { grid-template-columns: 1fr; }
      .tournament-format-showcase__trophy { min-height: 108px; }
      .tournament-format-showcase__route { margin-inline: -3px; }
      .tournament-final-intro__matchup { grid-template-columns: 1fr; }
      .tournament-final-intro__trophy { font-size: 4.6rem; }
      .tournament-final-intro__card h2 { margin-bottom: 15px; }
      .tournament-final-intro__team strong { font-size: 1rem; }
    }
    @media (prefers-reduced-motion:reduce) {
      .tournament-preset[data-cup-experience]::after, .tournament-format-grid label[data-cup-format] > span { transition: none; }
      .tournament-preset__cup-icon, .tournament-format-showcase__trophy, .tournament-final-intro, .tournament-final-intro__card, .tournament-final-intro__trophy, .tournament-complete .tournament-trophy { animation-duration: 1ms !important; animation-iteration-count: 1 !important; }
    }
  `;
  document.head?.appendChild(style);
};

const cupExperiencePresetMeta = Object.freeze({
  'hungarian-league': Object.freeze({ icon: '▦', label: 'Magyar bajnokság' }),
  'hungarian-cup': Object.freeze({ icon: '🏆', label: 'Magyar Kupa' }),
  nations: Object.freeze({ icon: '🌍🏆', label: 'Nemzetek tornája' }),
  'quick-cup': Object.freeze({ icon: '⚡🏆', label: 'Villámkupa' }),
});

const cupExperienceDecoratePresets = (panel, format, count) => {
  panel.querySelectorAll('.tournament-preset[data-preset]').forEach(button => {
    const preset = cupExperiencePresetMeta[button.dataset.preset];
    if (!preset) return;
    button.dataset.cupExperience = 'true';
    if (!button.querySelector('.tournament-preset__cup-icon')) {
      const icon = document.createElement('span');
      icon.className = 'tournament-preset__cup-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = preset.icon;
      const copy = document.createElement('span');
      copy.className = 'tournament-preset__copy';
      while (button.firstChild) copy.appendChild(button.firstChild);
      button.append(icon, copy);
    }
    const active = button.dataset.preset === 'hungarian-league'
      ? format === TOURNAMENT_FORMAT.LEAGUE && Number(count) === 12
      : button.dataset.preset === 'hungarian-cup'
        ? format === TOURNAMENT_FORMAT.KNOCKOUT && Number(count) === 12
        : button.dataset.preset === 'nations'
          ? format === TOURNAMENT_FORMAT.GROUP_KNOCKOUT
          : format === TOURNAMENT_FORMAT.KNOCKOUT && Number(count) === 8;
    button.classList.toggle('is-cup-experience-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
};

const cupExperienceFormatKey = format => ({
  [TOURNAMENT_FORMAT.GROUP_KNOCKOUT]: 'group-knockout',
  [TOURNAMENT_FORMAT.KNOCKOUT]: 'knockout',
  [TOURNAMENT_FORMAT.LEAGUE]: 'league',
}[format] ?? 'unknown');

const cupExperienceDecorateFormatCards = panel => {
  panel.querySelectorAll('input[name="tournament-format"]').forEach(input => {
    const label = input.closest('label');
    const span = label?.querySelector(':scope > span');
    if (!label || !span) return;
    label.dataset.cupFormat = cupExperienceFormatKey(input.value);
    if (span.querySelector('.tournament-format-emblem')) return;
    const original = [...span.childNodes];
    const emblem = document.createElement('span');
    emblem.className = 'tournament-format-emblem';
    emblem.setAttribute('aria-hidden', 'true');
    emblem.textContent = CUP_EXPERIENCE_FORMAT_ICON[input.value] ?? '🏆';
    const copy = document.createElement('span');
    copy.className = 'tournament-format-copy';
    original.forEach(node => copy.appendChild(node));
    span.append(emblem, copy);
  });
};

const CUP_EXPERIENCE_FORMAT_ICON = Object.freeze({
  [TOURNAMENT_FORMAT.GROUP_KNOCKOUT]: '🏆',
  [TOURNAMENT_FORMAT.KNOCKOUT]: '🏆',
  [TOURNAMENT_FORMAT.LEAGUE]: '▦',
});

const cupExperienceDecorateParticipantChips = panel => {
  const entries = cupExperienceCatalogEntries();
  const resolved = [];
  panel.querySelectorAll('.tournament-team-chip').forEach(chip => {
    if (chip.dataset.cupExperienceDecorated === 'true') {
      const label = chip.querySelector('.tournament-team-chip__label')?.textContent;
      const entry = cupExperienceEntryForLabel(label, entries);
      if (entry) resolved.push(entry);
      return;
    }
    const entry = cupExperienceEntryForLabel(chip.textContent, entries);
    if (!entry) return;
    chip.dataset.cupExperienceDecorated = 'true';
    chip.classList.add('tournament-team-chip--visual');
    const label = document.createElement('span');
    label.className = 'tournament-team-chip__label';
    label.textContent = entry.label;
    chip.replaceChildren(cupExperienceCreateMark(entry, 'small'), label);
    resolved.push(entry);
  });
  return resolved;
};

const cupExperienceCreateShowcase = ({ format, count, participants }) => {
  const meta = cupExperienceFormatMeta[format] ?? cupExperienceFormatMeta[TOURNAMENT_FORMAT.KNOCKOUT];
  const showcase = document.createElement('section');
  showcase.className = 'tournament-format-showcase';
  showcase.dataset.tone = meta.tone;
  showcase.setAttribute('aria-live', 'polite');
  showcase.setAttribute('aria-label', `${meta.title}. ${count} résztvevő.`);

  const trophy = document.createElement('div');
  trophy.className = 'tournament-format-showcase__trophy';
  trophy.setAttribute('aria-hidden', 'true');
  trophy.textContent = meta.icon;

  const copy = document.createElement('div');
  copy.className = 'tournament-format-showcase__copy';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'tournament-format-showcase__eyebrow';
  eyebrow.textContent = meta.eyebrow;
  const title = document.createElement('h3');
  title.textContent = meta.title;
  const description = document.createElement('p');
  description.textContent = meta.description;

  const facts = document.createElement('div');
  facts.className = 'tournament-format-showcase__facts';
  const factTexts = format === TOURNAMENT_FORMAT.LEAGUE
    ? [`${count} csapat`, 'Tabella', '1 bajnok']
    : [`${count} csapat`, 'Kieséses mérkőzések', '1 serleg'];
  factTexts.forEach(text => {
    const fact = document.createElement('span');
    fact.textContent = text;
    facts.appendChild(fact);
  });

  const route = document.createElement('div');
  route.className = 'tournament-format-showcase__route';
  route.setAttribute('aria-label', 'A torna szakaszai');
  cupExperienceRoundLabels(format, count).forEach(stageLabel => {
    const stage = document.createElement('span');
    stage.className = 'tournament-format-showcase__stage';
    stage.textContent = stageLabel;
    route.appendChild(stage);
  });

  const participantRow = document.createElement('div');
  participantRow.className = 'tournament-format-showcase__participants';
  participantRow.setAttribute('aria-label', 'Várható résztvevők jelvényei');
  participants.slice(0, 8).forEach(team => participantRow.appendChild(cupExperienceCreateMark(team, 'small')));
  if (participants.length > 8) {
    const more = document.createElement('span');
    more.className = 'tournament-format-showcase__more';
    more.textContent = `+${participants.length - 8}`;
    participantRow.appendChild(more);
  }

  copy.append(eyebrow, title, description, facts, route);
  if (participants.length) copy.appendChild(participantRow);
  showcase.append(trophy, copy);
  return showcase;
};

const cupExperienceDecorateSetup = panel => {
  const formatInput = panel.querySelector('input[name="tournament-format"]:checked');
  const format = formatInput?.value ?? TOURNAMENT_FORMAT.LEAGUE;
  const count = Number(panel.querySelector('#tournament-count')?.value) || 0;
  cupExperienceDecoratePresets(panel, format, count);
  cupExperienceDecorateFormatCards(panel);
  const participants = cupExperienceDecorateParticipantChips(panel);
  panel.querySelector('.tournament-format-showcase')?.remove();
  const formatSection = formatInput?.closest('.tournament-section');
  formatSection?.after(cupExperienceCreateShowcase({ format, count, participants }));
};

const cupExperienceDecorateBracket = panel => {
  const state = tournamentStorageService.read();
  if (!state) return;
  const teams = Array.isArray(state.participants) ? state.participants : [];
  const byLabel = new Map(teams.map(team => [cupExperienceFold(team?.label), team]));
  panel.querySelectorAll('.tournament-bracket__match span').forEach(span => {
    if (span.dataset.cupExperienceDecorated === 'true') return;
    const team = byLabel.get(cupExperienceFold(span.textContent));
    if (!team) return;
    span.dataset.cupExperienceDecorated = 'true';
    span.classList.add('tournament-bracket-team');
    const label = document.createElement('span');
    label.className = 'tournament-bracket-team__label';
    label.textContent = team.label;
    span.replaceChildren(cupExperienceCreateMark(team, 'small'), label);
  });
};

const cupExperienceFinalKey = (state, match) => `${CUP_EXPERIENCE_FINAL_SESSION_PREFIX}:${state.id}:${match.id}`;
const cupExperienceWasFinalShown = key => {
  try { return globalThis.sessionStorage?.getItem(key) === '1'; } catch { return false; }
};
const cupExperienceMarkFinalShown = key => {
  try { globalThis.sessionStorage?.setItem(key, '1'); } catch { /* A vizuális átvezető mentése nem kötelező. */ }
};

const cupExperienceDismissFinal = overlay => {
  if (!overlay?.isConnected) return;
  overlay.classList.add('is-dismissing');
  globalThis.setTimeout?.(() => overlay.remove(), 90);
};

const cupExperienceMaybeShowFinalIntro = panel => {
  if (!panel.querySelector('#tournament-play') || document.querySelector('.tournament-final-intro')) return;
  const state = tournamentStorageService.read();
  if (!state) return;
  const nextMatch = tournamentNextHumanMatch(state);
  if (!nextMatch) return;
  const round = state.rounds?.find(item => item.matches?.some(match => match.id === nextMatch.id));
  if (!cupExperienceFold(round?.label).includes('donto')) return;
  const key = cupExperienceFinalKey(state, nextMatch);
  if (cupExperienceWasFinalShown(key)) return;

  const home = tournamentTeamById(state, nextMatch.homeId);
  const away = tournamentTeamById(state, nextMatch.awayId);
  if (!home || !away) return;
  cupExperienceMarkFinalShown(key);

  const overlay = document.createElement('button');
  overlay.type = 'button';
  overlay.className = 'tournament-final-intro';
  overlay.setAttribute('aria-label', `${state.name} döntő. ${home.label} és ${away.label}. Koppints az átugráshoz.`);
  const card = document.createElement('span');
  card.className = 'tournament-final-intro__card';
  const eyebrow = document.createElement('span');
  eyebrow.className = 'tournament-final-intro__eyebrow';
  eyebrow.textContent = cupExperienceText(state.name) || 'Kupa';
  const title = document.createElement('h2');
  title.textContent = 'DÖNTŐ';
  const matchup = document.createElement('span');
  matchup.className = 'tournament-final-intro__matchup';

  const teamBlock = team => {
    const block = document.createElement('span');
    block.className = 'tournament-final-intro__team';
    const name = document.createElement('strong');
    name.textContent = team.label;
    block.append(cupExperienceCreateMark(team, 'large'), name);
    return block;
  };

  const trophy = document.createElement('span');
  trophy.className = 'tournament-final-intro__trophy';
  trophy.setAttribute('aria-hidden', 'true');
  trophy.textContent = '🏆';
  matchup.append(teamBlock(home), trophy, teamBlock(away));
  const skip = document.createElement('span');
  skip.className = 'tournament-final-intro__skip';
  skip.textContent = 'Koppints az átugráshoz';
  card.append(eyebrow, title, matchup, skip);
  overlay.appendChild(card);
  overlay.addEventListener('click', () => cupExperienceDismissFinal(overlay), { once: true });
  document.body.appendChild(overlay);
  globalThis.setTimeout?.(() => cupExperienceDismissFinal(overlay), 2350);
};

const cupExperienceDecoratePanel = panel => {
  if (!(panel instanceof HTMLElement)) return;
  if (panel.classList.contains('tournament-setup')) cupExperienceDecorateSetup(panel);
  if (panel.classList.contains('tournament-center') || panel.classList.contains('tournament-complete')) {
    cupExperienceDecorateBracket(panel);
  }
  if (panel.classList.contains('tournament-center')) cupExperienceMaybeShowFinalIntro(panel);
};

let cupExperienceScanScheduled = false;
const cupExperienceScan = () => {
  cupExperienceScanScheduled = false;
  document.querySelectorAll('.tournament-panel').forEach(cupExperienceDecoratePanel);
};
const cupExperienceScheduleScan = () => {
  if (cupExperienceScanScheduled) return;
  cupExperienceScanScheduled = true;
  globalThis.setTimeout?.(cupExperienceScan, CUP_EXPERIENCE_SCAN_DELAY);
};

export function installTournamentCupExperience() {
  if (typeof document === 'undefined') return null;
  cupExperienceEnsureStyles();
  const root = document.querySelector('#overlay-body') ?? document.body;
  const observer = new MutationObserver(cupExperienceScheduleScan);
  observer.observe(root, { childList: true, subtree: true });
  document.addEventListener('change', event => {
    if (event.target?.closest?.('.tournament-panel')) cupExperienceScheduleScan();
  });
  cupExperienceScheduleScan();
  return observer;
}

installTournamentCupExperience();
