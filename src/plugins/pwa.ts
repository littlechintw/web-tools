// Service-worker registration + update flow. The worker itself (sw.js) is
// generated at build time by the `service-worker` plugin in vite.config.ts,
// so nothing is registered during `vite dev`.
import { ref } from 'vue'

/** A newer build is installed and waiting; the UI offers a reload. */
export const updateAvailable = ref(false)
/** First install finished: the shell now works offline. */
export const offlineReady = ref(false)

let waiting: ServiceWorker | null = null

export function applyUpdate() {
  if (!waiting) return
  waiting.postMessage('SKIP_WAITING')
  waiting = null
}

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const track = (sw: ServiceWorker | null) => {
        if (!sw) return
        sw.addEventListener('statechange', () => {
          if (sw.state !== 'installed') return
          if (navigator.serviceWorker.controller) {
            waiting = sw
            updateAvailable.value = true
          } else {
            offlineReady.value = true
          }
        })
      }
      if (reg.waiting && navigator.serviceWorker.controller) {
        waiting = reg.waiting
        updateAvailable.value = true
      }
      track(reg.installing)
      reg.addEventListener('updatefound', () => track(reg.installing))
      // Reload once the new worker has taken over so the fresh assets load.
      let reloaded = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return
        reloaded = true
        location.reload()
      })
    } catch {
      // Registration failures (private mode, unsupported) just mean no offline support.
    }
  })
}
