// VueSign Player Service Worker
// Provides offline caching for static assets

const CACHE_NAME = 'vuesign-player-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
]

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Fail silently - assets will be cached on first load
      })
    })
  )
  self.skipWaiting()
})

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// Fetch: serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests and socket.io
  if (request.method !== 'GET') return
  if (url.pathname.startsWith('/socket.io')) return
  if (url.pathname.startsWith('/api')) return

  // For navigation requests, serve index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html').then((r) => r ?? new Response('Offline', { status: 503 }))
      )
    )
    return
  }

  // For static assets: cache-first strategy
  if (
    url.pathname.match(/\.(js|css|html|png|jpg|jpeg|gif|svg|woff2?|ttf|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // For media content from the server: network-first with cache fallback
  if (url.pathname.startsWith('/uploads')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request).then((r) => r ?? new Response('Offline', { status: 503 })))
    )
  }
})

// Handle messages from the main app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
