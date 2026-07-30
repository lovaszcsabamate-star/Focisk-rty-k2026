/** Central Hungarian–English localization service for the complete application UI. */

const SUPPORTED_LANGUAGES = Object.freeze(['hu', 'en']);
const DEFAULT_LANGUAGE = 'hu';
const LANGUAGE_STORAGE_KEY = 'fociskartyak:language:v1';
const LANGUAGE_CHANGE_EVENT = 'fociskartyak:languagechange';
const TRANSLATABLE_ATTRIBUTES = Object.freeze([
  'aria-label',
  'aria-description',
  'title',
  'placeholder',
  'alt',
]);

const BUILTIN_FALLBACKS = Object.freeze({
  hu: {
    meta: { languageCode: 'hu-HU', name: 'Magyar' },
    language: {
      label: 'Nyelv',
      description: 'Az alkalmazás megjelenítési nyelve',
      hungarian: 'Magyar',
      english: 'English',
    },
    common: { back: 'Vissza', done: 'Kész', retry: 'Újrapróbálás', unknown: 'Nincs adat' },
    automatic: {},
  },
  en: {
    meta: { languageCode: 'en-GB', name: 'English' },
    language: {
      label: 'Language',
      description: 'Application display language',
      hungarian: 'Magyar',
      english: 'English',
    },
    common: { back: 'Back', done: 'Done', retry: 'Try Again', unknown: 'No data' },
    automatic: {},
  },
});

let catalogues = {
  hu: BUILTIN_FALLBACKS.hu,
  en: BUILTIN_FALLBACKS.en,
};
let activeLanguage = DEFAULT_LANGUAGE;
let observer = null;
let translating = false;
let initialized = false;

const originalText = new WeakMap();
const originalAttributes = new WeakMap();
const warnedKeys = new Set();

const isDevelopment = () => {
  const host = globalThis.location?.hostname ?? '';
  return host === 'localhost'
    || host === '127.0.0.1'
    || host.endsWith('.local')
    || new URLSearchParams(globalThis.location?.search ?? '').has('i18nDebug');
};

const normaliseLanguage = value => {
  const language = String(value ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGUAGES.includes(language) ? language : null;
};

const readStoredLanguage = () => {
  try {
    return normaliseLanguage(globalThis.localStorage?.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return null;
  }
};

const detectDeviceLanguage = () => {
  const candidates = [
    ...(Array.isArray(globalThis.navigator?.languages) ? globalThis.navigator.languages : []),
    globalThis.navigator?.language,
  ].filter(Boolean);
  const first = normaliseLanguage(candidates[0]);
  return first === 'hu' ? 'hu' : 'en';
};

const resolveInitialLanguage = () => readStoredLanguage() ?? detectDeviceLanguage() ?? DEFAULT_LANGUAGE;
const catalogueUrl = language => new URL(`../locales/${language}.json`, import.meta.url);

async function loadCatalogue(language) {
  try {
    const response = await fetch(catalogueUrl(language), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = await response.json();
    if (!parsed || typeof parsed !== 'object') throw new TypeError('Invalid catalogue payload');
    return parsed;
  } catch (error) {
    console.warn(`[i18n] A(z) ${language} nyelvi fájl nem tölthető be; beépített tartalék használata.`, error);
    return BUILTIN_FALLBACKS[language];
  }
}

const readPath = (source, path) => String(path ?? '')
  .split('.')
  .filter(Boolean)
  .reduce((value, segment) => value?.[segment], source);

const interpolate = (template, params = {}) => String(template ?? '').replace(/\{([^{}]+)\}/g, (match, key) => (
  Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
));

export function t(key, params = {}, language = activeLanguage) {
  const requested = normaliseLanguage(language) ?? DEFAULT_LANGUAGE;
  const translated = readPath(catalogues[requested], key);
  const fallback = readPath(catalogues.hu, key);
  const value = typeof translated === 'string' ? translated : fallback;

  if (typeof value !== 'string') {
    if (isDevelopment() && !warnedKeys.has(key)) {
      warnedKeys.add(key);
      console.warn(`[i18n] Hiányzó fordítási kulcs: ${key}`);
    }
    return String(key);
  }

  if (isDevelopment() && requested !== 'hu' && typeof translated !== 'string' && !warnedKeys.has(key)) {
    warnedKeys.add(key);
    console.warn(`[i18n] Hiányzó ${requested} fordítás, magyar tartalék használata: ${key}`);
  }
  return interpolate(value, params);
}

export const getLanguage = () => activeLanguage;
export const getLocale = () => readPath(catalogues[activeLanguage], 'meta.languageCode')
  ?? (activeLanguage === 'en' ? 'en-GB' : 'hu-HU');

export function formatNumber(value, options = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return t('common.unknown');
  return new Intl.NumberFormat(getLocale(), options).format(numeric);
}

export function formatCurrency(value, currency = 'EUR', options = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return t('common.unknown');
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency,
    maximumFractionDigits: numeric >= 1_000_000 ? 1 : 0,
    ...options,
  }).format(numeric);
}

export function formatDate(value, options = {}) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return t('common.unknown');
  return new Intl.DateTimeFormat(getLocale(), options).format(date);
}

