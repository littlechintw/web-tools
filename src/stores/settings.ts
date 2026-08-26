import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'app.settings.v1'

interface SettingsData {
  /** null = the user has not been asked yet (consent prompt is shown). */
  analyticsEnabled: boolean | null
}

function load(): SettingsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { analyticsEnabled: null }
    const parsed = JSON.parse(raw)
    return {
      analyticsEnabled:
        parsed.analyticsEnabled === true ? true : parsed.analyticsEnabled === false ? false : null,
    }
  } catch {
    return { analyticsEnabled: null }
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const data = load()
  const analyticsEnabled = ref<boolean | null>(data.analyticsEnabled)

  function persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          analyticsEnabled: analyticsEnabled.value,
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

  return { analyticsEnabled, setAnalyticsEnabled }
})
