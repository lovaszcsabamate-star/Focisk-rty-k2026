/**
 * Központi összehasonlításikategória-regiszter.
 *
 * A kategóriák kanonikus szerződése:
 * id, nameHu, shortNameHu, value, direction, formatValue, requiredFields,
 * minimumMinutes, group és enabled. A régi UI- és motor API-khoz szükséges
 * mezőnevek kompatibilitási aliasként továbbra is elérhetők.
 */

export const CATEGORY_SCHEMA_VERSION = 1;
export const CATEGORY_RATE_MINUTES = 90;
export const CATEGORY_MINIMUM_COVERAGE = 0.10;

export const CATEGORY_DIRECTIONS = Object.freeze({
  HIGHER: 'higher',
  LOWER: 'lower',
  LATER: 'later',
  EARLIER: 'earlier',
});

export const CATEGORY_GROUPS = Object.freeze({
  BASIC: 'Alapadatok',
  APPEARANCE: 'Pályára lépés',
  ATTACK: 'Támadás',
  DISCIPLINE: 'Fegyelem',
});

const VALID_DIRECTIONS = new Set(Object.values(CATEGORY_DIRECTIONS));
const finiteNumber = value => typeof value === 'number' && Number.isFinite(value);

const defineCategory = config => {
  if (!config?.id || typeof config.id !== 'string') throw new TypeError('A kategória id mezője kötelező.');
  if (!config.nameHu || !config.shortNameHu) throw new TypeError(`Hiányzó magyar kategórianév: ${config.id}`);
  if (!VALID_DIRECTIONS.has(config.direction)) throw new TypeError(`Érvénytelen kategóriairány: ${config.id}`);
  if (typeof config.value !== 'function' || typeof config.formatValue !== 'function') {
    throw new TypeError(`A kategória value és formatValue mezője függvény kell legyen: ${config.id}`);
  }

  const enabled = Boolean(config.enabled);
  const cardField = config.cardField ?? config.id;
  const requiredFields = Object.freeze([...(config.requiredFields ?? [])]);

  return {
    schemaVersion: CATEGORY_SCHEMA_VERSION,
    id: config.id,
    nameHu: config.nameHu,
    shortNameHu: config.shortNameHu,
    cardNameHu: config.cardNameHu ?? config.shortNameHu,
    icon: config.icon ?? '',
    group: config.group,
    direction: config.direction,
    hintHu: config.hintHu ?? '',
    value: config.value,
    formatValue: config.formatValue,
    requiredFields,
    minimumMinutes: config.minimumMinutes ?? null,
    enabled,
    status: enabled ? 'enabled' : 'disabled',
    optional: config.optional ?? true,
    precision: config.precision ?? null,
    cardField,
    knownValues: 0,
    coverage: 0,
    higherWins: [CATEGORY_DIRECTIONS.HIGHER, CATEGORY_DIRECTIONS.LATER].includes(config.direction),

    // Kompatibilitási aliasok a meglévő játékmotorhoz és UI-hoz.
    key: config.id,
    label: config.nameHu,
    shortLabel: config.shortNameHu,
    cardLabel: config.cardNameHu ?? config.shortNameHu,
    hint: config.hintHu ?? '',
    getValue: config.value,
    format: config.formatValue,
    cardStatKey: cardField,
    enabledByDefault: enabled,
  };
};

export function validateCategoryDefinitions(definitions) {
  const problems = [];
  const ids = new Set();

  for (const [index, category] of (definitions ?? []).entries()) {
    if (!category?.id) problems.push(`category ${index}: missing id`);
    if (ids.has(category?.id)) problems.push(`duplicate category id: ${category.id}`);
    ids.add(category?.id);
    if (!category?.nameHu || !category?.shortNameHu) problems.push(`${category?.id ?? index}: missing Hungarian name`);
    if (!VALID_DIRECTIONS.has(category?.direction)) problems.push(`${category?.id ?? index}: invalid direction`);
    if (typeof category?.value !== 'function') problems.push(`${category?.id ?? index}: missing value function`);
    if (typeof category?.formatValue !== 'function') problems.push(`${category?.id ?? index}: missing formatValue function`);
    if (!Array.isArray(category?.requiredFields)) problems.push(`${category?.id ?? index}: requiredFields is not an array`);
    if (category?.minimumMinutes != null && (!finiteNumber(category.minimumMinutes) || category.minimumMinutes < 0)) {
      problems.push(`${category?.id ?? index}: invalid minimumMinutes`);
    }
  }

  return problems;
}

