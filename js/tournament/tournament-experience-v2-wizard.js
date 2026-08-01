/** Többlépcsős, alacsony információsűrűségű tornaindítás. */

import {
  MINIMUM_CARDS, TEAM_SOURCE, LOCATION, OPPONENT_MODE,
  TOURNAMENTS, LOCATION_LABELS, TROPHY_STYLES, TROPHY_ACCENTS, TROPHY_PATTERNS,
  TOURNAMENT_FORMAT, TOURNAMENT_MATCH_MODE, TOURNAMENT_STATUS, runtime,
  difficultyLabel, escapeHtml, formatLabel, matchModeLabel, makePanel, showPanel,
  closeTournamentLayers, tournamentStorageService, tournamentProgress,
  saveAndVerifyTournament, safeTournamentName, ensureExperienceStyle, readDraft,
  saveDraft, clearDraft, presetFor, initialDraft, applyTournament,
  usableTeamsForSource, domainCategoryForSource, tournamentOptionsForLocation,
  locationDefaultType, stepList, trophyMarkup, trophyPresentation, teamMark,
  headerMarkup, estimatedMatches, estimatedRounds, supportedCustomCounts,
  participantsForDraft, validationErrors, createConfiguredTournament, showDrawScene,
} from './tournament-experience-v2-shared.js';

const initials = value => String(value ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 3)
  .map(word => word[0]).join('').toUpperCase() || 'FK';
function normaliseParticipantIds(draft, pool) {
  const valid = new Set(pool.map(team => team.id));
  const unique = [...new Set((draft.participantIds ?? []).filter(id => valid.has(id)))];
  draft.participantIds = draft.humanTeamId
    ? [draft.humanTeamId, ...unique.filter(id => id !== draft.humanTeamId)].slice(0, draft.count)
    : unique.slice(0, draft.count);
}

