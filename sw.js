// public/sw.js - Fast App Shell Precache + Idle Background Caching
const CACHE_NAME = 'medscope-v9-obsidian-studio-final';

// 1. Critical App Shell: Tiny instant install (< 100 KB)
const STATIC_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./medscope-eagle.svg",
  "./fonts/cairo-400-normal-arabic-3.woff2",
  "./fonts/space-grotesk-700-normal-all-15.woff2"
];

// 2. Heavy Secondary Assets: Lazily cached on first use OR in background when idle
const BACKGROUND_ASSETS = [
  "./medscope-watermark-default.png",
  "./pdfjs/pdf.worker.mjs",
  "./tesseract/worker.min.js",
  "./tesseract/tesseract-core.wasm.js",
  "./tesseract/tesseract-core.wasm",
  "./tesseract/tesseract-core-simd.wasm",
  "./tesseract/tesseract-core-lstm.wasm",
  "./tesseract/eng.traineddata.gz",
  "./fonts/cairo-700-normal-arabic-9.woff2",
  "./fonts/jetbrains-mono-400-normal-latin-5.woff2",
  "./fonts/cairo-400-normal-latin-2.woff2",
  "./fonts/cairo-400-normal-latin-ext-1.woff2",
  "./fonts/cairo-600-normal-arabic-6.woff2",
  "./fonts/cairo-600-normal-latin-5.woff2",
  "./fonts/cairo-600-normal-latin-ext-4.woff2",
  "./fonts/cairo-700-normal-latin-8.woff2",
  "./fonts/cairo-700-normal-latin-ext-7.woff2",
  "./fonts/cairo-800-normal-all-12.woff2",
  "./fonts/space-grotesk-300-normal-latin-2.woff2",
  "./fonts/space-grotesk-400-normal-latin-5.woff2",
  "./fonts/space-grotesk-600-normal-latin-11.woff2",
  "./fonts/jetbrains-mono-500-normal-latin-11.woff2",
  "./fonts/jetbrains-mono-700-normal-all-18.woff2"
];

self.addEventListener('install', (event) => {
  // Precache ONLY the minimal app shell for instant install
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_SHELL).catch((err) => {
        console.warn('Some shell assets failed to precache:', err);
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

// Broadcast message helper
async function broadcast(data) {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage(data);
  }
}

// Background Idle Caching Engine
let isBackgroundCaching = false;
async function performBackgroundCaching() {
  if (isBackgroundCaching) return;
  isBackgroundCaching = true;

  try {
    const cache = await caches.open(CACHE_NAME);
    const total = BACKGROUND_ASSETS.length;
    let completed = 0;

    for (let i = 0; i < total; i++) {
      const url = BACKGROUND_ASSETS[i];
      try {
        const match = await cache.match(url);
        if (!match) {
          const res = await fetch(url);
          if (res && res.status === 200) {
            await cache.put(url, res);
          }
        }
      } catch (e) {
        // Continue with next asset
      }
      completed++;
      await broadcast({
        type: 'OFFLINE_CACHE_PROGRESS',
        loaded: completed,
        total,
        percent: Math.round((completed / total) * 100)
      });
      // Small pause between downloads to yield network/CPU
      await new Promise(r => setTimeout(r, 60));
    }

    await broadcast({ type: 'OFFLINE_CACHE_COMPLETE' });
  } catch (err) {
    console.warn('Background cache error:', err);
  } finally {
    isBackgroundCaching = false;
  }
}

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'START_BACKGROUND_PRECACHE') {
    performBackgroundCaching();
  } else if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Network-First for HTML navigation
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

  // Cache-First for static assets
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        // Protect Tesseract WASM/data assets from receiving HTML 404 pages
        const isTesseractAsset = request.url.includes('/tesseract/');
        const contentType = networkResponse.headers.get('content-type') || '';
        if (isTesseractAsset && contentType.includes('text/html')) {
          console.warn('Blocked HTML response for Tesseract asset:', request.url);
          return new Response('Tesseract asset not found', { status: 404, statusText: 'Not Found' });
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
