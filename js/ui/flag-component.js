import {
  UNKNOWN_NATIONALITY,
  countryCodeToFlagAsset,
  countryCodeToFlagEmoji,
  countryCodeToNationality,
  normaliseCountryCode,
  resolvePlayerNationality,
} from '../data/nationalities.js';

const warnedPlayers = new Set();

const warnUnknownFlag = player => {
  const key = player?.id ?? player?.name ?? 'unknown-player';
  if (warnedPlayers.has(key)) return;
  warnedPlayers.add(key);
  console.warn?.(
    `[nationality] ${player?.name ?? 'Ismeretlen játékos'}: nincs érvényes nemzetiség vagy országkód; semleges földgömb jelenik meg.`,
  );
};

export function createCountryFlagElement(documentRef, {
  countryCode,
  nationality,
  playerName = '',
  className = '',
  compact = false,
} = {}) {
  const code = normaliseCountryCode(countryCode);
  const label = nationality || (code ? countryCodeToNationality[code] : null) || UNKNOWN_NATIONALITY;
  const wrapper = documentRef.createElement('span');
  wrapper.className = `nationality-flag${compact ? ' nationality-flag--compact' : ''}${className ? ` ${className}` : ''}`;
  wrapper.title = label;
  wrapper.dataset.countryCode = code ?? '';

  if (!code) {
    wrapper.classList.add('nationality-flag--unknown');
    wrapper.setAttribute('role', 'img');
    wrapper.setAttribute('aria-label', `${playerName ? `${playerName} – ` : ''}${UNKNOWN_NATIONALITY}`);
    wrapper.textContent = '🌐';
    return wrapper;
  }

  const accessibleLabel = `${playerName ? `${playerName} – ` : ''}${label}`;
  const asset = countryCodeToFlagAsset[code];
  if (asset) {
    const image = documentRef.createElement('img');
    image.className = 'nationality-flag__image';
    image.src = asset;
    image.alt = accessibleLabel;
    image.title = label;
    image.loading = 'lazy';
    image.decoding = 'async';
    wrapper.appendChild(image);
    return wrapper;
  }

  wrapper.classList.add('nationality-flag--emoji');
  wrapper.setAttribute('role', 'img');
  wrapper.setAttribute('aria-label', accessibleLabel);
  wrapper.textContent = countryCodeToFlagEmoji(code);
  return wrapper;
}

export function createPlayerFlagElement(documentRef, player, options = {}) {
  const countryCode = normaliseCountryCode(player?.countryCode);
  const resolved = countryCode
    ? {
      countryCode,
      nationality: player?.nationality ?? countryCodeToNationality[countryCode],
      known: true,
    }
    : resolvePlayerNationality(player);
  if (!resolved.known) warnUnknownFlag(player);
  return createCountryFlagElement(documentRef, {
    countryCode: resolved.countryCode,
    nationality: resolved.nationality,
    playerName: player?.name ?? player?.displayName ?? '',
    ...options,
  });
}
