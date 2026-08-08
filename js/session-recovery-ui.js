/** Beta Stabilization 1.2 – központi, felhasználó által indítható recovery panel. */

import {
  QUICK_MATCH_INFLIGHT_STORAGE_KEY,
  clearQuickMatchLaunch,
} from './services/quick-match-storage-service.js';
import { rollbackPendingTournamentLaunch } from './services/tournament-storage-service.js';
import { SESSION_RECOVERY_LINEUP_STORAGE_KEY } from './services/session-recovery-service.js';
import { storageService } from './services/storage-service.js';

const RECOVERY_PANEL_ID = 'session-recovery-panel-v1';
const RECOVERY_STYLE_ID = 'session-recovery-style-v1';
const RECOVERY_EVENT = 'fociskartyak:recovery-needed';

const ensureRecoveryStyles = () => {
  if (typeof document === 'undefined' || document.getElementById(RECOVERY_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = RECOVERY_STYLE_ID;
  style.textContent = `
    .session-recovery-layer{position:fixed;z-index:14000;inset:0;display:grid;place-items:center;padding:max(16px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) max(16px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));background:rgba(7,6,5,.86);backdrop-filter:blur(5px)}
    .session-recovery-card{width:min(520px,100%);display:grid;gap:14px;padding:clamp(20px,5vw,32px);border:1px solid rgba(243,196,92,.45);border-radius:22px;background:linear-gradient(145deg,rgba(48,34,22,.99),rgba(16,13,10,.99));box-shadow:0 24px 72px rgba(0,0,0,.62);color:#fff7df;text-align:center}
    .session-recovery-icon{font-size:2rem}.session-recovery-card h1{margin:0;font-size:clamp(1.35rem,5vw,1.85rem)}.session-recovery-card p{margin:0;color:#d8c9b0;line-height:1.5}
    .session-recovery-actions{display:grid;gap:9px}.session-recovery-actions button{min-height:48px;width:100%}.session-recovery-actions .btn--ghost{opacity:.9}
    .session-recovery-card:focus-visible,.session-recovery-actions button:focus-visible{outline:3px solid #fff3bd;outline-offset:3px}
    @media(max-width:360px){.session-recovery-layer{padding:10px}.session-recovery-card{padding:18px 14px;border-radius:18px}}
    @media(prefers-reduced-motion:reduce){.session-recovery-layer *{animation:none!important;transition:none!important}}
  `;
  document.head?.appendChild(style);
};

const clearTransientLaunchState = () => {
  let ok = true;
  try { if (!clearQuickMatchLaunch()) ok = false; } catch { ok = false; }
  try { if (!storageService.remove(QUICK_MATCH_INFLIGHT_STORAGE_KEY)) ok = false; } catch { ok = false; }
  try { if (!rollbackPendingTournamentLaunch()) ok = false; } catch { ok = false; }
  try { if (!storageService.remove(SESSION_RECOVERY_LINEUP_STORAGE_KEY)) ok = false; } catch { ok = false; }
  return ok;
};

const reloadSafely = () => {
  try {
    globalThis.location?.reload?.();
    return true;
  } catch {
    return false;
  }
};

const navigateHomeSafely = () => {
  clearTransientLaunchState();
  try {
    const target = new URL('./index.html', globalThis.location?.href ?? document.baseURI).href;
    globalThis.location?.assign?.(target);
    return true;
  } catch {
    return reloadSafely();
  }
};

const showRecoveryPanel = ({ detail = '', reason = 'runtime' } = {}) => {
  if (typeof document === 'undefined') return false;
  ensureRecoveryStyles();
  const existing = document.getElementById(RECOVERY_PANEL_ID);
  if (existing) {
    existing.querySelector('#session-recovery-primary')?.focus?.({ preventScroll: true });
    return false;
  }

  const layer = document.createElement('div');
  layer.id = RECOVERY_PANEL_ID;
  layer.className = 'session-recovery-layer';
  layer.setAttribute('role', 'alertdialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-labelledby', 'session-recovery-title');
  layer.setAttribute('aria-describedby', 'session-recovery-copy');
  layer.dataset.reason = String(reason || 'runtime');

  const card = document.createElement('section');
  card.className = 'session-recovery-card';
  card.tabIndex = -1;

  const icon = document.createElement('div');
  icon.className = 'session-recovery-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '⚠';

  const title = document.createElement('h1');
  title.id = 'session-recovery-title';
  title.textContent = 'A játékfolyamat megszakadt';

  const copy = document.createElement('p');
  copy.id = 'session-recovery-copy';
  copy.textContent = detail
    ? `Az utolsó konzisztens játékállás megmaradt. ${detail}`
    : 'Az utolsó konzisztens játékállás megmaradt. A játék biztonságosan helyreállítható.';

  const actions = document.createElement('div');
  actions.className = 'session-recovery-actions';
  const recover = document.createElement('button');
  recover.id = 'session-recovery-primary';
  recover.type = 'button';
  recover.className = 'btn';
  recover.textContent = 'Játék helyreállítása';
  recover.setAttribute('aria-label', 'Játék helyreállítása az utolsó mentett állapotból');
  recover.addEventListener('click', () => {
    recover.disabled = true;
    recover.setAttribute('aria-disabled', 'true');
    reloadSafely();
  }, { once: true });

  const home = document.createElement('button');
  home.type = 'button';
  home.className = 'btn btn--ghost';
  home.textContent = 'Vissza a főmenübe';
  home.addEventListener('click', () => {
    home.disabled = true;
    navigateHomeSafely();
  }, { once: true });

  actions.append(recover, home);
  card.append(icon, title, copy, actions);
  layer.appendChild(card);
  document.body.appendChild(layer);
  recover.focus?.({ preventScroll: true });
  return true;
};

const hideRecoveryPanel = () => {
  document.getElementById(RECOVERY_PANEL_ID)?.remove();
  return true;
};

const runtimeErrorHandler = event => showRecoveryPanel({
  reason: 'runtime-error',
  detail: event?.message ? 'Egy váratlan kezelőfelületi hiba történt.' : '',
});
const rejectionHandler = () => showRecoveryPanel({
  reason: 'async-error',
  detail: 'Egy aszinkron játéklépés nem fejeződött be.',
});
const requestedRecoveryHandler = event => showRecoveryPanel({
  reason: event?.detail?.reason ?? 'requested',
  detail: event?.detail?.message ?? '',
});

if (typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('error', runtimeErrorHandler);
  globalThis.addEventListener('unhandledrejection', rejectionHandler);
  globalThis.addEventListener(RECOVERY_EVENT, requestedRecoveryHandler);
}

globalThis.__FOCISKARTYAK_RECOVERY_UI__ = Object.freeze({
  show: showRecoveryPanel,
  hide: hideRecoveryPanel,
  recover: reloadSafely,
  returnHome: navigateHomeSafely,
  eventName: RECOVERY_EVENT,
});

export { RECOVERY_EVENT, hideRecoveryPanel, showRecoveryPanel };