export function formatUnit(value, unit, options = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return t('common.unknown');
  try {
    return new Intl.NumberFormat(getLocale(), { style: 'unit', unit, ...options }).format(numeric);
  } catch {
    return `${formatNumber(numeric, options)} ${unit}`;
  }
}

const exactDictionary = language => catalogues[language]?.automatic ?? {};

const preserveCase = (source, translated) => {
  const letters = source.replace(/[^\p{L}]/gu, '');
  if (letters && letters === letters.toLocaleUpperCase('hu-HU')) {
    return translated.toLocaleUpperCase(getLocale());
  }
  return translated;
};

const exactTranslation = source => {
  if (activeLanguage === 'hu') return source;
  const dictionary = exactDictionary(activeLanguage);
  if (Object.prototype.hasOwnProperty.call(dictionary, source)) return dictionary[source];

  const sourceLower = source.toLocaleLowerCase('hu-HU');
  const match = Object.entries(dictionary).find(([key]) => key.toLocaleLowerCase('hu-HU') === sourceLower);
  if (match) return preserveCase(source, match[1]);

  const prefixed = source.match(/^([^\p{L}\p{N}]*)([\s\S]+)$/u);
  if (prefixed?.[1] && prefixed[2]) {
    const core = exactTranslation(prefixed[2]);
    if (core !== prefixed[2]) return `${prefixed[1]}${core}`;
  }
  return source;
};

const parseHungarianNumber = token => {
  const compact = String(token ?? '').replace(/[\s\u00a0\u202f]/g, '');
  if (!compact) return null;
  const comma = compact.lastIndexOf(',');
  const dot = compact.lastIndexOf('.');
  let normalized = compact;
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? ',' : '.';
    normalized = compact
      .replace(decimal === ',' ? /\./g : /,/g, '')
      .replace(decimal, '.');
  } else if (comma >= 0) {
    normalized = compact.replace(',', '.');
  } else if ((compact.match(/\./g) ?? []).length > 1) {
    normalized = compact.replace(/\./g, '');
  }
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
};

const localiseNumericToken = token => {
  const number = parseHungarianNumber(token);
  return number == null ? token : formatNumber(number, { maximumFractionDigits: 2 });
};

const translateEmbeddedSegments = source => {
  const separators = /(\s*[·:|–—]\s*)/u;
  const parts = source.split(separators);
  if (parts.length <= 1) return source;
  let changed = false;
  const translated = parts.map((part, index) => {
    if (index % 2 === 1) return part;
    const trimmed = part.trim();
    if (!trimmed) return part;
    const next = exactTranslation(trimmed);
    if (next === trimmed) return part;
    changed = true;
    return part.replace(trimmed, next);
  });
  return changed ? translated.join('') : source;
};

