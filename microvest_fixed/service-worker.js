/* ═══════════════════════════════════════════════════════════════
   MicroVest v8 — service-worker.js  (v3)
   ─────────────────────────────────────────────────────────────
   Strategies:
   • HTML pages   : Network First  (fresh content)
   • JS / CSS     : Stale-While-Revalidate (fast + updated)
   • Fonts / Icons: Cache First    (immutable)
   • API calls    : Network Only   (never cache live data)
   • Push events  : Rich notification with action buttons
   • Background Sync: Queue failed deposit/withdrawal actions
═══════════════════════════════════════════════════════════════ */

const APP_VERSION    = 'v10.0';
const CACHE_STATIC   = `mv-static-${APP_VERSION}`;
const CACHE_DYNAMIC  = `mv-dynamic-${APP_VERSION}`;
const CACHE_PAGES    = `mv-pages-${APP_VERSION}`;
const OFFLINE_URL    = '/offline.html';
const MAX_DYN_ITEMS  = 60;

/* Pages to pre-cache */
const PRECACHE_PAGES = [
  '/', '/offline.html',
  '/index.html', '/login.html', '/dashboard.html',
  '/investment.html', '/mining.html', '/missions.html',
  '/rewards.html', '/team.html', '/market.html',
  '/wallet.html', '/profile.html', '/analytics.html',
  '/history.html', '/leaderboard.html', '/notifications.html',
  '/forgot.html', '/support.html', '/robots.html',
  '/referral.html',
];

/* Static assets to pre-cache */
const PRECACHE_STATIC = [
  '/css/v7.css', '/css/v6.css',
  '/js/config.js', '/js/ui.js', '/js/lang.js',
  '/js/realtime.js', '/js/automation.js',
  '/js/security.js', '/js/push.js',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Syne:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
];

/* Never cache */
const BYPASS_PATTERNS = [
  /supabase\.co/,
  /coingecko\.com/,
  /api\./,
  /\.php$/,
];

/* ── INSTALL ──────────────────────────────────────────────── */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_PAGES).then(c =>
        c.addAll(PRECACHE_PAGES.map(u => new Request(u, { cache:'reload' }))).catch(() => {})
      ),
      caches.open(CACHE_STATIC).then(c =>
        c.addAll(PRECACHE_STATIC).catch(() => {})
      ),
    ])
  );
});

/* ── ACTIVATE ─────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(k => ![CACHE_STATIC, CACHE_DYNAMIC, CACHE_PAGES].includes(k))
        .map(k => caches.delete(k))
    )).then(() => clients.claim())
  );
});

/* ── FETCH ────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* Skip non-GET */
  if (request.method !== 'GET') return;

  /* Skip Supabase, API, analytics */
  if (BYPASS_PATTERNS.some(p => p.test(request.url))) return;

  /* Skip chrome-extension etc */
  if (!['http:','https:'].includes(url.protocol)) return;

  /* ─ Fonts & Icons: Cache First (immutable) */
  if (url.hostname !== location.hostname &&
      (request.url.includes('fonts') || request.url.includes('cdnjs'))) {
    event.respondWith(cacheFirst(request, CACHE_STATIC));
    return;
  }

  /* ─ JS / CSS: Stale-While-Revalidate */
  if (request.url.match(/\.(js|css)(\?.*)?$/)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_STATIC));
    return;
  }

  /* ─ Images / Icons: Cache First */
  if (request.url.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)(\?.*)?$/)) {
    event.respondWith(cacheFirst(request, CACHE_DYNAMIC));
    return;
  }

  /* ─ HTML Pages: Network First with offline fallback */
  if (request.headers.get('accept')?.includes('text/html') ||
      request.url.match(/\.html(\?.*)?$/) ||
      url.pathname === '/') {
    event.respondWith(networkFirst(request, CACHE_PAGES));
    return;
  }

  /* ─ Everything else: Network → Dynamic Cache */
  event.respondWith(networkFirst(request, CACHE_DYNAMIC));
});

/* ── CACHE STRATEGIES ─────────────────────────────────────── */
async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const c = await caches.open(cacheName);
      c.put(req, res.clone());
    }
    return res;
  } catch(_) {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(req, cacheName) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const c = await caches.open(cacheName);
      c.put(req, res.clone());
      await trimCache(cacheName, MAX_DYN_ITEMS);
    }
    return res;
  } catch(_) {
    const cached = await caches.match(req);
    if (cached) return cached;
    /* Offline fallback for HTML */
    if (req.headers.get('accept')?.includes('text/html')) {
      const offline = await caches.match(OFFLINE_URL);
      if (offline) return offline;
    }
    return new Response('Offline', { status: 503, statusText:'Offline' });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cached = await caches.match(req);
  const fresh  = fetch(req).then(async res => {
    if (res.ok) {
      const c = await caches.open(cacheName);
      c.put(req, res.clone());
    }
    return res;
  }).catch(() => null);
  return cached || (await fresh) || new Response('Offline', { status:503 });
}

async function trimCache(cacheName, max) {
  const c    = await caches.open(cacheName);
  const keys = await c.keys();
  if (keys.length > max) {
    await c.delete(keys[0]);
  }
}

/* ── BACKGROUND SYNC ──────────────────────────────────────── */
self.addEventListener('sync', event => {
  if (event.tag === 'mv-sync-transactions') {
    event.waitUntil(syncPendingTransactions());
  }
});

async function syncPendingTransactions() {
  // Notify open clients to re-sync
  const allClients = await clients.matchAll({ type:'window' });
  allClients.forEach(c => c.postMessage({ type:'SYNC_REQUIRED' }));
}

/* ── PUSH NOTIFICATIONS ───────────────────────────────────── */
self.addEventListener('push', event => {
  let payload = { title:'MicroVest', body:'Ada aktiviti baru di akaun anda.', icon:'⚡', type:'info' };

  try {
    if (event.data) {
      const txt = event.data.text();
      try { payload = { ...payload, ...JSON.parse(txt) }; }
      catch(_) { payload.body = txt; }
    }
  } catch(_) {}

  const icons = {
    deposit:    '💰', withdraw:'🏦', profit:'📈',
    robot:      '🤖', mining:'⛏️',  mission:'🎯',
    referral:   '👥', level:'🏅',   admin:'📢',
    info:       '🔔',
  };
  const ico = icons[payload.type] || icons.info;

  const options = {
    body:       payload.body,
    icon:       '/icons/icon-192.png',
    badge:      '/icons/badge-72.png',
    tag:        payload.type || 'general',
    renotify:   true,
    vibrate:    [200, 100, 200],
    timestamp:  Date.now(),
    data: {
      url: payload.url || '/dashboard.html',
      type: payload.type,
    },
    actions: payload.actions || [
      { action:'view',    title:'Lihat', icon:'/icons/view.png'   },
      { action:'dismiss', title:'Tutup', icon:'/icons/close.png'  },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(`${ico} ${payload.title}`, options)
  );
});

/* ── NOTIFICATION CLICK ───────────────────────────────────── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};

  if (event.action === 'dismiss') return;

  const targetUrl = data.url || '/dashboard.html';

  event.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      /* Focus existing tab if open */
      for (const client of list) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      /* Open new tab */
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

/* ── MESSAGE HANDLER ──────────────────────────────────────── */
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  }
});
