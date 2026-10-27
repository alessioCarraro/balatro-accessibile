const CACHE_NAME = 'formazione-campionato-v1'
const APP_SHELL = ['/', '/manifest.webmanifest', '/formazione-icon.svg']

async function precacheAppShell() {
  const cache = await caches.open(CACHE_NAME)
  await cache.addAll(APP_SHELL)
  const response = await fetch('/index.html')
  if (!response.ok) throw new Error(`Impossibile precaricare la pagina iniziale: ${response.status}`)
  const html = await response.text()
  const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)]
    .map((match) => match[1])
    .filter((path) => new URL(path, self.location.origin).origin === self.location.origin)
  await cache.addAll(assets)
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      precacheAppShell(),
      self.skipWaiting(),
    ]),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                (cacheName.startsWith('formazione-campionato-') ||
                  cacheName.startsWith('orbita-52-')) &&
                cacheName !== CACHE_NAME,
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      ),
      self.clients.claim(),
    ]),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME)
      try {
        const response = await fetch(request)
        if (response.ok) await cache.put(request, response.clone())
        return response
      } catch (error) {
        const fallback = await cache.match(request, { ignoreVary: true }) ||
          await cache.match('/', { ignoreVary: true })
        if (fallback) return fallback
        throw error
      }
    })())
    return
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    const cachedResponse = await cache.match(request, { ignoreVary: true })
    if (cachedResponse) return cachedResponse
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone())
    return response
  })())
})
