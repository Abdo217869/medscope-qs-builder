// public/sw.js - Service Worker for 100% offline capability
const CACHE_NAME = 'medscope-qs-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './medscope-eagle.svg',
  './medscope-watermark-default.png',
  './pdfjs/pdf.worker.mjs',
  './tesseract/worker.min.js',
  './tesseract/tesseract-core.wasm.js',
  './tesseract/tesseract-core.wasm',
  './tesseract/tesseract-core-simd.wasm',
  './tesseract/eng.traineddata.gz'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Some assets failed to precache during install:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Offline fallback
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html') || caches.match('./');
        }
      });
    })
  );
});
