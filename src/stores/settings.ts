import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'app.settings.v1'

interface SettingsData {
  analyticsEnabled: boolean
  consentBannerDismissed: boolean
}

function load(): SettingsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { analyticsEnabled: true, consentBannerDismissed: false }
    const parsed = JSON.parse(raw)
    return {
      analyticsEnabled: parsed.analyticsEnabled !== false,
      consentBannerDismissed: parsed.consentBannerDismissed ?? false,
    }
  } catch {
    return { analyticsEnabled: true, consentBannerDismissed: false }
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const data = load()
  const analyticsEnabled = ref(data.analyticsEnabled)
  const consentBannerDismissed = ref(data.consentBannerDismissed)

  function persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          analyticsEnabled: analyticsEnabled.value,
          consentBannerDismissed: consentBannerDismissed.value,
        }),
      )
    } catch (e) {
      console.warn('[settings] failed to persist', e)
    }
  }

  function setAnalyticsEnabled(value: boolean) {
    analyticsEnabled.value = value
    persist()
  }

  function dismissConsentBanner() {
    consentBannerDismissed.value = true
    persist()
  }

  return { analyticsEnabled, consentBannerDismissed, setAnalyticsEnabled, dismissConsentBanner }
})