const translateDynamicText = source => {
  if (activeLanguage === 'hu') return source;
  const exact = exactTranslation(source);
  if (exact !== source) return exact;

  let match = source.match(/^(\d+)\. kör$/u);
  if (match) return t('templates.roundNumber', { round: match[1] });
  match = source.match(/^(\d+)\. párbaj$/u);
  if (match) return t('templates.duelNumber', { round: match[1] });
  match = source.match(/^(\d+(?:[\s.,]\d+)*) lap$/u);
  if (match) return t('templates.cardsCount', { count: localiseNumericToken(match[1]) });
  match = source.match(/^(\d+(?:[\s.,]\d+)*) kártya$/u);
  if (match) return `${localiseNumericToken(match[1])} cards`;
  match = source.match(/^(\d+(?:[\s.,]\d+)*) játékoskártya$/u);
  if (match) return `${localiseNumericToken(match[1])} player cards`;
  match = source.match(/^Legalább (\d+) kártya szükséges$/u);
  if (match) return `At least ${match[1]} cards required`;
  match = source.match(/^(\d+(?:[\s.,]\d+)*) gól$/u);
  if (match) return t('templates.goalsCount', { count: localiseNumericToken(match[1]) });
  match = source.match(/^(\d+(?:[\s.,]\d+)*) év$/u);
  if (match) return t('templates.ageYears', { value: localiseNumericToken(match[1]) });
  match = source.match(/^(\d+(?:[\s.,]\d+)*) perc$/u);
  if (match) return t('templates.minutesValue', { value: localiseNumericToken(match[1]) });
  match = source.match(/^([\d\s.,\u00a0\u202f]+)\s*cm$/u);
  if (match) {
    const number = parseHungarianNumber(match[1]);
    if (number != null) return formatUnit(number, 'centimeter', { maximumFractionDigits: 2 });
  }
  match = source.match(/^([\d\s.,\u00a0\u202f]+)\s*%$/u);
  if (match) {
    const number = parseHungarianNumber(match[1]);
    if (number != null) return `${formatNumber(number, { maximumFractionDigits: 2 })}%`;
  }
  match = source.match(/^([\d\s.,\u00a0\u202f]+)\s*€$/u);
  if (match) {
    const number = parseHungarianNumber(match[1]);
    if (number != null) return formatCurrency(number, 'EUR');
  }
  match = source.match(/^JÁTÉKOS\s+(.+?)–(.+?)\s+GÉP$/u);
  if (match) return t('templates.playerVsComputer', { human: match[1], ai: match[2] });
  match = source.match(/^(\d+) lap a döntetlenpakliban maradt\.$/u);
  if (match) return t('templates.cardsInDrawPile', { count: localiseNumericToken(match[1]) });
  match = source.match(/^mentve:\s*(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{1,2}):(\d{2})$/u);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
    return `saved: ${formatDate(date, { dateStyle: 'medium', timeStyle: 'short' })}`;
  }

  return translateEmbeddedSegments(source);
};

const renderOriginal = original => {
  const leading = original.match(/^\s*/u)?.[0] ?? '';
  const trailing = original.match(/\s*$/u)?.[0] ?? '';
  const end = trailing.length ? original.length - trailing.length : original.length;
  const core = original.slice(leading.length, end);
  if (!core) return original;
  const translated = activeLanguage === 'hu' ? core : translateDynamicText(core);
  return `${leading}${translated}${trailing}`;
};

const shouldIgnoreTextNode = node => {
  const parent = node.parentElement;
  return !parent || ['SCRIPT', 'STYLE', 'TEMPLATE'].includes(parent.tagName) || parent.closest('[data-i18n-ignore]');
};

const localiseTextNode = node => {
  if (shouldIgnoreTextNode(node)) return;
  const current = node.nodeValue ?? '';
  const stored = originalText.get(node);
  if (stored == null || current !== renderOriginal(stored)) originalText.set(node, current);
  const source = originalText.get(node) ?? current;
  const rendered = renderOriginal(source);
  if (current !== rendered) node.nodeValue = rendered;
};

const attributeMapFor = element => {
  let map = originalAttributes.get(element);
  if (!map) {
    map = new Map();
    originalAttributes.set(element, map);
  }
  return map;
};

const localiseAttribute = (element, attribute) => {
  if (!element.hasAttribute(attribute) || element.closest('[data-i18n-ignore]')) return;
  const current = element.getAttribute(attribute) ?? '';
  const originals = attributeMapFor(element);
  const stored = originals.get(attribute);
  if (stored == null || current !== renderOriginal(stored)) originals.set(attribute, current);
  const rendered = renderOriginal(originals.get(attribute) ?? current);
  if (current !== rendered) element.setAttribute(attribute, rendered);
};

const applyExplicitKeys = root => {
  const elements = [];
  if (root instanceof Element && root.matches('[data-i18n]')) elements.push(root);
  if (root.querySelectorAll) elements.push(...root.querySelectorAll('[data-i18n]'));
  for (const element of elements) {
    const key = element.dataset.i18n;
    if (key) element.textContent = t(key);
  }
};

