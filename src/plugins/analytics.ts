declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
    dataLayer: unknown[]
  }
}

// Read consent directly from localStorage to avoid Pinia dependency at module scope.
function isAnalyticsEnabled(): boolean {
  try {
    const raw = localStorage.getItem('app.settings.v1')
    if (!raw) return true // default: enabled (opt-out model)
    const parsed = JSON.parse(raw)
    return parsed.analyticsEnabled !== false
  } catch {
    return true
  }
}

export function trackPageView(path: string, title: string) {
  if (!isAnalyticsEnabled()) return
  window.gtag?.('event', 'page_view', {
    page_location: window.location.origin + path,
    page_title: title,
    page_path: path,
  })
}

export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (!isAnalyticsEnabled()) return
  window.gtag?.('event', eventName, params)
}
