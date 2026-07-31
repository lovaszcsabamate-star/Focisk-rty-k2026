/** Többlépcsős tornabeállító folyamat. */

import {
  FLOW_VERSION, MINIMUM_CARDS, TYPE_PRESETS, TOURNAMENT_CATEGORY, TOURNAMENT_FORMAT, TOURNAMENT_MATCH_MODE,
  TOURNAMENT_STATUS, allTeams, closeTournamentLayers, createTournament, difficultyLabel, ensureStyle, escapeHtml, fold,
  formatLabel, makePanel, matchModeLabel, runtime, safeTournamentName, saveAndVerifyTournament,
  selectParticipants, showPanel, stepsFor, teamMark, tournamentStorageService, usableTeams, supportedCounts,
} from './tournament-flow-shared.js';

function wizardHeader(draft, step, exitLabel = 'Kilépés') {
  const steps = stepsFor(draft);
  const current = steps.findIndex(([key]) => key === step);
  return `<header class="tournament-flow__header"><div class="tournament-flow__top"><div><p class="eyebrow">Torna mód</p><h1>${escapeHtml(TYPE_PRESETS[draft.type]?.title || 'Tornaválasztás')}</h1></div><button class="btn btn--ghost tournament-flow__exit" type="button" data-exit>${escapeHtml(exitLabel)}</button></div><div class="tournament-flow__steps" aria-label="Beállítási lépések">${steps.map(([key, label], index) => `<span class="tournament-flow__step ${index === current ? 'is-active' : index < current ? 'is-done' : ''}">${index + 1}. ${escapeHtml(label)}</span>`).join('')}</div></header>`;
}

function initialDraft(type = 'hungarian-league') {
  const preset = TYPE_PRESETS[type] ?? TYPE_PRESETS['hungarian-league'];
  return {
    type: preset.key,
    category: preset.category,
    format: preset.format,
    count: preset.count,
    humanTeamId: '',
    participantIds: [],
    matchMode: TOURNAMENT_MATCH_MODE.CLASSIC,
    difficulty: 'medium',
    lineupMode: 'own',
    name: preset.title,
    search: '',
    teamIndex: 0,
  };
}

function applyPreset(draft, type) {
  const preset = TYPE_PRESETS[type];
  Object.assign(draft, initialDraft(type), { matchMode: draft.matchMode, difficulty: draft.difficulty });
  draft.name = preset.title;
}

