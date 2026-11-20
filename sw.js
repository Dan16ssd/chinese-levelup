/* Offline support: app shell is cached on install; audio + fonts are cached as they are used
   (or ahead of time via "download level audio" in the app). Bump VERSION on every release. */
const VERSION = 'clu-2026-11-21a';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/core.js', 'js/pinyin-data.js', 'js/app.js',
  'js/data/hsk1.js', 'js/data/hsk2.js', 'js/data/hsk3.js', 'js/data/hsk4.js', 'js/data/hsk5.js', 'js/data/hsk6.js', 'js/data/extra.js',
  'manifest.json', 'icon-192.png', 'icon-512.png'];
const AUDIO = 'clu-audio', FONTS = 'clu-fonts';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => ![VERSION, AUDIO, FONTS].includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // audio: cache-first, store on first play
  if (url.origin === location.origin && url.pathname.includes('/audio/')) {
    e.respondWith(caches.open(AUDIO).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }
  // Google Fonts: stale-while-revalidate
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // app shell: network-first (fresh when online), cache fallback offline
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
