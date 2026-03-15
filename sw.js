// ============================================================
// SERVICE WORKER — BiblioA PWA v3.1
// CORRECÇÕES:
//   - POST requests NUNCA são cacheados (API não suporta)
//   - clone() feito ANTES de consumir a resposta
//   - Estratégias separadas por tipo de recurso
// ============================================================

const CACHE_STATIC  = 'biblioa-static-v3';
const CACHE_FONTS   = 'biblioa-fonts-v3';

// Assets que ficam sempre em cache (app shell)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/api.js',
  './js/ai.js',
  './js/ui.js',
  './js/app.js',
  './js/home.js',
  './js/estantes.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── INSTALL ────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Pré-cache falhou:', err))
  );
});

// ── ACTIVATE ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  const allowed = [CACHE_STATIC, CACHE_FONTS];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !allowed.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ──────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. NUNCA cachear POST — são chamadas à API GAS ou Gemini
  //    Deixa passar directo para a rede; se falhar, devolve erro JSON
  if (req.method === 'POST') {
    event.respondWith(
      fetch(req).catch(() =>
        new Response(
          JSON.stringify({ success: false, error: 'Sem conexão.', offline: true }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // 2. API Gemini (GET) — Network only, sem cache
  if (url.hostname.includes('generativelanguage.googleapis.com')) {
    event.respondWith(fetch(req));
    return;
  }

  // 3. Google Fonts — Cache first (raramente mudam)
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(cacheFirst(req, CACHE_FONTS));
    return;
  }

  // 4. CDNs externos (Lucide, Tailwind, unpkg) — Cache first
  if (
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('cdn.tailwindcss.com') ||
    url.hostname.includes('cdnjs.cloudflare.com')
  ) {
    event.respondWith(cacheFirst(req, CACHE_STATIC));
    return;
  }

  // 5. Assets locais (HTML, CSS, JS, imagens) — Cache first com update
  event.respondWith(cacheFirstWithNetworkUpdate(req));
});

// ── ESTRATÉGIAS ────────────────────────────────────────────

// Cache first: devolve do cache imediatamente; se não existir, vai à rede
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok && response.status < 400) {
      const cache    = await caches.open(cacheName || CACHE_STATIC);
      const toCache  = response.clone(); // clone ANTES de usar
      cache.put(request, toCache);
    }
    return response;
  } catch {
    return new Response('Recurso não disponível offline.', { status: 503 });
  }
}

// Cache first + actualiza cache em background (stale-while-revalidate)
async function cacheFirstWithNetworkUpdate(request) {
  const cacheName = CACHE_STATIC;
  const cached    = await caches.match(request);

  // Actualiza em background independentemente
  const networkUpdate = fetch(request).then(response => {
    if (response && response.ok && response.status < 400) {
      caches.open(cacheName).then(cache => {
        cache.put(request, response.clone()); // clone ANTES de retornar
      });
    }
    return response;
  }).catch(() => null);

  // Devolve cache imediatamente se disponível; senão espera pela rede
  return cached || await networkUpdate;
}

// ── MENSAGENS ──────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
