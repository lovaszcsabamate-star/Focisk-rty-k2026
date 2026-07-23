/** Központi alkalmazáskonfiguráció és tartós tárolási szerződés. */

export const STORAGE_SCHEMA_VERSION = 1;
export const SAVED_MATCH_VERSION = 2;

// A kulcsértékek a korábbi kiadáséval azonosak, ezért a meglévő felhasználói adatok migráció nélkül megmaradnak.
export const APP_STORAGE_KEYS = Object.freeze({
  savedMatch: 'fociskartyak:saved-match:v2',
  deckSelection: 'fociskartyak:deck-selection:v1',
  onboardingComplete: 'fociskartyak:onboarding-complete',
  playerName: 'fociskartyak:player-name:v1',
  selectedOpponent: 'fociskartyak:opponent',
  visualSettings: 'fociskartyak.visual-settings.v1',
  visualSizingBackup: 'fociskartyak.visual-sizing.v1',
});

export const BOOLEAN_SETTING_KEYS = Object.freeze({
  sounds: 'fociskartyak:sounds',
  commentary: 'fociskartyak:commentary',
  vibration: 'fociskartyak:vibration',
  animations: 'fociskartyak:animations',
  largeText: 'fociskartyak:largeText',
  simplified: 'fociskartyak:simplified',
});

export const DEFAULT_EXPERIENCE_SETTINGS = Object.freeze({
  sounds: false,
  commentary: true,
  vibration: false,
  animations: true,
  largeText: false,
  simplified: false,
});

export const APP_CONFIGURATION = Object.freeze({
  storageSchemaVersion: STORAGE_SCHEMA_VERSION,
  savedMatchVersion: SAVED_MATCH_VERSION,
  storageKeys: APP_STORAGE_KEYS,
  booleanSettingKeys: BOOLEAN_SETTING_KEYS,
  defaultExperienceSettings: DEFAULT_EXPERIENCE_SETTINGS,
});

// ESM-fogyasztók számára megmarad a korábbi általános exportnév; a standalone bundle belül az egyedi nevet használja.
export { APP_STORAGE_KEYS as STORAGE_KEYS };

export function settingStorageKey(settingName) {
  return BOOLEAN_SETTING_KEYS[settingName] ?? `fociskartyak:${String(settingName ?? '').trim()}`;
}
