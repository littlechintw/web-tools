import { fileURLToPath, URL } from 'node:url'
import { createHash } from 'node:crypto'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

/**
 * Emits `sw.js` with the list of files to precache (the app shell, CSS, the
 * icon font and every small tool chunk). The worker caches other hashed
 * `/assets/*` files (pdf.js, fabric, Whisper runtime…) the first time they are
 * fetched, so every tool you have opened keeps working offline. The cache name is derived from the file list, so a new deploy gets
 * a new cache and old ones are deleted on activate.
 */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      // Everything the shell needs plus every small tool chunk, so the common
      // tools work offline right after the first visit. Heavy libraries
      // (pdf.js, fabric, the Whisper model runtime and its WASM) are left to
      // runtime caching: they are fetched and cached the first time a tool
      // that needs them is opened.
      const HEAVY_CHUNK_BYTES = 250_000
      const precache = new Set<string>(['/', '/manifest.webmanifest', '/favicon.svg'])
      for (const file of Object.values(bundle)) {
        if (file.type === 'chunk') {
          const heavy = file.code.length > HEAVY_CHUNK_BYTES || /transformers|onnxruntime/.test(file.moduleIds.join('\n'))
          if (file.isEntry || !heavy) precache.add('/' + file.fileName)
          if (file.isEntry) {
            for (const imp of file.imports) precache.add('/' + imp)
            for (const css of file.viteMetadata?.importedCss ?? []) precache.add('/' + css)
          }
        } else if (file.type === 'asset' && /\.(css|woff2)$/.test(file.fileName)) {
          precache.add('/' + file.fileName)
        }
      }
      const list = [...precache].sort()
      const body = workerBody()
      // The cache name changes whenever the file list OR the worker logic
      // changes, so an updated worker never serves from a stale cache.
      const version = createHash('sha256').update(list.join('\n') + body).digest('hex').slice(0, 12)
      const source = `// Generated at build time by vite.config.ts (service-worker plugin).
const CACHE = 'web-tools-${version}'
const PRECACHE = ${JSON.stringify(list)}
${body}`
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

/** The service worker logic, independent of the generated constants above. */
function workerBody(): string {
  return `
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('web-tools-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    // Network first so deploys show up; fall back to the cached shell offline
    // (every route renders the same SPA shell).
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put('/', copy))
          }
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  if (url.pathname.startsWith('/assets/') || PRECACHE.includes(url.pathname)) {
    // Hashed build assets never change: cache first, fill the cache on a miss.
    // ignoreVary: servers often send "Vary: Origin"/"Accept-Encoding", and module
    // script requests carry an Origin header the precached request lacks, which
    // would otherwise make every lookup miss.
    event.respondWith(
      caches.match(req, { ignoreVary: true }).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((cache) => cache.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})
`
}

// tools.littlechin.tw is served at the domain root, so base is '/'.
export default defineConfig({
  base: '/',
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    serviceWorker(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1500,
  },
})
