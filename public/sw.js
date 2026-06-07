self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Pass-through fetch for basic PWA installability requirements
  e.respondWith(
    fetch(e.request).catch(() => new Response("You are offline."))
  );
});
