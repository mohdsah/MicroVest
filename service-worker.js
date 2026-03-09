/* ═══════════════════════════════════════════════════════════
   MicroVest v6 — service-worker.js
   PWA: Cache Strategy · Offline · Push Notifications
═══════════════════════════════════════════════════════════ */

const CACHE_NAME  = 'microvest-v6-cache-v2';
const STATIC_URLS = [
  '/',
  '/index.html',
  '/login.html',
  '/dashboard.html',
  '/investment.html',
  '/mining.html',
  '/missions.html',
  '/rewards.html',
  '/team.html',
  '/market.html',
  '/wallet.html',
  '/profile.html',
  '/analytics.html',
  '/history.html',
  '/leaderboard.html',
  '/notifications.html',
  '/forgot.html',
  '/support.html',
  '/robots.html',
  '/css/v6.css',
  '/js/config.js',
  '/js/ui.js',
  '/js/realtime.js',
  '/js/automation.js',
  '/js/lang.js',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Serif+Display&family=Instrument+Sans:wght@400;700;800&family=JetBrains+Mono:wght@400;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
];

/* ── INSTALL: Pre-cache static assets ───────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(
        STATIC_URLS.filter(u => !u.startsWith('http') || u.startsWith(self.location.origin))
      ))
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: Purge old caches ─────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH: Network-first for API, cache-first for assets ─ */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Always network for Supabase API calls
  if (url.hostname.includes('supabase.co') || url.hostname.includes('googleapis.com')) {
    event.respondWith(fetch(request).catch(() => new Response('Offline', { status: 503 })));
    return;
  }

  // Cache-first for static assets (JS, CSS, fonts)
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'font') {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, clone));
        return resp;
      }))
    );
    return;
  }

  // Network-first for HTML pages (fresh content)
  event.respondWith(
    fetch(request)
      .then(resp => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, clone));
        return resp;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match('/login.html')))
  );
});

/* ── PUSH NOTIFICATIONS ─────────────────────────────────── */
self.addEventListener('push', event => {
  let data = { title: 'MicroVest', body: 'Notifikasi baru!', icon: '/icons/icon-192.png' };
  try { data = { ...data, ...event.data.json() }; } catch(e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    data.icon || '/icons/icon-192.png',
      badge:   '/icons/badge-72.png',
      vibrate: [200, 100, 200],
      data:    { url: data.url || '/dashboard.html' },
      actions: [
        { action: 'open',    title: '🔍 Buka'  },
        { action: 'dismiss', title: '✕ Tutup' },
      ],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/dashboard.html';
  event.waitUntil(clients.openWindow(url));
});
