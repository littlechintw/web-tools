/**
 * Deferred AdSense loader (same behaviour as the toilets project).
 *  - Loaded at most once; later callers get the same promise.
 *  - Waits for the first user interaction or browser idle time (max 3 s) so ads
 *    never slow the first paint.
 *  - Sets requestNonPersonalizedAds before the script runs.
 *  - Rejects if blocked (ad blockers); callers just ignore that.
 * `isAdScriptLoaded()` is true from the moment the <script> is inserted — the
 * router uses it to decide when a full page load is needed (see config/ads.ts).
 */
declare global {
  interface Window {
    adsbygoogle?: unknown[] & { requestNonPersonalizedAds?: number }
  }
}

const SCRIPT_URL = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'

let loadPromise: Promise<void> | null = null
let scriptInserted = false

export const isAdScriptLoaded = (): boolean => scriptInserted

function waitForIdleOrInteraction(timeout = 3000): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    const finish = () => {
      if (done) return
      done = true
      events.forEach((name) => window.removeEventListener(name, finish))
      resolve()
    }
    events.forEach((name) => window.addEventListener(name, finish, { once: true, passive: true }))
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(finish, { timeout })
    else setTimeout(finish, timeout)
  })
}

export function loadAdSense(client: string): Promise<void> {
  if (loadPromise) return loadPromise
  loadPromise = waitForIdleOrInteraction().then(
    () =>
      new Promise<void>((resolve, reject) => {
        const queue = (window.adsbygoogle = window.adsbygoogle || ([] as unknown as NonNullable<Window['adsbygoogle']>))
        queue.requestNonPersonalizedAds = 1
        const script = document.createElement('script')
        script.async = true
        script.crossOrigin = 'anonymous'
        script.src = `${SCRIPT_URL}?client=${encodeURIComponent(client)}`
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('AdSense: adsbygoogle.js failed to load'))
        scriptInserted = true
        document.head.appendChild(script)
      }),
  )
  return loadPromise
}
