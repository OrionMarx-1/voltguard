const CACHE_NAME = 'voltguard-demo-v25';
const CORE_ASSETS = [
  './',
  './navigation.mjs',
  './navigation.css',
  './operations.css',
  './operations.mjs',
  './safety.mjs',
  './evidence.mjs',
  './guidance.mjs',
  './copilot-panel.mjs',
  './copilot.css',
  './field-mode.mjs',
  './thermal.css',
  './thermal.mjs',
  './carpark/carpark.css',
  './carpark/carpark.mjs',
  './carpark/layout.mjs',
  './carpark/state.mjs',
  './carpark/detail-loader.mjs',
  './carpark/detail-render.mjs',
  './carpark/decision-panel.mjs',
  './carpark/operator-copy.mjs',
  './carpark/ai-view.mjs',
  './carpark/vehicle-colors.mjs',
  './carpark/vehicle-3d.mjs',
  './carpark/reminders.mjs',
  './carpark/reminder-audio.mjs',
  './data/carpark-b2.json',
  './thermal-ux.mjs',
  './thermal-simulation.mjs',
  './ux-accessibility.mjs',
  './thermal-map.mjs',
  './thermal-3d.mjs',
  './vendor/three/three.module.js',
  './vendor/three/three.core.js',
  './vendor/three/OrbitControls.js',
  './data/fleet-summary.json',
  './data/cells/b0005/summary.json',
  './data/cells/b0005/cycles/168.json',
  './data/cells/b0006/summary.json',
  './data/cells/b0006/cycles/168.json',
  './data/cells/b0007/summary.json',
  './data/cells/b0007/cycles/168.json',
  './data/cells/b0018/summary.json',
  './data/cells/b0018/cycles/132.json',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./', copy));
          return response;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }

  if (url.pathname.includes('/data/') || url.pathname.includes('/carpark/') || url.pathname.includes('/vendor/three/') || /\/(navigation\.(css|mjs)|operations\.(css|mjs)|(?:safety|evidence|guidance|field-mode|ux-accessibility)\.mjs|copilot(?:-panel)?\.(css|mjs)|thermal(?:-map|-3d|-ux|-simulation)?\.(css|mjs))$/.test(url.pathname)) {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => caches.match(request, { ignoreSearch: true })),
    );
  }
});
