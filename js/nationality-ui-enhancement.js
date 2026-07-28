import { nationalityPresentation } from './data/nationalities.js';
import { createCountryFlagElement } from './ui/flag-component.js';

const nationLabelFromMark = mark => {
  const card = mark.closest?.('.quick-team-card');
  const duel = mark.closest?.('.quick-match-duel__side');
  const label = card?.querySelector?.('.quick-team-card__name')?.textContent
    ?? duel?.querySelector?.('.quick-match-duel__copy strong')?.textContent
    ?? mark.closest?.('summary')?.querySelector?.('.deck-selector__current')?.textContent
    ?? '';
  return String(label)
    .replace(/\s+válogatott(?:\s.*)?$/iu, '')
    .replace(/\s+·.*$/u, '')
    .trim();
};

const enhanceNationMark = mark => {
  if (!mark || mark.dataset.nationalityFlagEnhanced === 'true') return;
  const label = nationLabelFromMark(mark);
  const presentation = nationalityPresentation(label);
  if (!presentation.known || !presentation.asset) return;
  mark.replaceChildren(createCountryFlagElement(document, {
    countryCode: presentation.countryCode,
    nationality: presentation.nationality,
    className: 'quick-team-mark__flag-image',
  }));
  mark.dataset.nationalityFlagEnhanced = 'true';
};

const scanNationalitySurfaces = root => {
  if (root?.matches?.('.quick-team-mark--flag')) enhanceNationMark(root);
  root?.querySelectorAll?.('.quick-team-mark--flag').forEach(enhanceNationMark);
};

scanNationalitySurfaces(document);

const observer = typeof MutationObserver === 'function'
  ? new MutationObserver(records => {
    for (const record of records) {
      record.addedNodes.forEach(node => {
        if (node?.nodeType === 1) scanNationalitySurfaces(node);
      });
    }
  })
  : null;

observer?.observe(document.documentElement, { childList: true, subtree: true });
