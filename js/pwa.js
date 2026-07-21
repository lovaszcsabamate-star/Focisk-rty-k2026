const pwaIsNative = Boolean(globalThis.Capacitor?.isNativePlatform?.()) || window.location.protocol === 'capacitor:';

const pwaState = {
  deferredPrompt: null,
  installed: pwaIsNative || window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true,
  updateNoticeShown: false,
};

const pwaIsIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
const pwaIsMobile = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
const pwaCanRun = !pwaIsNative && ['http:', 'https:'].includes(window.location.protocol);
const pwaHadController = Boolean(navigator.serviceWorker?.controller);

function pwaCloseGuide() {
  document.querySelector('#pwa-install-guide')?.remove();
}

function pwaShowGuide() {
  pwaCloseGuide();
  const layer = document.createElement('div');
  layer.id = 'pwa-install-guide';
  layer.className = 'pwa-install-guide';
  layer.innerHTML = `
    <section class="pwa-install-guide__panel" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title">
      <button class="pwa-install-guide__close" type="button" aria-label="Bezárás">×</button>
      <div class="pwa-install-guide__icon">⚽</div>
      <h2 id="pwa-install-title">Telepítsd a Fociskártyákat</h2>
      <p>${pwaIsIos
        ? 'Nyisd meg Safariban, koppints a Megosztás gombra, majd válaszd a „Főképernyőhöz adás” lehetőséget.'
        : 'Nyisd meg a böngésző menüjét, majd válaszd az „Alkalmazás telepítése” vagy a „Hozzáadás a kezdőképernyőhöz” lehetőséget.'}</p>
      <ol>
        <li>A játék ikonja megjelenik a telefonodon.</li>
        <li>Teljes képernyőn, böngészősáv nélkül indul.</li>
        <li>Az első betöltés után internet nélkül is játszható.</li>
      </ol>
      <button class="btn pwa-install-guide__done" type="button">Értem</button>
    </section>`;
  layer.addEventListener('click', event => {
    if (event.target === layer || event.target.closest('.pwa-install-guide__close, .pwa-install-guide__done')) {
      pwaCloseGuide();
    }
  });
  document.body.appendChild(layer);
}

function pwaShowUpdateNotice() {
  if (pwaState.updateNoticeShown || document.querySelector('#pwa-update-notice')) return;
  pwaState.updateNoticeShown = true;

  const notice = document.createElement('section');
  notice.id = 'pwa-update-notice';
  notice.className = 'pwa-update-notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  notice.innerHTML = `
    <div class="pwa-update-notice__copy">
      <strong>Új játékverzió érhető el</strong>
      <span>A folyamatban lévő mérkőzés mentése után frissíthető.</span>
    </div>
    <div class="pwa-update-notice__actions">
      <button class="btn pwa-update-notice__reload" type="button">Frissítés</button>
      <button class="btn btn--ghost pwa-update-notice__later" type="button">Később</button>
    </div>`;

  notice.querySelector('.pwa-update-notice__reload')?.addEventListener('click', () => {
    notice.querySelectorAll('button').forEach(button => { button.disabled = true; });
    location.reload();
  }, { once: true });
  notice.querySelector('.pwa-update-notice__later')?.addEventListener('click', () => {
    notice.remove();
  }, { once: true });

  document.body.appendChild(notice);
  notice.querySelector('.pwa-update-notice__reload')?.focus({ preventScroll: true });
}

async function pwaInstall() {
  if (pwaState.deferredPrompt) {
    const promptEvent = pwaState.deferredPrompt;
    pwaState.deferredPrompt = null;
    promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome !== 'accepted') pwaEnsureInstallButton();
    return;
  }
  pwaShowGuide();
}

function pwaEnsureInstallButton() {
  const host = document.querySelector('#hud-settings');
  if (!host || pwaState.installed || !pwaCanRun || !pwaIsMobile) return;
  if (host.querySelector('[data-pwa-install]')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-toggle pwa-install-button';
  button.dataset.pwaInstall = 'true';
  button.textContent = '⬇ Telepítés';
  button.title = 'Játék telepítése a telefonra';
  button.addEventListener('click', pwaInstall);
  host.appendChild(button);
}

if (pwaCanRun && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js');
      const requestUpdate = () => registration.update().catch(() => {});

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') requestUpdate();
      });
      window.setInterval(requestUpdate, 30 * 60 * 1000);
    } catch (error) {
      console.warn('A mobiljáték offline módja nem indult el:', error);
    }
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (pwaHadController) pwaShowUpdateNotice();
  });
}

window.addEventListener('beforeinstallprompt', event => {
  if (pwaIsNative) return;
  event.preventDefault();
  pwaState.deferredPrompt = event;
  pwaEnsureInstallButton();
});

window.addEventListener('appinstalled', () => {
  pwaState.installed = true;
  pwaState.deferredPrompt = null;
  document.querySelector('[data-pwa-install]')?.remove();
  pwaCloseGuide();
});

const pwaSettingsObserver = new MutationObserver(() => pwaEnsureInstallButton());
const pwaStart = () => {
  const host = document.querySelector('#hud-settings');
  if (host) pwaSettingsObserver.observe(host, { childList: true });
  pwaEnsureInstallButton();
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pwaStart, { once: true });
else pwaStart();