function showExperienceWizard(returnPanel, suppliedDraft = null, initialStep = 'type') {
  ensureExperienceStyle();
  const restored = suppliedDraft ?? readDraft();
  const draft = restored && TOURNAMENTS[restored.type] ? { ...initialDraft(restored.type), ...restored } : initialDraft();
  let step = stepList(draft).some(([key]) => key === initialStep) ? initialStep : 'type';
  const node = makePanel('tournament-experience-v2');
  let keydownInstalled = false;

  const exit = () => {
    runtime.wizard = null;
    if (returnPanel?.isConnected || returnPanel) showPanel(returnPanel);
    else closeTournamentLayers();
  };
  const previous = () => {
    const steps = stepList(draft);
    const index = steps.findIndex(([key]) => key === step);
    if (index <= 0) { exit(); return; }
    step = steps[index - 1][0];
    render();
  };
  const next = target => { step = target; saveDraft(draft); render(); };
  runtime.wizard = { previous, exit };

  const wireCommon = () => {
    node.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', previous));
    node.querySelectorAll('[data-exit]').forEach(button => button.addEventListener('click', exit));
    if (!keydownInstalled) {
      keydownInstalled = true;
      node.addEventListener('keydown', event => {
        if (step !== 'team' || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        if (event.target?.matches?.('input,select,textarea')) return;
        event.preventDefault();
        node.querySelector(event.key === 'ArrowLeft' ? '[data-team-prev]' : '[data-team-next]')?.click?.();
      });
    }
  };

  const renderType = () => {
    const options = tournamentOptionsForLocation(draft.location);
    if (!options.some(option => option.key === draft.type)) applyTournament(draft, locationDefaultType(draft.location));
    const preset = presetFor(draft.type);
    node.innerHTML = `${headerMarkup(draft, step, 'Vissza a főmenübe')}<section class="tx-section"><div class="tx-section-title"><h2>Bajnokság helye</h2><button class="tx-help" type="button" data-info aria-label="Tornaválasztási súgó">?</button></div><div class="tx-location-tabs" role="tablist">${Object.values(LOCATION).map(location => `<button type="button" role="tab" aria-selected="${draft.location === location}" class="${draft.location === location ? 'is-active' : ''}" data-location="${location}">${escapeHtml(LOCATION_LABELS[location])}</button>`).join('')}</div><p class="tx-info" data-info-text hidden>Egy képernyőn csak az aktuális választás jelenik meg. A kupa és az alsó tornakártyák a felső kategóriával együtt frissülnek.</p></section><section class="tx-trophy-stage" data-pattern="${escapeHtml(preset.trophyPattern)}">${trophyMarkup({ style: preset.trophyStyle, accent: preset.trophyAccent })}<h2>${escapeHtml(preset.title)}</h2><p>${escapeHtml(preset.description)}</p><small>${escapeHtml(preset.shortFormat)}</small></section><section class="tx-section"><h2>Tornatípus</h2><div class="tx-type-strip">${options.map(option => `<button type="button" class="tx-type-card ${draft.type === option.key ? 'is-selected' : ''}" data-type="${option.key}" aria-pressed="${draft.type === option.key}"><h3>${escapeHtml(option.title)}</h3><p>${escapeHtml(option.description)}</p><small>${escapeHtml(option.shortFormat)}</small></button>`).join('')}</div></section><div class="tx-actions"><button class="btn btn--ghost" type="button" data-exit>Vissza a főmenübe</button><button class="btn tx-actions__primary" type="button" data-next>Tovább a csapatválasztáshoz</button></div>`;
    node.querySelectorAll('[data-location]').forEach(button => button.addEventListener('click', () => {
      draft.location = button.dataset.location;
      applyTournament(draft, locationDefaultType(draft.location));
      render();
    }));
    node.querySelectorAll('[data-type]').forEach(button => button.addEventListener('click', () => {
      applyTournament(draft, button.dataset.type);
      render();
    }));
    node.querySelector('[data-info]')?.addEventListener('click', () => {
      const info = node.querySelector('[data-info-text]');
      if (info) info.hidden = !info.hidden;
    });
    node.querySelector('[data-next]')?.addEventListener('click', () => next('team'));
  };

  const renderTeam = () => {
    const pool = usableTeamsForSource(draft.teamSource);
    if (!pool.length) {
      node.innerHTML = `${headerMarkup(draft, step)}<p class="tx-warning">Ehhez a kategóriához nincs legalább ${MINIMUM_CARDS} kártyával rendelkező csapat.</p><div class="tx-actions"><button class="btn" data-back>Vissza</button></div>`;
      return;
    }
    if (!pool.some(team => team.id === draft.humanTeamId)) draft.humanTeamId = pool[0].id;
    let index = pool.findIndex(team => team.id === draft.humanTeamId);
    index = index < 0 ? 0 : index;
    draft.teamIndex = index;
    const team = pool[index];
    const cycle = offset => {
      draft.teamIndex = (index + offset + pool.length) % pool.length;
      draft.humanTeamId = pool[draft.teamIndex].id;
      draft.participantIds = [draft.humanTeamId];
      saveDraft(draft);
      render();
    };
    const nextStep = draft.type === 'custom' ? 'custom' : 'summary';
    node.innerHTML = `${headerMarkup(draft, step)}${draft.type === 'custom' ? `<section class="tx-section"><h2>Csapatkategória</h2><div class="tx-team-source">${[[TEAM_SOURCE.HUNGARIAN,'Magyar bajnokság'],[TEAM_SOURCE.LEAGUE,'Liga'],[TEAM_SOURCE.NATIONAL,'Válogatott']].map(([value,label]) => `<button type="button" class="${draft.teamSource === value ? 'is-active' : ''}" data-team-source="${value}" aria-pressed="${draft.teamSource === value}">${label}</button>`).join('')}</div></section>` : ''}<section class="tx-section"><div class="tx-section-title"><h2>Saját csapat</h2><span>${index + 1} / ${pool.length}</span></div><div class="tx-team-carousel"><button class="btn btn--ghost tx-team-arrow" type="button" data-team-prev aria-label="Előző csapat">‹</button><article class="tx-team-hero"><button type="button" class="tx-team-mark" data-select-team aria-label="${escapeHtml(team.label)} kiválasztása">${team?.badge ? `<img src="${escapeHtml(team.badge)}" alt="" loading="lazy">` : escapeHtml(team?.icon || initials(team.label))}</button><h2>${escapeHtml(team.label)}</h2><div class="tx-team-meta"><span>${Number(team.count) || 0} játékoskártya</span><span>${draft.teamSource === TEAM_SOURCE.HUNGARIAN ? 'Magyar klub' : draft.teamSource === TEAM_SOURCE.LEAGUE ? 'Liga-válogatott' : 'Válogatott / régió'}</span><span>Kiválasztva</span></div><p>A logóra kattintva is megerősítheted a választást.</p></article><button class="btn btn--ghost tx-team-arrow" type="button" data-team-next aria-label="Következő csapat">›</button></div><div class="tx-mini-teams" aria-label="Csapatok gyorsválasztója">${pool.map(item => `<button type="button" class="tx-mini-team ${item.id === team.id ? 'is-selected' : ''}" data-mini-team="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.label)}">${teamMark(item)}<small>${escapeHtml(item.label)}</small></button>`).join('')}</div><div class="tx-random-wrap"><button type="button" class="tx-random-ball" data-random-team aria-label="Véletlenszerű csapat dobókockás futball-labdával">Véletlen csapat</button></div></section><div class="tx-actions"><button class="btn btn--ghost" type="button" data-back>Vissza</button><button class="btn tx-actions__primary" type="button" data-next>Csapat kiválasztása</button></div>`;
    node.querySelector('[data-team-prev]')?.addEventListener('click', () => cycle(-1));
    node.querySelector('[data-team-next]')?.addEventListener('click', () => cycle(1));
    node.querySelector('[data-random-team]')?.addEventListener('click', () => {
      const chosen = pool[Math.floor(Math.random() * pool.length)] ?? null;
      if (!chosen) return;
      draft.humanTeamId = chosen.id;
      draft.participantIds = [chosen.id];
      saveDraft(draft);
      render();
    });
    node.querySelectorAll('[data-mini-team]').forEach(button => button.addEventListener('click', () => {
      draft.humanTeamId = button.dataset.miniTeam;
      draft.participantIds = [draft.humanTeamId];
      saveDraft(draft);
      render();
    }));
    node.querySelector('[data-select-team]')?.addEventListener('click', () => next(nextStep));
    node.querySelector('[data-next]')?.addEventListener('click', () => next(nextStep));
    node.querySelectorAll('[data-team-source]').forEach(button => button.addEventListener('click', () => {
      draft.teamSource = button.dataset.teamSource;
      draft.category = domainCategoryForSource(draft.teamSource);
      draft.humanTeamId = '';
      draft.participantIds = [];
      draft.teamIndex = 0;
      draft.candidateIndex = 0;
      saveDraft(draft);
      render();
    }));
  };

  const renderCustom = () => {
    const pool = usableTeamsForSource(draft.teamSource);
    if (!pool.some(team => team.id === draft.humanTeamId)) { next('team'); return; }
    const counts = supportedCustomCounts(draft, pool.length);
    if (!counts.includes(draft.count)) draft.count = counts[0] ?? 0;
    normaliseParticipantIds(draft, pool);
    if (!draft.participantIds.includes(draft.humanTeamId)) draft.participantIds.unshift(draft.humanTeamId);
    const selected = draft.participantIds.map(id => pool.find(team => team.id === id)).filter(Boolean);
    const candidates = pool.filter(team => !draft.participantIds.includes(team.id));
    draft.candidateIndex = Math.max(0, Math.min(draft.candidateIndex ?? 0, Math.max(0, candidates.length - 1)));
    const candidate = candidates[draft.candidateIndex] ?? null;
    const availableSlots = Math.max(0, draft.count - selected.length);
    const modeValid = draft.opponentMode !== OPPONENT_MODE.MANUAL || selected.length === draft.count;
    const canContinue = draft.count && modeValid;

    const changeCandidate = offset => {
      if (!candidates.length) return;
      draft.candidateIndex = (draft.candidateIndex + offset + candidates.length) % candidates.length;
      render();
    };
    const addCandidate = () => {
      if (!candidate || selected.length >= draft.count) return;
      draft.participantIds = [...draft.participantIds, candidate.id];
      draft.candidateIndex = 0;
      saveDraft(draft);
      render();
    };

    node.innerHTML = `${headerMarkup(draft, step)}<section class="tx-section"><div class="tx-section-title"><h2>Kupa neve</h2><button class="tx-help" type="button" data-name-help aria-label="Névsúgó">?</button></div><label class="tx-form-row"><span>Legfeljebb 32 karakter</span><input type="text" maxlength="32" data-name value="${escapeHtml(draft.name)}" placeholder="Saját kupa"></label><p class="tx-info" data-name-info hidden>Üres név esetén a játék a „Saját kupa” elnevezést használja. A hosszkorlát megakadályozza a kártyák szétesését.</p></section><section class="tx-section"><h2>Résztvevő csapatok száma</h2><div class="tx-choice-grid">${counts.map(count => `<button type="button" class="tx-choice tx-count-card ${draft.count === count ? 'is-selected' : ''}" data-count="${count}"><strong>${count} csapat</strong><small>${estimatedRounds(draft.format, count)} forduló · körülbelül ${Math.round(estimatedMatches(draft.format, count))} mérkőzés</small></button>`).join('')}</div></section><section class="tx-section"><h2>Torna formátuma</h2><div class="tx-choice-grid">${[[TOURNAMENT_FORMAT.KNOCKOUT,'Kieséses torna','Egymeccses párharcok'],[TOURNAMENT_FORMAT.LEAGUE,'Bajnoki rendszer','Mindenki játszik mindenkivel'],[TOURNAMENT_FORMAT.GROUP_KNOCKOUT,'Csoportkör és kiesés','Csoportok után kupaág']].map(([value,label,description]) => `<button type="button" class="tx-choice ${draft.format === value ? 'is-selected' : ''}" data-format="${value}"><b>${label}</b><small>${description}</small></button>`).join('')}</div></section><section class="tx-section"><h2>Ellenfelek kiválasztása</h2><div class="tx-choice-grid">${[[OPPONENT_MODE.RANDOM,'Minden ellenfél véletlenszerű','A rendszer tölti fel a teljes mezőnyt.'],[OPPONENT_MODE.MANUAL,'Kézi kiválasztás','Minden csapatot te adsz hozzá.'],[OPPONENT_MODE.MIXED,'Vegyes kiválasztás','Néhány csapatot kiválasztasz, a többit a gép tölti fel.']].map(([value,label,description]) => `<button type="button" class="tx-choice ${draft.opponentMode === value ? 'is-selected' : ''}" data-opponent-mode="${value}"><b>${label}</b><small>${description}</small></button>`).join('')}</div>${draft.opponentMode === OPPONENT_MODE.RANDOM ? '<p class="tx-info">A saját csapat automatikusan bekerül, a többi helyet a rendszer egyedi csapatokkal tölti fel.</p>' : `<div class="tx-field-layout"><div class="tx-selected-teams"><div class="tx-section-title"><h3>Kiválasztott résztvevők</h3><span class="tx-slot-counter">Résztvevők: ${selected.length} / ${draft.count}</span></div>${selected.map(team => `<div class="tx-selected-team">${teamMark(team)}<span><b>${escapeHtml(team.label)}</b><small>${team.id === draft.humanTeamId ? 'Saját csapat' : 'Ellenfél'}</small></span>${team.id === draft.humanTeamId ? '<span>✓</span>' : `<button type="button" class="btn btn--ghost" data-remove-team="${escapeHtml(team.id)}" aria-label="${escapeHtml(team.label)} eltávolítása">×</button>`}</div>`).join('')}</div><div class="tx-candidate"><h3>Új ellenfél</h3>${candidate ? `${teamMark(candidate)}<b>${escapeHtml(candidate.label)}</b><small>${Number(candidate.count) || 0} kártya</small><div class="tx-candidate-nav"><button class="btn btn--ghost" type="button" data-candidate-prev aria-label="Előző jelölt">‹</button><button class="btn" type="button" data-add-candidate ${availableSlots ? '' : 'disabled'}>Hozzáadás</button><button class="btn btn--ghost" type="button" data-candidate-next aria-label="Következő jelölt">›</button></div>` : '<p>Minden elérhető csapat szerepel a mezőnyben.</p>'}</div></div>${draft.opponentMode === OPPONENT_MODE.MIXED ? `<p class="tx-info">Még ${availableSlots} helyet a rendszer tölt fel véletlenszerűen.</p>` : ''}`}</section><section class="tx-section"><h2>Kupa megjelenése</h2><div class="tx-field-layout"><div class="tx-trophy-stage" data-pattern="${escapeHtml(draft.trophyPattern)}">${trophyMarkup(trophyPresentation(draft))}<small>Az előnézet azonnal frissül.</small></div><div class="tx-trophy-options"><div><h3>Forma</h3><div class="tx-choice-grid">${TROPHY_STYLES.map(item => `<button type="button" class="tx-choice ${draft.trophyStyle === item.key ? 'is-selected' : ''}" data-trophy-style="${item.key}"><b>${escapeHtml(item.label)}</b></button>`).join('')}</div></div><div><h3>Kiemelőszín</h3><div class="tx-color-options">${TROPHY_ACCENTS.map(item => `<button type="button" class="tx-color ${draft.trophyAccent === item.key ? 'is-selected' : ''}" data-trophy-accent="${item.key}" style="--swatch:${item.key === 'gold' ? '#d8a93f' : item.key === 'silver' ? '#bdc6cc' : item.key === 'bronze' ? '#a96b36' : item.key === 'crimson' ? '#a73948' : '#2f8a55'}" aria-label="${escapeHtml(item.label)}"></button>`).join('')}</div></div><div><h3>Háttérminta</h3><div class="tx-choice-grid">${TROPHY_PATTERNS.map(item => `<button type="button" class="tx-choice ${draft.trophyPattern === item.key ? 'is-selected' : ''}" data-trophy-pattern="${item.key}"><b>${escapeHtml(item.label)}</b></button>`).join('')}</div></div></div></div></section><section class="tx-section"><h2>Játékmenet</h2><div class="tx-choice-grid">${[[TOURNAMENT_MATCH_MODE.CLASSIC,'Klasszikus','Kártyás összehasonlító mérkőzés'],[TOURNAMENT_MATCH_MODE.PENALTIES,'Büntetőpárbaj','Gyors, 11 lapos párbaj']].map(([value,label,description]) => `<button type="button" class="tx-choice ${draft.matchMode === value ? 'is-selected' : ''}" data-match-mode="${value}"><b>${label}</b><small>${description}</small></button>`).join('')}</div><div class="tx-choice-grid">${[['easy','Könnyű'],['medium','Normál'],['hard','Nehéz']].map(([value,label]) => `<button type="button" class="tx-choice ${draft.difficulty === value ? 'is-selected' : ''}" data-difficulty="${value}"><b>${label}</b></button>`).join('')}</div></section><div class="tx-actions"><button class="btn btn--ghost" type="button" data-back>Vissza a csapatválasztáshoz</button><button class="btn tx-actions__primary" type="button" data-next ${canContinue ? '' : 'disabled'}>Beállítások mentése és tovább</button></div>`;

    node.querySelector('[data-name]')?.addEventListener('input', event => { draft.name = event.target.value.slice(0, 32); saveDraft(draft); });
    node.querySelector('[data-name-help]')?.addEventListener('click', () => { const info = node.querySelector('[data-name-info]'); if (info) info.hidden = !info.hidden; });
    node.querySelectorAll('[data-count]').forEach(button => button.addEventListener('click', () => {
      draft.count = Number(button.dataset.count);
      draft.participantIds = [draft.humanTeamId, ...draft.participantIds.filter(id => id !== draft.humanTeamId)].slice(0, draft.count);
      saveDraft(draft); render();
    }));
    node.querySelectorAll('[data-format]').forEach(button => button.addEventListener('click', () => {
      draft.format = button.dataset.format;
      draft.participantIds = [draft.humanTeamId];
      saveDraft(draft); render();
    }));
    node.querySelectorAll('[data-opponent-mode]').forEach(button => button.addEventListener('click', () => {
      draft.opponentMode = button.dataset.opponentMode;
      if (draft.opponentMode === OPPONENT_MODE.RANDOM) draft.participantIds = [draft.humanTeamId];
      saveDraft(draft); render();
    }));
    node.querySelectorAll('[data-remove-team]').forEach(button => button.addEventListener('click', () => {
      draft.participantIds = draft.participantIds.filter(id => id !== button.dataset.removeTeam);
      draft.candidateIndex = 0; saveDraft(draft); render();
    }));
    node.querySelector('[data-candidate-prev]')?.addEventListener('click', () => changeCandidate(-1));
    node.querySelector('[data-candidate-next]')?.addEventListener('click', () => changeCandidate(1));
    node.querySelector('[data-add-candidate]')?.addEventListener('click', addCandidate);
    node.querySelectorAll('[data-trophy-style]').forEach(button => button.addEventListener('click', () => { draft.trophyStyle = button.dataset.trophyStyle; saveDraft(draft); render(); }));
    node.querySelectorAll('[data-trophy-accent]').forEach(button => button.addEventListener('click', () => { draft.trophyAccent = button.dataset.trophyAccent; saveDraft(draft); render(); }));
    node.querySelectorAll('[data-trophy-pattern]').forEach(button => button.addEventListener('click', () => { draft.trophyPattern = button.dataset.trophyPattern; saveDraft(draft); render(); }));
    node.querySelectorAll('[data-match-mode]').forEach(button => button.addEventListener('click', () => { draft.matchMode = button.dataset.matchMode; saveDraft(draft); render(); }));
    node.querySelectorAll('[data-difficulty]').forEach(button => button.addEventListener('click', () => { draft.difficulty = button.dataset.difficulty; saveDraft(draft); render(); }));
    node.querySelector('[data-next]')?.addEventListener('click', () => next('summary'));
  };

  const renderSummary = () => {
    const preset = presetFor(draft.type);
    const pool = usableTeamsForSource(draft.teamSource);
    const human = pool.find(team => team.id === draft.humanTeamId);
    const participants = participantsForDraft(draft);
    const errors = validationErrors(draft);
    const name = safeTournamentName(draft.name, preset.title);

    const start = () => {
      try {
        const state = saveAndVerifyTournament(createConfiguredTournament(draft));
        clearDraft();
        runtime.wizard = null;
        showDrawScene(state, returnPanel);
      } catch (error) {
        console.error('[tournament-experience-v2] A torna nem indítható:', error);
        globalThis.alert?.(error.message || 'A torna nem indítható el.');
      }
    };

    const confirmOverwrite = () => {
      const stored = tournamentStorageService.read();
      if (!stored?.id || stored.status !== TOURNAMENT_STATUS.ACTIVE) { start(); return; }
      node.innerHTML = `${headerMarkup(draft, step)}<section class="tx-section"><p class="eyebrow">Aktív torna</p><h2>Az új torna felülírja a jelenlegi mentést.</h2><div class="tx-summary-grid"><div class="tx-summary-item"><small>Jelenlegi torna</small><strong>${escapeHtml(stored.name)}</strong></div><div class="tx-summary-item"><small>Állapot</small><strong>${escapeHtml(tournamentProgress(stored).percent)}% kész</strong></div></div><p class="tx-warning">A jelenlegi torna eredményei az új torna indítása után nem folytathatók.</p></section><div class="tx-actions"><button class="btn btn--ghost" type="button" data-cancel>Mégse</button><button class="btn" type="button" data-continue-current>Jelenlegi torna folytatása</button><button class="btn btn--danger tx-actions__primary" type="button" data-replace>Új torna indítása</button></div>`;
      node.querySelector('[data-cancel]')?.addEventListener('click', render);
      node.querySelector('[data-continue-current]')?.addEventListener('click', () => {
        runtime.wizard = null;
        globalThis.FociskartyakTournament?.showCenter?.(stored, returnPanel);
      });
      node.querySelector('[data-replace]')?.addEventListener('click', start);
      wireCommon();
    };

    node.innerHTML = `${headerMarkup(draft, step)}${errors.length ? `<p class="tx-warning">${errors.map(escapeHtml).join('<br>')}</p>` : ''}<section class="tx-summary-hero" data-pattern="${escapeHtml(draft.trophyPattern)}">${trophyMarkup(trophyPresentation(draft))}<div><p class="eyebrow">Indítás előtti összefoglaló</p><h2>${escapeHtml(name)}</h2><p>${escapeHtml(preset.description)}</p><div class="tx-summary-grid">${[
      ['Kategória', LOCATION_LABELS[draft.location]],
      ['Sorozat', preset.title],
      ['Saját csapat', human?.label || 'Nincs'],
      ['Résztvevők', `${draft.count} csapat`],
      ['Tornaformátum', formatLabel(draft.format)],
      ['Fordulók', `${estimatedRounds(draft.format, draft.count)}`],
      ['Várható mérkőzések', `${Math.round(estimatedMatches(draft.format, draft.count))}`],
      ['Mérkőzésmód', matchModeLabel(draft.matchMode)],
      ['Nehézség', difficultyLabel(draft.difficulty)],
      ['Ellenfelek', draft.type === 'custom' ? (draft.opponentMode === OPPONENT_MODE.RANDOM ? 'Véletlenszerű' : draft.opponentMode === OPPONENT_MODE.MANUAL ? 'Kézi' : 'Vegyes') : 'Sorozatszabály szerint'],
    ].map(([label, value]) => `<div class="tx-summary-item"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`).join('')}</div></div></section><section class="tx-section"><h2>Résztvevő csapatok</h2><div class="tx-participant-chips">${participants.map(team => `<span class="tx-participant-chip">${escapeHtml(team.label)}</span>`).join('')}</div></section><div class="tx-actions"><button class="btn btn--ghost" type="button" data-back>Vissza és módosítás</button><button class="btn tx-actions__primary" type="button" data-start ${errors.length ? 'disabled' : ''}>Torna indítása</button></div>`;
    node.querySelector('[data-start]')?.addEventListener('click', confirmOverwrite);
  };

  const render = () => {
    node.classList.add('tournament-experience-v2');
    if (step === 'type') renderType();
    else if (step === 'team') renderTeam();
    else if (step === 'custom') renderCustom();
    else renderSummary();
    wireCommon();
    saveDraft(draft);
  };

  render();
  showPanel(node);
}

export { showExperienceWizard };
