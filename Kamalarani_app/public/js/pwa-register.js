// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registered:', reg.scope);
      })
      .catch((err) => {
        console.error('[PWA] Service Worker registration failed:', err);
      });
  });
}

// PWA Install Helper
let deferredPrompt = null;

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

document.addEventListener('DOMContentLoaded', () => {
  const installBtn = document.getElementById('pwaInstallBtn');
  if (!installBtn) return;

  // Don't show button if app is already running as standalone PWA
  if (isStandalone) {
    installBtn.style.display = 'none';
    return;
  }

  // Handle Android / Desktop Chrome / Edge prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'inline-flex';
  });

  // iOS Safari detection & click behavior
  if (isIOS && !isStandalone) {
    installBtn.style.display = 'inline-flex';
  }

  installBtn.addEventListener('click', () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('[PWA] User accepted installation');
          installBtn.style.display = 'none';
        }
        deferredPrompt = null;
      });
    } else if (isIOS) {
      alert("📱 To install KF CMS app on iPhone/iPad:\n\n1. Tap the Share button at the bottom of Safari (Square with up arrow)\n2. Scroll down and tap 'Add to Home Screen'\n3. Tap 'Add' in the top right.");
    } else {
      alert("📱 To install KF CMS app:\n\nTap your browser's menu (3 dots) and select 'Add to Home Screen' or 'Install App'.");
    }
  });
});