/**
 * A regiszter gyára a játékosnormalizáló függvényeket explicit függőségként kapja,
 * így a kategóriakonfiguráció nem hoz létre körkörös modulimportot.
 */
export function createCategoryRegistry({ normaliseNumber, parseBirthDate, calculateAge } = {}) {
  if (![normaliseNumber, parseBirthDate, calculateAge].every(value => typeof value === 'function')) {
    throw new TypeError('A kategóriaregiszterhez normaliseNumber, parseBirthDate és calculateAge szükséges.');
  }

  const integer = value => `${Math.round(value)}`;
  const decimal = value => value.toLocaleString('hu-HU', { maximumFractionDigits: 2 });
  const percent = value => `${decimal(value)}%`;
  const minutes = value => `${Math.round(value)} perc`;
  const centimetres = value => `${decimal(value)} cm`;
  const money = value => new Intl.NumberFormat('hu-HU', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);

  const statValue = key => card => normaliseNumber(card?.stats?.[key]);
  const exactBirthDate = card => parseBirthDate(card?.birthDate);
  const safeRatio = (numerator, denominator, multiplier = 1) => {
    if (!finiteNumber(numerator) || !finiteNumber(denominator) || denominator <= 0) return null;
    const result = numerator / denominator * multiplier;
    return Number.isFinite(result) ? result : null;
  };
  const ratePer90 = (card, numeratorKey) => {
    const numerator = normaliseNumber(card?.stats?.[numeratorKey]);
    const playedMinutes = normaliseNumber(card?.stats?.minutes);
    if (playedMinutes == null || playedMinutes < CATEGORY_RATE_MINUTES) return null;
    return safeRatio(numerator, playedMinutes, 90);
  };
  const goalContributions = card => {
    const goals = normaliseNumber(card?.stats?.goals);
    const assists = normaliseNumber(card?.stats?.assists);
    return goals == null || assists == null ? null : goals + assists;
  };
  const disciplinaryEvents = card => {
    const yellows = normaliseNumber(card?.stats?.yellowCards);
    const dismissals = normaliseNumber(card?.stats?.totalDismissals);
    return yellows == null || dismissals == null ? null : yellows + dismissals;
  };

  const definitions = [
    defineCategory({
      id: 'birthDate', nameHu: 'Fiatalabb játékos', shortNameHu: 'Fiatalabb', cardNameHu: 'Életkor',
      icon: '🎂', group: CATEGORY_GROUPS.BASIC, direction: CATEGORY_DIRECTIONS.LATER, hintHu: 'A fiatalabb nyer',
      value: exactBirthDate, formatValue: (value, card) => `${calculateAge(card.birthDate)} év`,
      requiredFields: ['birthDate'], enabled: true,
    }),
    defineCategory({
      id: 'birthDateOlder', nameHu: 'Idősebb játékos', shortNameHu: 'Idősebb', cardNameHu: 'Életkor',
      icon: '🕰️', group: CATEGORY_GROUPS.BASIC, direction: CATEGORY_DIRECTIONS.EARLIER, hintHu: 'Az idősebb nyer',
      value: exactBirthDate, formatValue: (value, card) => `${calculateAge(card.birthDate)} év`,
      requiredFields: ['birthDate'], cardField: 'birthDate', enabled: true,
    }),
    defineCategory({
      id: 'heightCm', nameHu: 'Magasabb játékos', shortNameHu: 'Magasabb', cardNameHu: 'Magasság',
      icon: '📏', group: CATEGORY_GROUPS.BASIC, direction: CATEGORY_DIRECTIONS.HIGHER, hintHu: 'A magasabb nyer',
      value: statValue('heightCm'), formatValue: centimetres, requiredFields: ['stats.heightCm'],
    }),
    defineCategory({
      id: 'heightCmLower', nameHu: 'Alacsonyabb játékos', shortNameHu: 'Alacsonyabb', cardNameHu: 'Magasság',
      icon: '📐', group: CATEGORY_GROUPS.BASIC, direction: CATEGORY_DIRECTIONS.LOWER, hintHu: 'Az alacsonyabb nyer',
      value: statValue('heightCm'), formatValue: centimetres, requiredFields: ['stats.heightCm'], cardField: 'heightCm',
    }),
    defineCategory({
      id: 'marketValue', nameHu: 'Magasabb piaci érték', shortNameHu: 'Nagyobb érték', cardNameHu: 'Piaci érték',
      icon: '💶', group: CATEGORY_GROUPS.BASIC, direction: CATEGORY_DIRECTIONS.HIGHER, hintHu: 'A nagyobb érték nyer',
      value: statValue('marketValue'), formatValue: money, requiredFields: ['stats.marketValue'],
    }),
    defineCategory({
      id: 'marketValueLower', nameHu: 'Alacsonyabb piaci érték', shortNameHu: 'Kisebb érték', cardNameHu: 'Piaci érték',
      icon: '🪙', group: CATEGORY_GROUPS.BASIC, direction: CATEGORY_DIRECTIONS.LOWER, hintHu: 'A kisebb érték nyer',
      value: statValue('marketValue'), formatValue: money, requiredFields: ['stats.marketValue'], cardField: 'marketValue',
    }),
    defineCategory({
      id: 'appearances', nameHu: 'Több mérkőzés', shortNameHu: 'Mérkőzések', cardNameHu: 'Mérkőzések',
      icon: '👕', group: CATEGORY_GROUPS.APPEARANCE, direction: CATEGORY_DIRECTIONS.HIGHER, hintHu: 'A több nyer',
      value: statValue('appearances'), formatValue: integer, requiredFields: ['stats.appearances'], enabled: true,
    }),
    defineCategory({
      id: 'starts', nameHu: 'Több kezdés', shortNameHu: 'Kezdések', cardNameHu: 'Kezdőként',
      icon: '▶', group: CATEGORY_GROUPS.APPEARANCE, direction: CATEGORY_DIRECTIONS.HIGHER, hintHu: 'A több nyer',
      value: statValue('starts'), formatValue: integer, requiredFields: ['stats.starts'], enabled: true,
    }),
    defineCategory({
      id: 'minutes', nameHu: 'Több játékperc', shortNameHu: 'Játékpercek', cardNameHu: 'Játékperc',
      icon: '⏱️', group: CATEGORY_GROUPS.APPEARANCE, direction: CATEGORY_DIRECTIONS.HIGHER, hintHu: 'A több nyer',
      value: statValue('minutes'), formatValue: minutes, requiredFields: ['stats.minutes'],
    }),
    defineCategory({
      id: 'minutesPerAppearance', nameHu: 'Több játékperc mérkőzésenként', shortNameHu: 'Perc/meccs', cardNameHu: 'Perc/meccs',
      icon: '⌛', group: CATEGORY_GROUPS.APPEARANCE, direction: CATEGORY_DIRECTIONS.HIGHER, hintHu: 'A több nyer',
      value: card => safeRatio(normaliseNumber(card?.stats?.minutes), normaliseNumber(card?.stats?.appearances)),
      formatValue: value => `${decimal(value)} perc`, requiredFields: ['stats.minutes', 'stats.appearances'], precision: 2,
    }),
    defineCategory({
      id: 'startRate', nameHu: 'Magasabb kezdési arány', shortNameHu: 'Kezdési arány', cardNameHu: 'Kezdési arány',
      icon: '📊', group: CATEGORY_GROUPS.APPEARANCE, direction: CATEGORY_DIRECTIONS.HIGHER, hintHu: 'A magasabb arány nyer',
      value: card => {
        const starts = normaliseNumber(card?.stats?.starts);
        const appearances = normaliseNumber(card?.stats?.appearances);
        if (starts == null || appearances == null || starts < 0 || appearances <= 0 || starts > appearances) return null;
        return safeRatio(starts, appearances, 100);
      },
      formatValue: percent, requiredFields: ['stats.starts', 'stats.appearances'], precision: 2, enabled: true,
    }),
    defineCategory({
      id: 'goals', nameHu: 'Több gól', shortNameHu: 'Gólok', cardNameHu: 'Gólok',
      icon: '⚽', group: CATEGORY_GROUPS.ATTACK, direction: CATEGORY_DIRECTIONS.HIGHER, hintHu: 'A több nyer',
      value: statValue('goals'), formatValue: integer, requiredFields: ['stats.goals'], enabled: true, optional: false,
    }),
    defineCategory({
      id: 'assists', nameHu: 'Több gólpassz', shortNameHu: 'Gólpasszok', cardNameHu: 'Gólpasszok',
      icon: '🅰️', group: CATEGORY_GROUPS.ATTACK, direction: CATEGORY_DIRECTIONS.HIGHER, hintHu: 'A több nyer',
      value: statValue('assists'), formatValue: integer, requiredFields: ['stats.assists'],
    }),
    defineCategory({
      id: 'goalContributions', nameHu: 'Több kanadai pont', shortNameHu: 'Kanadai pont', cardNameHu: 'Kanadai pont',
      icon: '➕', group: CATEGORY_GROUPS.ATTACK, direction: CATEGORY_DIRECTIONS.HIGHER, hintHu: 'A több nyer',
      value: goalContributions, formatValue: integer, requiredFields: ['stats.goals', 'stats.assists'],
    }),
    defineCategory({
      id: 'goalsPer90', nameHu: 'Több gól 90 percenként', shortNameHu: 'Gól/90', cardNameHu: 'Gól/90',
      icon: '🎯', group: CATEGORY_GROUPS.ATTACK, direction: CATEGORY_DIRECTIONS.HIGHER, hintHu: 'A több nyer',
      value: card => ratePer90(card, 'goals'), formatValue: decimal,
      requiredFields: ['stats.goals', 'stats.minutes'], minimumMinutes: CATEGORY_RATE_MINUTES, precision: 2,
    }),
    defineCategory({
      id: 'assistsPer90', nameHu: 'Több gólpassz 90 percenként', shortNameHu: 'Gólpassz/90', cardNameHu: 'Gólpassz/90',
      icon: '🧠', group: CATEGORY_GROUPS.ATTACK, direction: CATEGORY_DIRECTIONS.HIGHER, hintHu: 'A több nyer',
      value: card => ratePer90(card, 'assists'), formatValue: decimal,
      requiredFields: ['stats.assists', 'stats.minutes'], minimumMinutes: CATEGORY_RATE_MINUTES, precision: 2,
    }),
    defineCategory({
      id: 'goalContributionsPer90', nameHu: 'Több kanadai pont 90 percenként', shortNameHu: 'Pont/90', cardNameHu: 'Pont/90',
      icon: '🚀', group: CATEGORY_GROUPS.ATTACK, direction: CATEGORY_DIRECTIONS.HIGHER, hintHu: 'A több nyer',
      value: card => {
        const contributions = goalContributions(card);
        const playedMinutes = normaliseNumber(card?.stats?.minutes);
        if (playedMinutes == null || playedMinutes < CATEGORY_RATE_MINUTES) return null;
        return safeRatio(contributions, playedMinutes, 90);
      },
      formatValue: decimal, requiredFields: ['stats.goals', 'stats.assists', 'stats.minutes'],
      minimumMinutes: CATEGORY_RATE_MINUTES, precision: 2,
    }),
    defineCategory({
      id: 'minutesPerGoal', nameHu: 'Kevesebb játékperc egy gólhoz', shortNameHu: 'Perc/gól', cardNameHu: 'Perc/gól',
      icon: '🥅', group: CATEGORY_GROUPS.ATTACK, direction: CATEGORY_DIRECTIONS.LOWER, hintHu: 'A kevesebb nyer',
      value: card => {
        const goals = normaliseNumber(card?.stats?.goals);
        const playedMinutes = normaliseNumber(card?.stats?.minutes);
        if (playedMinutes == null || playedMinutes < CATEGORY_RATE_MINUTES || goals == null || goals <= 0) return null;
        return safeRatio(playedMinutes, goals);
      },
      formatValue: minutes, requiredFields: ['stats.goals', 'stats.minutes'],
      minimumMinutes: CATEGORY_RATE_MINUTES, precision: 2,
    }),
    defineCategory({
      id: 'minutesPerGoalContribution', nameHu: 'Kevesebb játékperc egy kanadai ponthoz', shortNameHu: 'Perc/pont', cardNameHu: 'Perc/pont',
      icon: '⚡', group: CATEGORY_GROUPS.ATTACK, direction: CATEGORY_DIRECTIONS.LOWER, hintHu: 'A kevesebb nyer',
      value: card => {
        const contributions = goalContributions(card);
        const playedMinutes = normaliseNumber(card?.stats?.minutes);
        if (playedMinutes == null || playedMinutes < CATEGORY_RATE_MINUTES || contributions == null || contributions <= 0) return null;
        return safeRatio(playedMinutes, contributions);
      },
      formatValue: minutes, requiredFields: ['stats.goals', 'stats.assists', 'stats.minutes'],
      minimumMinutes: CATEGORY_RATE_MINUTES, precision: 2,
    }),
    defineCategory({
      id: 'squads', nameHu: 'Több kerettagság', shortNameHu: 'Kerettagság', cardNameHu: 'Meccskeretben',
      icon: '📋', group: CATEGORY_GROUPS.APPEARANCE, direction: CATEGORY_DIRECTIONS.HIGHER, hintHu: 'A több nyer',
      value: statValue('squads'), formatValue: integer, requiredFields: ['stats.squads'], enabled: true,
    }),
    defineCategory({
      id: 'yellowCards', nameHu: 'Több sárga lap', shortNameHu: 'Több sárga', cardNameHu: 'Sárga lap',
      icon: '🟨', group: CATEGORY_GROUPS.DISCIPLINE, direction: CATEGORY_DIRECTIONS.HIGHER, hintHu: 'A több nyer',
      value: statValue('yellowCards'), formatValue: integer, requiredFields: ['stats.yellowCards'], enabled: true,
    }),
    defineCategory({
      id: 'yellowCardsFewest', nameHu: 'Kevesebb sárga lap', shortNameHu: 'Kevesebb sárga', cardNameHu: 'Sárga lap',
      icon: '🟨', group: CATEGORY_GROUPS.DISCIPLINE, direction: CATEGORY_DIRECTIONS.LOWER, hintHu: 'A kevesebb nyer',
      value: statValue('yellowCards'), formatValue: integer, requiredFields: ['stats.yellowCards'],
      cardField: 'yellowCards', enabled: true,
    }),
    defineCategory({
      id: 'totalDismissals', nameHu: 'Több kiállítás', shortNameHu: 'Több kiállítás', cardNameHu: 'Kiállítás',
      icon: '🟥', group: CATEGORY_GROUPS.DISCIPLINE, direction: CATEGORY_DIRECTIONS.HIGHER, hintHu: 'A több nyer',
      value: statValue('totalDismissals'), formatValue: integer, requiredFields: ['stats.totalDismissals'], enabled: true,
    }),
    defineCategory({
      id: 'totalDismissalsFewest', nameHu: 'Kevesebb kiállítás', shortNameHu: 'Kevesebb kiállítás', cardNameHu: 'Kiállítás',
      icon: '🟥', group: CATEGORY_GROUPS.DISCIPLINE, direction: CATEGORY_DIRECTIONS.LOWER, hintHu: 'A kevesebb nyer',
      value: statValue('totalDismissals'), formatValue: integer, requiredFields: ['stats.totalDismissals'],
      cardField: 'totalDismissals', enabled: true,
    }),
    defineCategory({
      id: 'cardsPer90', nameHu: 'Több lap 90 percenként', shortNameHu: 'Lap/90', cardNameHu: 'Lap/90',
      icon: '🟨', group: CATEGORY_GROUPS.DISCIPLINE, direction: CATEGORY_DIRECTIONS.HIGHER, hintHu: 'A több nyer',
      value: card => {
        const cards = disciplinaryEvents(card);
        const playedMinutes = normaliseNumber(card?.stats?.minutes);
        if (playedMinutes == null || playedMinutes < CATEGORY_RATE_MINUTES) return null;
        return safeRatio(cards, playedMinutes, 90);
      },
      formatValue: decimal, requiredFields: ['stats.yellowCards', 'stats.totalDismissals', 'stats.minutes'],
      minimumMinutes: CATEGORY_RATE_MINUTES, precision: 2,
    }),
    defineCategory({
      id: 'discipline', nameHu: 'Fegyelmezettebb játékos', shortNameHu: 'Fegyelmezettebb', cardNameHu: 'Összes lap',
      icon: '🕊️', group: CATEGORY_GROUPS.DISCIPLINE, direction: CATEGORY_DIRECTIONS.LOWER, hintHu: 'A kevesebb lap nyer',
      value: disciplinaryEvents, formatValue: value => `${integer(value)} lap`,
      requiredFields: ['stats.yellowCards', 'stats.totalDismissals'], enabled: true,
    }),
  ];

  const validationProblems = validateCategoryDefinitions(definitions);
  if (validationProblems.length) throw new Error(`Hibás kategóriaregiszter: ${validationProblems.join('; ')}`);

  const byId = Object.fromEntries(definitions.map(category => [category.id, category]));
  const enabledCategories = definitions.filter(category => category.enabled);
  const cardCategoryIds = Object.freeze([
    'birthDate', 'appearances', 'starts', 'goals', 'squads', 'yellowCards', 'totalDismissals',
  ]);
  const availability = {};

  const value = (card, categoryId) => {
    const category = byId[categoryId];
    if (!card || !category) return null;
    const result = category.value(card);
    return finiteNumber(result) ? result : null;
  };
  const hasValue = (card, categoryId) => value(card, categoryId) != null;
  const formatValue = (card, categoryId) => {
    const category = byId[categoryId];
    if (!category) return '';
    const result = value(card, categoryId);
    return result == null ? '' : category.formatValue(result, card);
  };
  const configure = (cards, { minimumCoverage = CATEGORY_MINIMUM_COVERAGE } = {}) => {
    const pool = Array.isArray(cards) ? cards : [];
    const minimumKnown = Math.max(2, Math.ceil(pool.length * minimumCoverage));
    const activeCategories = [];

    for (const category of definitions) {
      const knownValues = pool.filter(card => hasValue(card, category.id)).length;
      const coverage = pool.length ? knownValues / pool.length : 0;
      const enabled = knownValues >= minimumKnown
        || (!category.optional && knownValues === pool.length && knownValues > 0);
      const status = enabled ? (coverage < 0.5 ? 'experimental' : 'enabled') : 'disabled';
      Object.assign(category, { enabled, knownValues, coverage, status });
      availability[category.id] = { enabled, knownValues, coverage, status };
      if (enabled) activeCategories.push(category);
    }

    enabledCategories.splice(0, enabledCategories.length, ...activeCategories);
    return availability;
  };

  return {
    schemaVersion: CATEGORY_SCHEMA_VERSION,
    definitions,
    byId,
    enabledCategories,
    cardCategoryIds,
    availability,
    value,
    hasValue,
    formatValue,
    configure,
  };
}
