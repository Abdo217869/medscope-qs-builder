// public/sw.js - Service Worker for 100% offline capability
const CACHE_NAME = 'medscope-essay-v6';

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./medscope-eagle.svg",
  "./medscope-watermark-default.png",
  "./pdfjs/pdf.worker.mjs",
  "./tesseract/worker.min.js",
  "./tesseract/tesseract-core.wasm.js",
  "./tesseract/tesseract-core.wasm",
  "./tesseract/tesseract-core-simd.wasm",
  "./tesseract/eng.traineddata.gz",
  "./fonts/cairo-400-normal-arabic-3.woff2",
  "./fonts/cairo-400-normal-latin-2.woff2",
  "./fonts/cairo-400-normal-latin-ext-1.woff2",
  "./fonts/cairo-600-normal-arabic-6.woff2",
  "./fonts/cairo-600-normal-latin-5.woff2",
  "./fonts/cairo-600-normal-latin-ext-4.woff2",
  "./fonts/cairo-700-normal-arabic-9.woff2",
  "./fonts/cairo-700-normal-latin-8.woff2",
  "./fonts/cairo-700-normal-latin-ext-7.woff2",
  "./fonts/cairo-800-normal-all-12.woff2",
  "./fonts/cairo-800-normal-latin-11.woff2",
  "./fonts/cairo-800-normal-latin-ext-10.woff2",
  "./fonts/font-1.woff2",
  "./fonts/font-10.woff2",
  "./fonts/font-11.woff2",
  "./fonts/font-12.woff2",
  "./fonts/font-13.woff2",
  "./fonts/font-14.woff2",
  "./fonts/font-15.woff2",
  "./fonts/font-16.woff2",
  "./fonts/font-17.woff2",
  "./fonts/font-18.woff2",
  "./fonts/font-19.woff2",
  "./fonts/font-2.woff2",
  "./fonts/font-20.woff2",
  "./fonts/font-21.woff2",
  "./fonts/font-22.woff2",
  "./fonts/font-23.woff2",
  "./fonts/font-24.woff2",
  "./fonts/font-25.woff2",
  "./fonts/font-26.woff2",
  "./fonts/font-27.woff2",
  "./fonts/font-28.woff2",
  "./fonts/font-29.woff2",
  "./fonts/font-3.woff2",
  "./fonts/font-30.woff2",
  "./fonts/font-31.woff2",
  "./fonts/font-4.woff2",
  "./fonts/font-5.woff2",
  "./fonts/font-6.woff2",
  "./fonts/font-7.woff2",
  "./fonts/font-8.woff2",
  "./fonts/font-9.woff2",
  "./fonts/jetbrains-mono-400-normal-cyrillic-1.woff2",
  "./fonts/jetbrains-mono-400-normal-cyrillic-ext-6.woff2",
  "./fonts/jetbrains-mono-400-normal-greek-2.woff2",
  "./fonts/jetbrains-mono-400-normal-latin-5.woff2",
  "./fonts/jetbrains-mono-400-normal-latin-ext-4.woff2",
  "./fonts/jetbrains-mono-400-normal-vietnamese-3.woff2",
  "./fonts/jetbrains-mono-500-normal-cyrillic-7.woff2",
  "./fonts/jetbrains-mono-500-normal-cyrillic-ext-12.woff2",
  "./fonts/jetbrains-mono-500-normal-greek-8.woff2",
  "./fonts/jetbrains-mono-500-normal-latin-11.woff2",
  "./fonts/jetbrains-mono-500-normal-latin-ext-10.woff2",
  "./fonts/jetbrains-mono-500-normal-vietnamese-9.woff2",
  "./fonts/jetbrains-mono-700-normal-all-18.woff2",
  "./fonts/jetbrains-mono-700-normal-cyrillic-13.woff2",
  "./fonts/jetbrains-mono-700-normal-greek-14.woff2",
  "./fonts/jetbrains-mono-700-normal-latin-17.woff2",
  "./fonts/jetbrains-mono-700-normal-latin-ext-16.woff2",
  "./fonts/jetbrains-mono-700-normal-vietnamese-15.woff2",
  "./fonts/space-grotesk-300-normal-latin-2.woff2",
  "./fonts/space-grotesk-300-normal-latin-ext-1.woff2",
  "./fonts/space-grotesk-300-normal-vietnamese-3.woff2",
  "./fonts/space-grotesk-400-normal-latin-5.woff2",
  "./fonts/space-grotesk-400-normal-latin-ext-4.woff2",
  "./fonts/space-grotesk-400-normal-vietnamese-6.woff2",
  "./fonts/space-grotesk-500-normal-latin-8.woff2",
  "./fonts/space-grotesk-500-normal-latin-ext-7.woff2",
  "./fonts/space-grotesk-500-normal-vietnamese-9.woff2",
  "./fonts/space-grotesk-600-normal-latin-11.woff2",
  "./fonts/space-grotesk-600-normal-latin-ext-10.woff2",
  "./fonts/space-grotesk-600-normal-vietnamese-12.woff2",
  "./fonts/space-grotesk-700-normal-all-15.woff2",
  "./fonts/space-grotesk-700-normal-latin-14.woff2",
  "./fonts/space-grotesk-700-normal-latin-ext-13.woff2"
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

  // Network-First for HTML navigation so users always see the latest deployed app immediately
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' }).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        return caches.match('./index.html') || caches.match('./') || caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // Cache-First for versioned static assets (fonts, chunks, icons)
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
