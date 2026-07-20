const pwaIsNative = Boolean(globalThis.Capacitor?.isNativePlatform?.()) || window.location.protocol === 'capacitor:';

const pwaState = {
  deferredPrompt: null,
  installed: pwaIsNative || window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true,
};

const pwaIsIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
const pwaIsMobile = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
const pwaCanRun = !pwaIsNative && ['http:', 'https:'].includes(window.location.protocol);

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
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(error => {
      console.warn('A mobiljáték offline módja nem indult el:', error);
    });
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