const createLanguageControl = () => {
  const row = document.createElement('label');
  row.className = 'setting-switch setting-switch--language';
  row.dataset.i18nLanguageControl = 'true';
  row.dataset.i18nIgnore = 'true';

  const copy = document.createElement('span');
  copy.className = 'setting-switch__copy';
  copy.append(document.createElement('strong'), document.createElement('small'));

  const select = document.createElement('select');
  select.className = 'language-select';
  select.id = 'language-select';
  select.addEventListener('change', event => setLanguage(event.currentTarget.value));

  row.append(copy, select);
  return row;
};

function refreshLanguageControl(control) {
  const strong = control.querySelector('strong');
  const small = control.querySelector('small');
  const select = control.querySelector('select');
  if (strong) strong.textContent = `🌐 ${t('language.label')}`;
  if (small) small.textContent = t('language.description');
  if (select) {
    select.setAttribute('aria-label', t('language.label'));
    select.replaceChildren(
      Object.assign(document.createElement('option'), { value: 'hu', textContent: t('language.hungarian') }),
      Object.assign(document.createElement('option'), { value: 'en', textContent: t('language.english') }),
    );
    select.value = activeLanguage;
  }
}

function installLanguageControl() {
  const list = document.querySelector('.settings-panel .settings-list');
  if (!list) return;
  let control = list.querySelector('[data-i18n-language-control]');
  if (!control) {
    control = createLanguageControl();
    list.prepend(control);
  }
  refreshLanguageControl(control);
}

export function localiseRoot(root = document) {
  if (!root || translating) return;
  translating = true;
  try {
    installLanguageControl();
    applyExplicitKeys(root);
    if (root.nodeType === Node.TEXT_NODE) localiseTextNode(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) localiseTextNode(walker.currentNode);

    const elements = [];
    if (root instanceof Element) elements.push(root);
    if (root.querySelectorAll) elements.push(...root.querySelectorAll('*'));
    for (const element of elements) {
      for (const attribute of TRANSLATABLE_ATTRIBUTES) localiseAttribute(element, attribute);
    }
  } finally {
    translating = false;
  }
}

const updateDocumentMetadata = () => {
  document.documentElement.lang = activeLanguage;
  document.documentElement.dataset.language = activeLanguage;
  const description = document.querySelector('meta[name="description"]');
  const translatedDescription = readPath(catalogues[activeLanguage], 'meta.appDescription');
  if (description && translatedDescription) description.setAttribute('content', translatedDescription);
};

const installObserver = () => {
  observer?.disconnect();
  observer = new MutationObserver(mutations => {
    if (translating) return;
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') localiseRoot(mutation.target);
      if (mutation.type === 'attributes') localiseRoot(mutation.target);
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) localiseRoot(node);
      }
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: TRANSLATABLE_ATTRIBUTES,
  });
};

export async function setLanguage(language, { persist = true, announce = true } = {}) {
  const next = normaliseLanguage(language) ?? DEFAULT_LANGUAGE;
  activeLanguage = next;
  if (persist) {
    try {
      globalThis.localStorage?.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable in privacy-restricted browser contexts.
    }
  }
  updateDocumentMetadata();
  localiseRoot(document);
  if (announce) {
    globalThis.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT, {
      detail: { language: next, locale: getLocale() },
    }));
  }
  return next;
}

export async function initializeI18n() {
  if (initialized) return activeLanguage;
  const [hungarian, english] = await Promise.all([
    loadCatalogue('hu'),
    loadCatalogue('en'),
  ]);
  catalogues = { hu: hungarian, en: english };
  activeLanguage = resolveInitialLanguage();
  initialized = true;
  updateDocumentMetadata();
  localiseRoot(document);
  installObserver();
  return activeLanguage;
}

export const onLanguageChange = listener => {
  if (typeof listener !== 'function') return () => {};
  const handler = event => listener(event.detail);
  globalThis.addEventListener(LANGUAGE_CHANGE_EVENT, handler);
  return () => globalThis.removeEventListener(LANGUAGE_CHANGE_EVENT, handler);
};

export const I18N = Object.freeze({
  supportedLanguages: SUPPORTED_LANGUAGES,
  defaultLanguage: DEFAULT_LANGUAGE,
  storageKey: LANGUAGE_STORAGE_KEY,
  eventName: LANGUAGE_CHANGE_EVENT,
});
