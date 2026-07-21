const usable = value => value !== null && value !== undefined && value !== '';

const normaliseName = value => String(value ?? '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLocaleUpperCase('hu-HU')
  .replace(/[^A-Z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const clubIds = card => Array.isArray(card?.meta?.clubIds) && card.meta.clubIds.length
  ? card.meta.clubIds
  : [card?.meta?.clubId].filter(Boolean);

const cloneCard = card => ({
  ...card,
  stats: { ...(card?.stats ?? {}) },
  meta: {
    ...(card?.meta ?? {}),
    clubIds: Array.isArray(card?.meta?.clubIds) ? [...card.meta.clubIds] : card?.meta?.clubIds,
    verifiedCorrections: Array.isArray(card?.meta?.verifiedCorrections)
      ? [...card.meta.verifiedCorrections]
      : [],
  },
});

/**
 * Apply explicit, source-backed corrections before the non-destructive enrichment layer.
 * Every overwrite must name its permitted fields in overrideFields and remains auditable
 * in card.meta.verifiedCorrections.
 */
export function applyVerifiedPlayerCorrections(payload, corrections = []) {
  const rawCards = Array.isArray(payload) ? payload : payload?.players;
  if (!Array.isArray(rawCards) || !Array.isArray(corrections) || !corrections.length) return payload;

  const cards = rawCards.map(cloneCard);
  const applied = [];
  const skipped = [];

  for (const correction of corrections) {
    const permitted = new Set(Array.isArray(correction?.overrideFields) ? correction.overrideFields : []);
    if (!permitted.size) {
      skipped.push({ correctionId: correction?.correctionId ?? null, reason: 'no-override-fields' });
      continue;
    }

    const candidates = cards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => {
        if (correction.playerId && card.id === correction.playerId) return true;
        return correction.clubId
          && clubIds(card).includes(correction.clubId)
          && normaliseName(card.name) === normaliseName(correction.name);
      });

    if (candidates.length !== 1) {
      skipped.push({
        correctionId: correction?.correctionId ?? null,
        reason: candidates.length ? 'ambiguous-player-match' : 'player-not-found',
      });
      continue;
    }

    const { index } = candidates[0];
    const card = cards[index];
    const previous = {};
    const fieldsApplied = [];

    for (const field of ['birthDate', 'nation', 'position']) {
      if (!permitted.has(field) || !usable(correction[field])) continue;
      if (String(card[field] ?? '') === String(correction[field])) continue;
      previous[field] = card[field] ?? null;
      card[field] = correction[field];
      fieldsApplied.push(field);
    }

    for (const [field, value] of Object.entries(correction.stats ?? {})) {
      if (!permitted.has(field) && !permitted.has(`stats.${field}`)) continue;
      if (!usable(value) || String(card.stats[field] ?? '') === String(value)) continue;
      previous[`stats.${field}`] = card.stats[field] ?? null;
      card.stats[field] = value;
      fieldsApplied.push(`stats.${field}`);
    }

    const auditEntry = {
      correctionId: correction.correctionId ?? null,
      clubId: correction.clubId ?? null,
      checkedAt: correction.checkedAt ?? null,
      sourceIds: Array.isArray(correction.sourceIds) ? [...correction.sourceIds] : [],
      sourceUrl: correction.sourceUrl ?? null,
      note: correction.note ?? null,
      fieldsApplied,
      previous,
    };
    card.meta.verifiedCorrections.push(auditEntry);
    if (fieldsApplied.length) card.meta.dataStatus = 'verified';
    applied.push({ playerId: card.id, playerName: card.name, ...auditEntry });
  }

  const summary = {
    requested: corrections.length,
    appliedPlayers: applied.length,
    appliedFields: applied.reduce((sum, item) => sum + item.fieldsApplied.length, 0),
    skipped: skipped.length,
    applied,
    skippedCorrections: skipped,
  };

  return Array.isArray(payload)
    ? cards
    : { ...payload, players: cards, verifiedPlayerCorrections: summary };
}
