/** Gyors meccs kártyakattintás, súgó és focilabdás véletlenválasztó. */

const QUICK_MATCH_CARD_CONTROLS_INSTRUCTION = 'Lapozz a csapatok között, majd válassz klubcsapatot, válogatottat vagy föderációs csapatot.';
const QUICK_MATCH_CARD_CONTROLS_SELECTOR = '.deck-selector__body';
const QUICK_MATCH_CARD_CONTROLS_PLAYER_STEP = 'player-team';
const QUICK_MATCH_CARD_CONTROLS_ROLL_DURATION = 680;

const quickMatchCardControlsSchedule = callback => (
  globalThis.requestAnimationFrame?.(callback) ?? globalThis.setTimeout?.(callback, 0)
);

const quickMatchCardControlsCreateDot = documentRef => {
  const dot = documentRef.createElement('span');
  dot.className = 'quick-random-team__dot';
  return dot;
};

const quickMatchCardControlsBuildRandomButton = button => {
  if (!button || button.dataset.quickMatchBallReady === 'true') return;
  const documentRef = button.ownerDocument ?? globalThis.document;
  if (!documentRef) return;

  const ball = documentRef.createElement('span');
  ball.className = 'quick-random-team__ball';
  ball.setAttribute('aria-hidden', 'true');

  const die = documentRef.createElement('span');
  die.className = 'quick-random-team__die';
  die.append(
    quickMatchCardControlsCreateDot(documentRef),
    quickMatchCardControlsCreateDot(documentRef),
    quickMatchCardControlsCreateDot(documentRef),
    quickMatchCardControlsCreateDot(documentRef),
    quickMatchCardControlsCreateDot(documentRef),
  );
  ball.appendChild(die);

  const label = documentRef.createElement('span');
  label.className = 'quick-random-team__label';
  label.textContent = 'VÉLETLEN CSAPAT';

  button.replaceChildren(ball, label);
  button.setAttribute('aria-label', 'Véletlen csapat választása az aktív kategóriából');
  button.dataset.quickMatchBallReady = 'true';
  button.addEventListener('click', () => {
    button.classList.remove('is-rolling');
    void button.offsetWidth;
    button.classList.add('is-rolling');
    globalThis.setTimeout?.(() => button.classList.remove('is-rolling'), QUICK_MATCH_CARD_CONTROLS_ROLL_DURATION);
  });
};

const quickMatchCardControlsCloseHelp = body => {
  const toggle = body?.querySelector?.('.quick-match-help-toggle');
  const popover = body?.querySelector?.('.quick-match-help-popover');
  if (!toggle || !popover) return;
  toggle.setAttribute('aria-expanded', 'false');
  popover.hidden = true;
};

const quickMatchCardControlsBuildHelp = body => {
  if (!body || body.dataset.quickMatchHelpReady === 'true') return;
  const documentRef = body.ownerDocument ?? globalThis.document;
  const headingCopy = body.querySelector?.('.deck-selector__heading-copy');
  const heading = headingCopy?.querySelector?.('#deck-selector-title');
  const lead = headingCopy?.querySelector?.('.deck-selector__lead');
  if (!documentRef || !headingCopy || !heading || !lead) return;

  const row = documentRef.createElement('div');
  row.className = 'quick-match-heading-row';
  heading.before(row);
  row.appendChild(heading);

  const toggle = documentRef.createElement('button');
  toggle.type = 'button';
  toggle.className = 'quick-match-help-toggle';
  toggle.textContent = '?';
  toggle.setAttribute('aria-label', 'Csapatválasztási útmutató megnyitása');
  toggle.setAttribute('aria-expanded', 'false');

  const popover = documentRef.createElement('div');
  const popoverId = `quick-match-help-${Math.random().toString(36).slice(2, 9)}`;
  popover.id = popoverId;
  popover.className = 'quick-match-help-popover';
  popover.setAttribute('role', 'tooltip');
  popover.textContent = QUICK_MATCH_CARD_CONTROLS_INSTRUCTION;
  popover.hidden = true;
  toggle.setAttribute('aria-controls', popoverId);

  row.appendChild(toggle);
  row.after(popover);
  lead.dataset.quickMatchInstruction = 'true';

  toggle.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const willOpen = popover.hidden;
    popover.hidden = !willOpen;
    toggle.setAttribute('aria-expanded', String(willOpen));
  });

  documentRef.addEventListener('pointerdown', event => {
    if (popover.hidden || toggle.contains(event.target) || popover.contains(event.target)) return;
    quickMatchCardControlsCloseHelp(body);
  }, true);

  body.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || popover.hidden) return;
    event.preventDefault();
    quickMatchCardControlsCloseHelp(body);
    toggle.focus?.({ preventScroll: true });
  });

  body.dataset.quickMatchHelpReady = 'true';
};

