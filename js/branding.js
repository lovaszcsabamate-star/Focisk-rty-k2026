/** Runtime branding policy backed by the central asset-service. */

import { ASSET_PLACEHOLDERS, assetService } from './services/asset-service.js';

// Statikus kompatibilitási szerződés: player-silhouette.svg, club-badge.svg, app-icon.svg.
(() => {
  const brandingConfig = Object.freeze({
    allowOfficialBranding: false,
    playerPlaceholderPath: ASSET_PLACEHOLDERS.player,
    clubPlaceholderPath: ASSET_PLACEHOLDERS.club,
    appIconPath: ASSET_PLACEHOLDERS.appIcon,
    blockRemotePlayerPhotos: true,
    blockRemoteClubLogos: true,
  });

  const isRemoteAssetUrl = value => assetService.isRemoteAssetUrl(value, {
    baseUrl: document.baseURI,
    origin: window.location.origin,
  });
  const isApprovedReleaseAsset = path => assetService.isApprovedReleaseAsset(path);
  const isProtectedUnapprovedArt = path => assetService.isProtectedUnapprovedArt(path);

  /**
   * UI.tryArt uses `new Image()` probes. Guard those probes before the game modules
   * start, so remote URLs and unapproved portrait/logo folders never create a
   * network request. Normal interface images outside protected art folders remain
   * untouched.
   */
  const installImageRequestGuard = () => {
    if (typeof window === 'undefined' || typeof window.Image !== 'function') return;
    if (window.Image.__fociskartyakGuarded) return;

    const NativeImage = window.Image;
    const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (!srcDescriptor?.get || !srcDescriptor?.set) return;

    function GuardedImage(width, height) {
      const image = new NativeImage(width, height);
      Object.defineProperty(image, 'src', {
        configurable: true,
        enumerable: true,
        get: () => srcDescriptor.get.call(image),
        set: value => {
          const blocked = isRemoteAssetUrl(value) || isProtectedUnapprovedArt(value);
          if (blocked) {
            queueMicrotask(() => image.onerror?.(new Event('error')));
            return;
          }
          srcDescriptor.set.call(image, value);
        },
      });
      return image;
    }

    GuardedImage.prototype = NativeImage.prototype;
    Object.defineProperty(GuardedImage, '__fociskartyakGuarded', { value: true });
    window.Image = GuardedImage;
  };

  const TEAM_LOGO_RESTORATION_KEY = '__FOCISKARTYAK_TEAM_LOGO_RESTORATION__';
  const TEAM_LOGO_SELECTOR = '.quick-team-mark--text:not([data-generated-club-logo])';
  const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

  const foldClubLabel = value => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('hu-HU')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const clubInitials = value => String(value ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(word => word[0])
    .join('')
    .toLocaleUpperCase('hu-HU');

  /**
   * Egyetlen központi, jogtiszta NB I prezentációs térkép. Nem hivatalos címereket,
   * hanem kizárólag klubszínekből és rövid klubjelekből generált játékbeli badge-eket
   * ír le. A Torna, Quick Match, HUD és VS intro ugyanennek a branding-rétegnek a
   * `.quick-team-mark` komponensét használja.
   */
  const TEAM_CLUB_PRESENTATIONS = Object.freeze({
    dvsc: Object.freeze({ short: 'DVSC', primary: '#c8192e', secondary: '#ffffff' }),
    dvtk: Object.freeze({ short: 'DVTK', primary: '#d71920', secondary: '#ffffff' }),
    'eto fc': Object.freeze({ short: 'ETO', primary: '#159447', secondary: '#ffffff' }),
    'ferencvarosi tc': Object.freeze({ short: 'FTC', primary: '#16854a', secondary: '#ffffff' }),
    'kisvarda master good': Object.freeze({ short: 'KISV', primary: '#d8222a', secondary: '#ffffff' }),
    'kolorcity kazincbarcika sc': Object.freeze({ short: 'KBSC', primary: '#2468a9', secondary: '#f2cf2f' }),
    'mtk budapest': Object.freeze({ short: 'MTK', primary: '#246eb9', secondary: '#ffffff' }),
    'nyiregyhaza spartacus fc': Object.freeze({ short: 'NYÍR', primary: '#c61f30', secondary: '#254f9a' }),
    'paksi fc': Object.freeze({ short: 'PAKS', primary: '#23864a', secondary: '#ffffff' }),
    'puskas akademia fc': Object.freeze({ short: 'PAFC', primary: '#1f66ad', secondary: '#f0c640' }),
    'ujpest fc': Object.freeze({ short: 'UTE', primary: '#6d3a93', secondary: '#ffffff' }),
    'zte fc': Object.freeze({ short: 'ZTE', primary: '#185ea9', secondary: '#ffffff' }),
  });

  /**
   * Kanonikus NB I-klubjelek. A bal oldali értékek a korábbi felületi rövidítések,
   * a jobb oldali értékek a pajzsokon és minden generált klubemblémán megjelenő jelek.
   */
  const TEAM_LOGO_SHORT_LABELS = Object.freeze({
    DV: 'DVSC',
    DVSC: 'DVSC',
    DI: 'DVTK',
    DVTK: 'DVTK',
    ETO: 'ETO',
    FTC: 'FTC',
    KIS: 'KISV',
    KISV: 'KISV',
    KB: 'KBSC',
    KBSC: 'KBSC',
    MTK: 'MTK',
    NY: 'NYÍR',
    'NYÍR': 'NYÍR',
    PFC: 'PAKS',
    PAKS: 'PAKS',
    PA: 'PAFC',
    PUSK: 'PAFC',
    PAFC: 'PAFC',
    UTE: 'UTE',
    ZTE: 'ZTE',
  });

  const resolveClubPresentation = value => {
    const label = typeof value === 'object' ? value?.label ?? value?.name ?? value?.value : value;
    const key = foldClubLabel(label);
    const known = TEAM_CLUB_PRESENTATIONS[key];
    if (known) return known;
    const candidate = String(label ?? '').trim().toLocaleUpperCase('hu-HU');
    const short = TEAM_LOGO_SHORT_LABELS[candidate]
      ?? clubInitials(label).slice(0, 4)
      ?? candidate.slice(0, 4)
      ?? 'FC';
    return Object.freeze({ short: short || 'FC', primary: '#6d4d2f', secondary: '#d5b45d' });
  };

  const teamLogoShortLabel = value => {
    const candidate = String(value ?? '').trim().toLocaleUpperCase('hu-HU');
    if (!candidate) return 'FC';
    const direct = TEAM_LOGO_SHORT_LABELS[candidate];
    if (direct) return direct;
    const presentation = TEAM_CLUB_PRESENTATIONS[foldClubLabel(value)];
    return presentation?.short ?? candidate.slice(0, 4);
  };

  const teamLogoColour = (value, fallback) => {
    const colour = String(value ?? '').trim();
    return /^#[0-9a-f]{3,8}$/iu.test(colour) ? colour : fallback;
  };

  const teamLogoSvgElement = (documentRef, name, attributes = {}) => {
    const node = documentRef.createElementNS(SVG_NAMESPACE, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    return node;
  };

  /**
   * Jogtiszta, generált klubembléma: kizárólag a játék saját színpalettáját és
   * rövid klubjelét használja, hivatalos címerből vagy külső képből nem vesz át elemet.
   */
  const createGeneratedClubLogo = (documentRef, mark) => {
    const sourceLabel = mark?.dataset?.teamLabel || mark.textContent;
    const presentation = resolveClubPresentation(sourceLabel);
    const shortLabel = presentation.short || teamLogoShortLabel(mark.textContent);
    const computed = typeof globalThis.getComputedStyle === 'function'
      ? globalThis.getComputedStyle(mark)
      : null;
    const primary = teamLogoColour(
      computed?.getPropertyValue('--team-primary'),
      presentation.primary,
    );
    const secondary = teamLogoColour(
      computed?.getPropertyValue('--team-secondary'),
      presentation.secondary,
    );
    const fontSize = shortLabel.length > 3 ? 27 : shortLabel.length > 2 ? 31 : 38;

    const svg = teamLogoSvgElement(documentRef, 'svg', {
      class: 'quick-team-mark__image',
      viewBox: '0 0 160 160',
      width: '160',
      height: '160',
      focusable: 'false',
      'aria-hidden': 'true',
      'data-club-short-label': shortLabel,
    });
    const shield = teamLogoSvgElement(documentRef, 'path', {
      d: 'M80 6 145 30v50c0 38-24 64-65 76C39 144 15 118 15 80V30z',
      fill: primary,
      stroke: secondary,
      'stroke-width': '8',
      'stroke-linejoin': 'round',
    });
    const band = teamLogoSvgElement(documentRef, 'path', {
      d: 'M29 55h102v24H29z',
      fill: secondary,
      opacity: '.96',
    });
    const ballRing = teamLogoSvgElement(documentRef, 'circle', {
      cx: '80',
      cy: '105',
      r: '25',
      fill: 'none',
      stroke: secondary,
      'stroke-width': '5',
      opacity: '.9',
    });
    const centre = teamLogoSvgElement(documentRef, 'circle', {
      cx: '80',
      cy: '105',
      r: '7',
      fill: secondary,
    });
    const label = teamLogoSvgElement(documentRef, 'text', {
      x: '80',
      y: '73',
      fill: primary,
      'font-family': 'Arial, Helvetica, sans-serif',
      'font-size': fontSize,
      'font-weight': '900',
      'letter-spacing': '-1',
      'text-anchor': 'middle',
    });
    label.textContent = shortLabel;
    svg.append(shield, band, ballRing, centre, label);
    return svg;
  };

  const restoreClubLogo = (mark, documentRef) => {
    if (!mark?.matches?.(TEAM_LOGO_SELECTOR)) return false;
    const svg = createGeneratedClubLogo(documentRef, mark);
    mark.replaceChildren(svg);
    mark.classList.remove('quick-team-mark--text');
    mark.classList.add('quick-team-mark--club');
    mark.dataset.generatedClubLogo = 'true';
    mark.dataset.clubShortLabel = svg.getAttribute('data-club-short-label') ?? '';
    return true;
  };

  const restoreClubLogosWithin = (root, documentRef) => {
    if (!root) return 0;
    let restored = 0;
    if (root.matches?.(TEAM_LOGO_SELECTOR) && restoreClubLogo(root, documentRef)) restored += 1;
    root.querySelectorAll?.(TEAM_LOGO_SELECTOR).forEach(mark => {
      if (restoreClubLogo(mark, documentRef)) restored += 1;
    });
    return restored;
  };

  const installTeamLogoRestoration = () => {
    if (typeof document === 'undefined' || globalThis[TEAM_LOGO_RESTORATION_KEY]) return;

    const start = () => {
      if (globalThis[TEAM_LOGO_RESTORATION_KEY]) return;
      restoreClubLogosWithin(document, document);
      const observer = typeof globalThis.MutationObserver === 'function'
        ? new globalThis.MutationObserver(records => {
          for (const record of records) {
            record.addedNodes?.forEach(node => restoreClubLogosWithin(node, document));
          }
        })
        : null;
      observer?.observe(document.documentElement ?? document.body, { childList: true, subtree: true });
      globalThis[TEAM_LOGO_RESTORATION_KEY] = Object.freeze({
        refresh: () => restoreClubLogosWithin(document, document),
        disconnect: () => observer?.disconnect(),
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  };

  globalThis.__FOCISKARTYAK_BRANDING__ = Object.freeze({
    config: brandingConfig,
    canonicalPath: assetService.canonicalPath,
    isRemoteAssetUrl,
    isApprovedReleaseAsset,
    isProtectedUnapprovedArt,
    clubShortLabels: TEAM_LOGO_SHORT_LABELS,
    clubPresentations: TEAM_CLUB_PRESENTATIONS,
    resolveClubShortLabel: teamLogoShortLabel,
    resolveClubPresentation,
  });

  installImageRequestGuard();
  installTeamLogoRestoration();
})();
