import { nationalityPresentation } from './data/nationalities.js';
import { createCountryFlagElement } from './ui/flag-component.js';

const nationalityUiLabelFromMark = mark => {
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

const nationalityUiEnhanceMark = mark => {
  if (!mark) return;
  const label = nationalityUiLabelFromMark(mark);
  const presentation = nationalityPresentation(label);
  if (!presentation.known || !presentation.asset) {
    delete mark.dataset.nationalityFlagCountryCode;
    return;
  }

  const alreadyCurrent = mark.dataset.nationalityFlagCountryCode === presentation.countryCode
    && mark.querySelector?.('.nationality-flag__image');
  if (alreadyCurrent) return;

  mark.replaceChildren(createCountryFlagElement(document, {
    countryCode: presentation.countryCode,
    nationality: presentation.nationality,
    className: 'quick-team-mark__flag-image',
  }));
  mark.dataset.nationalityFlagCountryCode = presentation.countryCode;
};

const nationalityUiScanSurfaces = root => {
  if (root?.matches?.('.quick-team-mark--flag')) nationalityUiEnhanceMark(root);
  root?.querySelectorAll?.('.quick-team-mark--flag').forEach(nationalityUiEnhanceMark);
};

nationalityUiScanSurfaces(document);

const nationalityUiMutationObserver = typeof MutationObserver === 'function'
  ? new MutationObserver(records => {
    for (const record of records) {
      const target = record.target?.nodeType === 1
        ? record.target
        : record.target?.parentElement;
      if (target) nationalityUiScanSurfaces(target);

      record.addedNodes.forEach(node => {
        const element = node?.nodeType === 1 ? node : node?.parentElement;
        if (element) nationalityUiScanSurfaces(element);
      });
    }
  })
  : null;

nationalityUiMutationObserver?.observe(document.documentElement, {
  childList: true,
  characterData: true,
  subtree: true,
});
