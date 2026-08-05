const CACHE_NAME = 'contas-a-pagar-v16';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './firebase-config.js',
  './manifest.json',
  './icon-32.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
];

// ---------- Notificações push (Firebase Cloud Messaging) ----------
// Totalmente opcional e isolado em try/catch: se a VAPID key ainda não
// foi configurada, ou o navegador não suportar, isso simplesmente não
// ativa — o resto do service worker (cache/offline) continua funcionando
// normalmente de qualquer jeito.
try {
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
  importScripts('firebase-config.js');

  if (typeof firebaseConfig !== 'undefined' && firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('COLE_AQUI')) {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const titulo = (payload.notification && payload.notification.title) || 'Contas a Pagar';
      const corpo = (payload.notification && payload.notification.body) || '';
      self.registration.showNotification(titulo, {
        body: corpo,
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        tag: (payload.data && payload.data.tag) || undefined,
      });
    });
  }
} catch (err) {
  console.warn('Notificações push (FCM) não inicializadas no service worker:', err);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            // Não deixa uma falha isolada (ex.: arquivo renomeado) derrubar
            // o registro inteiro do service worker.
            console.warn('Falha ao cachear', asset, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Estratégia "network-first": sempre tenta buscar a versão mais nova da
// rede primeiro (e atualiza o cache com ela). Só usa o cache guardado se
// a rede falhar (offline) — isso evita ficar preso servindo uma versão
// antiga/quebrada do app mesmo depois de uma correção já publicada.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
