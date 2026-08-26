declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
    dataLayer: unknown[]
  }
}

const GA_ID = 'G-4K4TLB79SQ'

// Read consent directly from localStorage to avoid Pinia dependency at module scope.
// Opt-in model: nothing is tracked until the user explicitly accepts the
// first-load consent prompt (analyticsEnabled === true).
function isAnalyticsEnabled(): boolean {
  try {
    const raw = localStorage.getItem('app.settings.v1')
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return parsed.analyticsEnabled === true
  } catch {
    return false
  }
}

// gtag.js is injected lazily and only while analytics is enabled, so opting
// out stops all tracking (including GA's own pings/cookies), not just our
// custom events. Re-enabling in Settings takes effect on the next tracked
// action without a reload.
let injected = false
function ensureGtagLoaded() {
  if (injected) return
  injected = true
  window.dataLayer = window.dataLayer || []
  if (!window.gtag) {
    window.gtag = function () {
      // GA requires the actual `arguments` object, not a spread array.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer.push(arguments)
    }
  }
  window.gtag('js', new Date())
  window.gtag('config', GA_ID, { send_page_view: false })
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(s)
}

export function trackPageView(path: string, title: string) {
  if (!isAnalyticsEnabled()) return
  ensureGtagLoaded()
  window.gtag?.('event', 'page_view', {
    page_location: window.location.origin + path,
    page_title: title,
    page_path: path,
  })
}

export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (!isAnalyticsEnabled()) return
  ensureGtagLoaded()
  window.gtag?.('event', eventName, params)
}
