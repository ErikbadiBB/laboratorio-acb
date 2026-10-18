// Service worker de StatsLAB: la web se abre sin conexión con la última versión descargada.
// Con red siempre se pide la versión nueva (red primero); los datos de partidos los guarda la propia página.
const CACHE = 'statslab-web';
const SHELL = ['./', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png'];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => { })))));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    if (u.pathname.includes('/api/')) return; // puente BCL: siempre a la red
    const key = r.mode === 'navigate' ? './' : r;
    e.respondWith(fetch(r).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(key, cp)); }
      return res;
    }).catch(() => caches.match(key, { ignoreSearch: true }).then(x => x || caches.match('./'))));
  } else if (/^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    // Tipografías: direcciones versionadas, se sirven de la copia si existe
    e.respondWith(caches.match(r).then(x => x || fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); return res; })));
  }
});
