// MuneemX service worker: makes the app installable and opens fast.
// Network-first for app files (always fresh when online), cache as fallback.
// Supabase / API calls are never cached.
const CACHE = 'muneemx-v4';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/config.js', 'js/i18n.js', 'js/core.js', 'js/scanner.js', 'js/backend-demo.js', 'js/backend-cloud.js',
  'js/views-sell.js', 'js/views-manage.js', 'js/views-credit.js', 'js/views-admin.js', 'js/app.js', 'manifest.webmanifest', 'icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // leave Supabase & CDNs alone
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