function showTournamentWizard(returnPanel, existingDraft = null, initialStep = 'type') {
  ensureStyle();
  const draft = existingDraft ?? initialDraft();
  let step = initialStep;
  const node = makePanel('tournament-flow-wizard');

  const exit = () => {
    runtime.wizard = null;
    if (returnPanel?.isConnected || returnPanel) showPanel(returnPanel);
    else closeTournamentLayers();
  };
  const previous = () => {
    const steps = stepsFor(draft);
    const index = steps.findIndex(([key]) => key === step);
    if (index <= 0) { exit(); return; }
    step = steps[index - 1][0];
    render();
  };
  runtime.wizard = { previous, exit };

  const next = target => { step = target; render(); };

  const renderType = () => {
    node.innerHTML = `${wizardHeader(draft, step, 'Vissza a főmenübe')}<section><p>Válassz egy előre beállított sorozatot, vagy készíts saját tornát.</p><div class="tournament-type-grid">${Object.values(TYPE_PRESETS).map(preset => `<button type="button" class="tournament-type-card ${draft.type === preset.key ? 'is-selected' : ''}" data-type="${preset.key}"><span class="tournament-type-card__icon" aria-hidden="true">${preset.icon}</span><h2>${escapeHtml(preset.title)}</h2><p>${escapeHtml(preset.description)}</p><div class="tournament-type-card__meta"><span>${escapeHtml(preset.system)}</span><span>${escapeHtml(preset.length)}</span></div><span class="btn">Kiválasztás</span></button>`).join('')}</div></section><div class="tournament-flow__actions"><button class="btn btn--ghost" data-exit>Vissza a főmenübe</button><button class="btn" data-next>Csapat kiválasztása</button></div>`;
    node.querySelectorAll('[data-type]').forEach(card => card.addEventListener('click', () => { applyPreset(draft, card.dataset.type); render(); }));
    node.querySelector('[data-next]')?.addEventListener('click', () => next(draft.type === 'custom' ? 'rules' : 'team'));
  };

  const renderRules = () => {
    const available = usableTeams(draft.category).length;
    const counts = supportedCounts(draft.category, draft.format, available);
    if (!counts.includes(draft.count)) draft.count = counts[0] ?? 0;
    node.innerHTML = `${wizardHeader(draft, step)}<section class="tournament-flow__section"><h2>Résztvevők típusa</h2><div class="tournament-choice-grid"><label><input type="radio" name="custom-category" value="${TOURNAMENT_CATEGORY.HUNGARIAN}" ${draft.category === TOURNAMENT_CATEGORY.HUNGARIAN ? 'checked' : ''}><span><b>Magyar klubok</b><small>NB I-es csapatok</small></span></label><label><input type="radio" name="custom-category" value="${TOURNAMENT_CATEGORY.NATIONS}" ${draft.category === TOURNAMENT_CATEGORY.NATIONS ? 'checked' : ''}><span><b>Nemzetek és válogatottak</b><small>Csak elegendő kártyával</small></span></label><label><input type="radio" disabled><span><b>Vegyes mezőny</b><small>Az egységes klub–válogatott domainmodell hiányában nem elérhető.</small></span></label></div></section><section class="tournament-flow__section"><h2>Tornaforma</h2><div class="tournament-choice-grid">${[[TOURNAMENT_FORMAT.LEAGUE,'Liga','Mindenki játszik mindenkivel'],[TOURNAMENT_FORMAT.KNOCKOUT,'Csak kieséses','Egymeccses párharcok'],[TOURNAMENT_FORMAT.GROUP_KNOCKOUT,'Csoport + kieséses','Automatikus csoportbeosztás']].map(([value,title,description]) => `<label><input type="radio" name="custom-format" value="${value}" ${draft.format === value ? 'checked' : ''}><span><b>${title}</b><small>${description}</small></span></label>`).join('')}</div></section><section class="tournament-flow__section"><h2>Résztvevők száma</h2><select data-count>${counts.map(count => `<option value="${count}" ${count === draft.count ? 'selected' : ''}>${count} csapat</option>`).join('')}</select>${draft.format === TOURNAMENT_FORMAT.GROUP_KNOCKOUT ? `<p>Automatikus, érvényes csoportbeosztás · ${Math.max(2,Math.floor(draft.count/4))} csoport · 4 csapat csoportonként · egyszer játszanak egymással. A csoportelsők és a legjobb további csapatok jutnak a ${Math.max(4, 2 ** Math.floor(Math.log2(Math.max(4, draft.count - 1))))} csapatos kieséses szakaszba.</p><p>Holtverseny: pontszám, pontkülönbség, szerzett pont vagy kör, győzelmek, majd stabil sorsolási sorrend.</p>` : ''}<p>A kétmeccses párharc, újrajátszás és harmadik helyért mérkőzés nem jelenik meg, mert a jelenlegi domainmodell nem kezeli ezeket teljes körűen.</p></section><section class="tournament-flow__section"><h2>Saját torna neve</h2><input type="text" maxlength="40" data-name value="${escapeHtml(draft.name)}" placeholder="Saját torna"></section><div class="tournament-flow__actions"><button class="btn btn--ghost" data-back>Vissza</button><button class="btn btn--ghost" data-exit>Kilépés a főmenübe</button><button class="btn" data-next ${draft.count ? '' : 'disabled'}>Csapat kiválasztása</button></div>`;
    node.querySelectorAll('input[name=custom-category]').forEach(input => input.addEventListener('change', () => { draft.category = input.value; draft.humanTeamId = ''; draft.participantIds = []; render(); }));
    node.querySelectorAll('input[name=custom-format]').forEach(input => input.addEventListener('change', () => { draft.format = input.value; draft.participantIds = []; render(); }));
    node.querySelector('[data-count]')?.addEventListener('change', event => { draft.count = Number(event.target.value) || 0; draft.participantIds = []; });
    node.querySelector('[data-name]')?.addEventListener('input', event => { draft.name = event.target.value.slice(0, 40); });
    node.querySelector('[data-next]')?.addEventListener('click', () => next('team'));
  };

  const renderTeam = () => {
    const pool = allTeams(draft.category);
    const usable = pool.filter(team => team.usable && Number(team.count) >= MINIMUM_CARDS);
    if (!usable.length) {
      node.innerHTML = `${wizardHeader(draft, step)}<p class="tournament-flow__warning">Nincs elegendő használható csapat ehhez a tornatípushoz.</p><div class="tournament-flow__actions"><button class="btn" data-back>Vissza</button><button class="btn btn--ghost" data-exit>Kilépés</button></div>`;
      return;
    }
    if (!pool.some(team => team.id === draft.humanTeamId)) draft.humanTeamId = usable[0].id;
    let index = pool.findIndex(team => team.id === draft.humanTeamId);
    if (draft.search) {
      const found = pool.findIndex(team => fold(team.label).includes(fold(draft.search)));
      if (found >= 0) index = found;
    }
    index = Math.max(0, index);
    draft.teamIndex = index;
    const team = pool[index];
    const isUsable = Boolean(team?.usable && Number(team.count) >= MINIMUM_CARDS);
    const cycle = direction => {
      draft.teamIndex = (index + direction + pool.length) % pool.length;
      draft.humanTeamId = pool[draft.teamIndex].id;
      draft.search = '';
      render();
    };
    node.innerHTML = `${wizardHeader(draft, step)}<section class="tournament-flow__section"><div class="tournament-flow__search"><input type="search" data-team-search placeholder="Csapat keresése" value="${escapeHtml(draft.search)}" list="tournament-team-list"><button class="btn btn--ghost" data-search>Megnyitás</button><datalist id="tournament-team-list">${pool.map(item => `<option value="${escapeHtml(item.label)}"></option>`).join('')}</datalist></div><div class="tournament-team-carousel"><button class="btn btn--ghost tournament-carousel-arrow" data-prev aria-label="Előző csapat">‹</button><article class="tournament-team-hero ${isUsable ? '' : 'is-disabled'}">${teamMark(team)}<h2>${escapeHtml(team?.label)}</h2><div class="tournament-team-hero__facts"><span>${Number(team?.count)||0} játékoskártya</span><span class="${isUsable ? 'is-ok' : 'is-warning'}">Minimum: ${MINIMUM_CARDS} · ${isUsable ? 'használható' : 'nem választható'}</span><span>${draft.category === TOURNAMENT_CATEGORY.HUNGARIAN ? 'Magyar klub' : 'Válogatott / régió'}</span></div>${isUsable ? '<p>Koppints a jelvényre vagy használd a Tovább gombot.</p>' : '<p class="tournament-flow__warning">Ehhez a csapathoz nincs elegendő játékoskártya.</p>'}</article><button class="btn btn--ghost tournament-carousel-arrow" data-next-team aria-label="Következő csapat">›</button></div><div style="display:flex;justify-content:center"><button class="btn tournament-random-ball" data-random aria-label="Véletlen csapat">⚽</button></div></section><div class="tournament-flow__actions"><button class="btn btn--ghost" data-back>Vissza</button><button class="btn btn--ghost" data-exit>Kilépés a főmenübe</button><button class="btn" data-next ${isUsable ? '' : 'disabled'}>Tovább</button></div>`;
    node.querySelector('[data-prev]')?.addEventListener('click', () => cycle(-1));
    node.querySelector('[data-next-team]')?.addEventListener('click', () => cycle(1));
    node.querySelector('[data-random]')?.addEventListener('click', () => { const chosen = usable[Math.floor(Math.random() * usable.length)]; draft.humanTeamId = chosen.id; draft.search = ''; render(); });
    node.querySelector('[data-select-current-team]')?.addEventListener('click', () => { if (isUsable) next(draft.type === 'custom' ? 'field' : 'settings'); });
    const search = node.querySelector('[data-team-search]');
    const applySearch = () => { draft.search = search?.value ?? ''; const found = pool.find(item => fold(item.label).includes(fold(draft.search))); if (found) draft.humanTeamId = found.id; render(); };
    search?.addEventListener('change', applySearch);
    node.querySelector('[data-search]')?.addEventListener('click', applySearch);
    node.querySelector('[data-next]')?.addEventListener('click', () => next(draft.type === 'custom' ? 'field' : 'settings'));
  };

  const renderField = () => {
    const pool = usableTeams(draft.category);
    const human = pool.find(team => team.id === draft.humanTeamId);
    if (!human) { next('team'); return; }
    const validIds = draft.participantIds.filter(id => pool.some(team => team.id === id));
    if (!validIds.length || !validIds.includes(human.id)) {
      draft.participantIds = selectParticipants(pool, draft.count, human.id).map(team => team.id);
    } else {
      const unique = [human.id, ...validIds.filter(id => id !== human.id)];
      draft.participantIds = unique.slice(0, draft.count);
    }
    const current = new Set(draft.participantIds);
    const toggle = (id, checked) => {
      if (id === human.id) return;
      if (checked && current.size < draft.count) current.add(id);
      if (!checked) current.delete(id);
      draft.participantIds = [...current];
      render();
    };
    node.innerHTML = `${wizardHeader(draft, step)}<section class="tournament-flow__section"><h2>Résztvevő csapatok</h2><p><b>${current.size}/${draft.count}</b> csapat kiválasztva. A saját csapat mindig a mezőnyben marad.</p><button class="btn btn--ghost" data-redraw>⚽ Ellenfelek újrasorsolása</button><div class="tournament-field-list">${pool.map(team => `<label class="tournament-field-team"><input type="checkbox" data-field-team="${escapeHtml(team.id)}" ${current.has(team.id) ? 'checked' : ''} ${team.id === human.id ? 'disabled' : ''}><span><b>${escapeHtml(team.label)}</b><small style="display:block">${team.count} kártya${team.id === human.id ? ' · saját csapat' : ''}</small></span></label>`).join('')}</div></section><div class="tournament-flow__actions"><button class="btn btn--ghost" data-back>Vissza</button><button class="btn btn--ghost" data-exit>Kilépés</button><button class="btn" data-next ${current.size === draft.count ? '' : 'disabled'}>Beállítások</button></div>`;
    node.querySelector('[data-redraw]')?.addEventListener('click', () => { draft.participantIds = selectParticipants(pool, draft.count, human.id).map(team => team.id); render(); });
    node.querySelectorAll('[data-field-team]').forEach(input => input.addEventListener('change', () => toggle(input.dataset.fieldTeam, input.checked)));
    node.querySelector('[data-next]')?.addEventListener('click', () => next('settings'));
  };

  const renderSettings = () => {
    const preset = TYPE_PRESETS[draft.type];
    const available = usableTeams(draft.category).length;
    const allowedSizes = preset.sizes.filter(size => size <= available);
    if (draft.type === 'world-cup' && !allowedSizes.includes(draft.count)) draft.count = allowedSizes[0] ?? 0;
    node.innerHTML = `${wizardHeader(draft, step)}${draft.type === 'world-cup' ? `<section class="tournament-flow__section"><h2>Világkupa mérete</h2><select data-world-size>${allowedSizes.map(size => `<option value="${size}" ${size === draft.count ? 'selected' : ''}>${size} résztvevő</option>`).join('')}</select></section>` : ''}<section class="tournament-flow__section"><h2>Mérkőzésmód</h2><div class="tournament-choice-grid"><label><input type="radio" name="match-mode" value="${TOURNAMENT_MATCH_MODE.CLASSIC}" ${draft.matchMode === TOURNAMENT_MATCH_MODE.CLASSIC ? 'checked' : ''}><span><b>Klasszikus</b><small>Kártyás összehasonlító meccs</small></span></label><label><input type="radio" name="match-mode" value="${TOURNAMENT_MATCH_MODE.PENALTIES}" ${draft.matchMode === TOURNAMENT_MATCH_MODE.PENALTIES ? 'checked' : ''}><span><b>Büntetőpárbaj</b><small>Gyors, 11 lapos párbaj</small></span></label></div></section><section class="tournament-flow__section"><h2>Nehézség</h2><div class="tournament-choice-grid">${[['easy','Könnyű'],['medium','Normál'],['hard','Nehéz']].map(([value,label]) => `<label><input type="radio" name="difficulty" value="${value}" ${draft.difficulty === value ? 'checked' : ''}><span><b>${label}</b></span></label>`).join('')}</div></section><section class="tournament-flow__section"><h2>Keretválasztás</h2><div class="tournament-choice-grid"><label><input type="radio" name="lineup" value="own" ${draft.lineupMode === 'own' ? 'checked' : ''}><span><b>Saját keret</b><small>Minden saját meccs előtt te választasz.</small></span></label><label><input type="radio" name="lineup" value="random" ${draft.lineupMode === 'random' ? 'checked' : ''}><span><b>Véletlenszerű keret</b><small>A rendszer automatikusan választ 11 lapot.</small></span></label></div></section><section class="tournament-flow__section"><h2>Automatikus szimuláció</h2><label><input type="checkbox" checked disabled> A gépi mérkőzések automatikusan lezáródnak a forduló frissítésekor.</label></section><div class="tournament-flow__actions"><button class="btn btn--ghost" data-back>Vissza</button><button class="btn btn--ghost" data-exit>Kilépés</button><button class="btn" data-next ${draft.count ? '' : 'disabled'}>Összefoglaló</button></div>`;
    node.querySelector('[data-world-size]')?.addEventListener('change', event => { draft.count = Number(event.target.value) || draft.count; });
    node.querySelectorAll('input[name=match-mode]').forEach(input => input.addEventListener('change', () => { draft.matchMode = input.value; }));
    node.querySelectorAll('input[name=difficulty]').forEach(input => input.addEventListener('change', () => { draft.difficulty = input.value; }));
    node.querySelectorAll('input[name=lineup]').forEach(input => input.addEventListener('change', () => { draft.lineupMode = input.value; }));
    node.querySelector('[data-next]')?.addEventListener('click', () => next('summary'));
  };

  const estimatedMatches = () => {
    if (draft.format === TOURNAMENT_FORMAT.LEAGUE) return draft.count * (draft.count - 1) / 2;
    if (draft.format === TOURNAMENT_FORMAT.KNOCKOUT) return draft.count === 12 ? 11 : Math.max(0, draft.count - 1);
    const groupSize = 4;
    const groups = Math.max(2, draft.count / groupSize);
    const knockoutTeams = Math.max(4, 2 ** Math.floor(Math.log2(Math.max(4, draft.count - 1))));
    return groups * (groupSize * (groupSize - 1) / 2) + knockoutTeams - 1;
  };
  const estimatedHumanMatches = () => {
    if (draft.format === TOURNAMENT_FORMAT.LEAGUE) return Math.max(1, draft.count - 1);
    if (draft.format === TOURNAMENT_FORMAT.KNOCKOUT) return draft.count === 12 ? 4 : Math.max(2, Math.log2(draft.count));
    const knockoutTeams = Math.max(4, 2 ** Math.floor(Math.log2(Math.max(4, draft.count - 1))));
    return 3 + Math.log2(knockoutTeams);
  };

  const createConfiguredTournament = () => {
    const pool = usableTeams(draft.category);
    const participants = selectParticipants(pool, draft.count, draft.humanTeamId, draft.participantIds);
    if (participants.length !== draft.count) throw new Error('Nincs elegendő használható, különböző csapat.');
    const fallbackName = TYPE_PRESETS[draft.type]?.title ?? 'Saját torna';
    const base = createTournament({
      name: safeTournamentName(draft.name, fallbackName), category: draft.category, format: draft.format,
      matchMode: draft.matchMode, participants, humanTeamId: draft.humanTeamId, difficulty: draft.difficulty,
    });
    return {
      ...base,
      tournamentType: draft.type,
      setupVersion: FLOW_VERSION,
      configuration: {
        lineupMode: draft.lineupMode,
        autoSimulateAi: true,
        participantCount: draft.count,
        lockedStructure: draft.type !== 'custom',
      },
    };
  };

  const openCenter = state => {
    runtime.wizard = null;
    const api = globalThis.FociskartyakTournament;
    if (typeof api?.showCenter !== 'function') throw new Error('A tornaközpont nem érhető el.');
    api.showCenter(state, returnPanel);
  };

  const confirmOverwrite = start => {
    const stored = tournamentStorageService.read();
    node.innerHTML = `${wizardHeader(draft, 'summary')}<section class="tournament-overwrite"><p class="eyebrow">Aktív torna</p><h2>Már van egy folyamatban lévő tornád.</h2><p>Az új torna indításával a jelenlegi torna mentése felülíródik.</p><div class="tournament-summary"><div class="tournament-summary__item"><small>Jelenlegi torna</small><strong>${escapeHtml(stored?.name)}</strong></div><div class="tournament-summary__item"><small>Állapot</small><strong>${stored?.status === TOURNAMENT_STATUS.ACTIVE ? 'Folyamatban' : 'Befejezett'}</strong></div></div><div class="tournament-flow__actions"><button class="btn" data-continue-current>Jelenlegi torna folytatása</button><button class="btn btn--danger" data-replace>Új torna indítása</button><button class="btn btn--ghost" data-cancel>Mégse</button></div></section>`;
    node.querySelector('[data-continue-current]')?.addEventListener('click', () => openCenter(stored));
    node.querySelector('[data-replace]')?.addEventListener('click', start);
    node.querySelector('[data-cancel]')?.addEventListener('click', render);
  };

  const renderSummary = () => {
    const pool = usableTeams(draft.category);
    const human = pool.find(team => team.id === draft.humanTeamId);
    const participants = selectParticipants(pool, draft.count, draft.humanTeamId, draft.participantIds);
    const errors = [];
    if (!human) errors.push('Nincs kiválasztott használható saját csapat.');
    if (participants.length !== draft.count) errors.push('A résztvevők száma nem érvényes.');
    if (new Set(participants.map(team => team.id)).size !== participants.length) errors.push('Ugyanaz a csapat többször szerepel.');
    const start = () => {
      try {
        const state = saveAndVerifyTournament(createConfiguredTournament());
        openCenter(state);
      } catch (error) {
        console.error('[tournament-flow] A torna nem indítható:', error);
        alert(error.message || 'A torna nem indítható el.');
      }
    };
    node.innerHTML = `${wizardHeader(draft, step)}${errors.length ? `<p class="tournament-flow__warning">${errors.map(escapeHtml).join('<br>')}</p>` : ''}<section class="tournament-flow__section"><h2>Indítás előtti összefoglaló</h2><div class="tournament-summary">${[
      ['Torna neve', safeTournamentName(draft.name, TYPE_PRESETS[draft.type].title)],
      ['Tornatípus', TYPE_PRESETS[draft.type].title], ['Saját csapat', human?.label || 'Nincs'],
      ['Résztvevők', `${draft.count} csapat`], ['Játékrendszer', formatLabel(draft.format)],
      ['Mérkőzésmód', matchModeLabel(draft.matchMode)], ['Nehézség', difficultyLabel(draft.difficulty)],
      ['Keret', draft.lineupMode === 'random' ? 'Véletlenszerű keret' : 'Saját keret'],
      ['Becsült mérkőzésszám', `${Math.round(estimatedMatches())}`],
      ['Várható játékidő', `${Math.max(10,Math.round(estimatedHumanMatches() * (draft.matchMode === TOURNAMENT_MATCH_MODE.PENALTIES ? 3 : 8)))}–${Math.max(20,Math.round(estimatedHumanMatches() * (draft.matchMode === TOURNAMENT_MATCH_MODE.PENALTIES ? 5 : 12)))} perc`],
    ].map(([label,value]) => `<div class="tournament-summary__item"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`).join('')}</div></section><div class="tournament-flow__actions"><button class="btn btn--ghost" data-back>Vissza</button><button class="btn btn--ghost" data-exit>Kilépés</button><button class="btn" data-start ${errors.length ? 'disabled' : ''}>Torna indítása</button></div>`;
    node.querySelector('[data-start]')?.addEventListener('click', () => {
      const stored = tournamentStorageService.read();
      if (stored?.status === TOURNAMENT_STATUS.ACTIVE) confirmOverwrite(start);
      else start();
    });
  };

  const render = () => {
    if (step === 'type') renderType();
    else if (step === 'rules') renderRules();
    else if (step === 'team') renderTeam();
    else if (step === 'field') renderField();
    else if (step === 'settings') renderSettings();
    else renderSummary();
    node.querySelectorAll('[data-back]').forEach(button => button.addEventListener('click', previous));
    node.querySelectorAll('[data-exit]').forEach(button => button.addEventListener('click', exit));
  };

  render();
  showPanel(node);
}

export { showTournamentWizard };
