// ============================================================
// SERVICE WORKER — BiblioA PWA
// Estratégia: Cache-First para assets estáticos,
//             Network-First para chamadas ao GAS
// ============================================================

const CACHE_NAME    = 'biblioa-v1';
const GAS_CACHE     = 'biblioa-gas-v1';
const GEMINI_CACHE  = 'biblioa-ai-v1';

// Assets que ficam sempre em cache (shell da app)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/home.js',
  './js/estantes.js',
  './js/api.js',
  './js/ui.js',
  './js/ai.js',
  './js/db.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // Fonts CDN
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Inter:wght@300;400;500;600&display=swap',
  // Lucide icons
  'https://unpkg.com/lucide@latest/dist/umd/lucide.js'
];

// ============================================================
// INSTALL — pré-cache dos assets estáticos
// ============================================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Erro no pré-cache:', err))
  );
});

// ============================================================
// ACTIVATE — limpa caches antigos
// ============================================================
self.addEventListener('activate', event => {
  const allowedCaches = [CACHE_NAME, GAS_CACHE, GEMINI_CACHE];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => !allowedCaches.includes(k))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH — estratégias por tipo de recurso
// ============================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Chamadas ao GAS → Network-First (dados sempre frescos)
  //    Se offline, tenta cache como fallback
  if (url.hostname.includes('script.google.com') ||
      url.hostname.includes('googleapis.com') && url.pathname.includes('exec')) {
    event.respondWith(networkFirstWithFallback(event.request, GAS_CACHE));
    return;
  }

  // 2. API Gemini → Network-Only (IA nunca deve vir de cache)
  if (url.hostname.includes('generativelanguage.googleapis.com')) {
    event.respondWith(fetch(event.request).catch(() =>
      new Response(JSON.stringify({ error: 'Sem conexão. A IA requer internet.' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    ));
    return;
  }

  // 3. Google Fonts e CDNs externos → Cache-First
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('unpkg.com') ||
      url.hostname.includes('cdn.tailwindcss.com')) {
    event.respondWith(cacheFirstWithUpdate(event.request));
    return;
  }

  // 4. Assets locais → Cache-First com fallback para network
  event.respondWith(cacheFirstWithUpdate(event.request));
});

// ============================================================
// ESTRATÉGIAS
// ============================================================

async function networkFirstWithFallback(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({
      success: false,
      error: 'Sem conexão com o servidor. Verifique a internet.',
      offline: true
    }), { headers: { 'Content-Type': 'application/json' } });
  }
}

async function cacheFirstWithUpdate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response && response.ok) {
      caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
    }
    return response;
  }).catch(() => null);
  return cached || await fetchPromise;
}

// ============================================================
// MENSAGENS DO CLIENTE (ex: forçar update)
// ============================================================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