const quickMatchCardControlsConfirmSelection = body => {
  if (!body || body.dataset.step !== QUICK_MATCH_CARD_CONTROLS_PLAYER_STEP) return false;
  const confirm = body.querySelector?.('.quick-player-controls .deck-selector__primary');
  if (!confirm || confirm.disabled) return false;
  confirm.click?.();
  return true;
};

const quickMatchCardControlsBindCard = body => {
  const card = body?.querySelector?.('.quick-team-card');
  const stage = body?.querySelector?.('.quick-carousel__stage');
  if (!card || !stage) return;

  card.classList.add('is-selectable');
  card.setAttribute('aria-keyshortcuts', 'Enter Space');
  card.title = 'Koppints a csapat kiválasztásához';

  if (card.dataset.quickMatchSelectBound === 'true') return;
  let pointerStart = null;
  let suppressClick = false;

  stage.addEventListener('pointerdown', event => {
    pointerStart = { x: Number(event.clientX), y: Number(event.clientY) };
    suppressClick = false;
  }, true);

  stage.addEventListener('pointerup', event => {
    if (!pointerStart) return;
    const distanceX = Number(event.clientX) - pointerStart.x;
    const distanceY = Number(event.clientY) - pointerStart.y;
    pointerStart = null;
    suppressClick = Math.abs(distanceX) > 18 || Math.abs(distanceY) > 18;
    if (suppressClick) globalThis.setTimeout?.(() => { suppressClick = false; }, 0);
  }, true);

  stage.addEventListener('pointercancel', () => {
    pointerStart = null;
    suppressClick = true;
    globalThis.setTimeout?.(() => { suppressClick = false; }, 0);
  }, true);

  card.addEventListener('click', event => {
    if (suppressClick || body.dataset.step !== QUICK_MATCH_CARD_CONTROLS_PLAYER_STEP) return;
    event.preventDefault();
    card.classList.remove('is-confirming');
    void card.offsetWidth;
    card.classList.add('is-confirming');
    quickMatchCardControlsConfirmSelection(body);
  });

  card.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    quickMatchCardControlsConfirmSelection(body);
  });

  card.addEventListener('animationend', () => card.classList.remove('is-confirming'));
  card.dataset.quickMatchSelectBound = 'true';
};

const quickMatchCardControlsEnhanceBody = body => {
  if (!body) return;
  quickMatchCardControlsBuildHelp(body);
  quickMatchCardControlsBindCard(body);
  quickMatchCardControlsBuildRandomButton(body.querySelector?.('.quick-random-team'));
  if (body.dataset.step !== QUICK_MATCH_CARD_CONTROLS_PLAYER_STEP) quickMatchCardControlsCloseHelp(body);
};

export function installQuickMatchCardControls(documentRef = globalThis.document ?? null) {
  if (!documentRef) return () => {};
  const enhance = () => documentRef.querySelectorAll?.(QUICK_MATCH_CARD_CONTROLS_SELECTOR)
    ?.forEach?.(quickMatchCardControlsEnhanceBody);
  let framePending = false;
  const scheduleEnhance = () => {
    if (framePending) return;
    framePending = true;
    quickMatchCardControlsSchedule(() => {
      framePending = false;
      enhance();
    });
  };
  const Observer = globalThis.MutationObserver;
  const observer = typeof Observer === 'function'
    ? new Observer(scheduleEnhance)
    : null;
  const start = () => {
    enhance();
    observer?.observe?.(documentRef.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-step', 'aria-label', 'disabled'],
    });
  };

  if (documentRef.readyState === 'loading') documentRef.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  return () => {
    documentRef.removeEventListener?.('DOMContentLoaded', start);
    observer?.disconnect?.();
  };
}

if (globalThis.__FOCISKARTYAK_QUICK_MATCH_CARD_CONTROLS__ !== true) {
  globalThis.__FOCISKARTYAK_QUICK_MATCH_CARD_CONTROLS__ = true;
  installQuickMatchCardControls();
}
