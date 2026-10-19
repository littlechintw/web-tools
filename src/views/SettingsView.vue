<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import { useHistoryStore } from '@/stores/history'
import { useFavoritesStore } from '@/stores/favorites'
import { useRecentsStore } from '@/stores/recents'
import { setThemeMode, themeMode, type ThemeMode } from '@/plugins/vuetify'
import { SUPPORTED_LOCALES, setLocale } from '@/plugins/i18n'
import { clearStoredRefs } from '@/composables/useStoredRef'
import type { Locale } from '@/types'

const { t, locale } = useI18n()
const settings = useSettingsStore()
const history = useHistoryStore()
const favorites = useFavoritesStore()
const recents = useRecentsStore()

const themeItems = computed<{ value: ThemeMode; label: string; icon: string }[]>(() => [
  { value: 'system', label: t('settings.themeSystem'), icon: 'mdi-theme-light-dark' },
  { value: 'light', label: t('settings.themeLight'), icon: 'mdi-weather-sunny' },
  { value: 'dark', label: t('settings.themeDark'), icon: 'mdi-weather-night' },
])

const confirmClear = ref(false)
const cleared = ref(false)

/** Everything the app keeps in this browser, except the preferences on this
 *  page (theme, language, analytics choice), which the user set deliberately. */
function clearAllData() {
  history.clearAll()
  favorites.clear()
  recents.clear()
  clearStoredRefs()
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && k.startsWith('app.') && !['app.settings.v1', 'app.theme', 'app.locale'].includes(k)) {
        localStorage.removeItem(k)
      }
    }
  } catch {
    // ignore
  }
  confirmClear.value = false
  cleared.value = true
}

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
</script>

<template>
  <v-container max-width="720" class="py-8">
    <h1 class="text-h5 font-weight-bold mb-6">{{ t('settings.title') }}</h1>

    <!-- Appearance -->
    <h2 class="text-subtitle-2 text-medium-emphasis mb-2">{{ t('settings.appearance') }}</h2>
    <v-card rounded="lg" variant="outlined" class="mb-6">
      <v-list lines="two">
        <v-list-item>
          <template #title>
            <span class="font-weight-medium">{{ t('settings.theme') }}</span>
          </template>
          <template #append>
            <v-btn-toggle
              :model-value="themeMode"
              mandatory
              color="primary"
              variant="outlined"
              density="comfortable"
              divided
              @update:model-value="setThemeMode($event as ThemeMode)"
            >
              <v-btn v-for="item in themeItems" :key="item.value" :value="item.value" :prepend-icon="item.icon">
                {{ item.label }}
              </v-btn>
            </v-btn-toggle>
          </template>
        </v-list-item>
        <v-divider />
        <v-list-item>
          <template #title>
            <span class="font-weight-medium">{{ t('settings.language') }}</span>
          </template>
          <template #append>
            <v-select
              :model-value="locale"
              :items="SUPPORTED_LOCALES.map((l) => ({ title: l.label, value: l.value }))"
              density="compact"
              hide-details
              style="min-width: 180px"
              @update:model-value="setLocale($event as Locale)"
            />
          </template>
        </v-list-item>
      </v-list>
    </v-card>

    <!-- Privacy -->
    <h2 class="text-subtitle-2 text-medium-emphasis mb-2">{{ t('settings.privacy') }}</h2>
    <v-card rounded="lg" variant="outlined" class="mb-6">
      <v-list lines="three">
        <v-list-item :subtitle="t('settings.analytics.description')">
          <template #title>
            <span class="font-weight-medium">{{ t('settings.analytics.title') }}</span>
          </template>
          <template #append>
            <v-switch
              :model-value="settings.analyticsEnabled === true"
              color="primary"
              hide-details
              inset
              @update:model-value="settings.setAnalyticsEnabled($event as boolean)"
            />
          </template>
        </v-list-item>
      </v-list>
    </v-card>

    <!-- Local data -->
    <h2 class="text-subtitle-2 text-medium-emphasis mb-2">{{ t('settings.data') }}</h2>
    <v-card rounded="lg" variant="outlined" class="mb-6 pa-4">
      <p class="text-body-2 text-medium-emphasis mb-3">{{ t('settings.dataDescription') }}</p>
      <div class="d-flex flex-wrap ga-2 mb-4">
        <v-chip size="small" variant="tonal" prepend-icon="mdi-history">
          {{ t('settings.historyCount', { count: history.entries.length }) }}
        </v-chip>
        <v-chip size="small" variant="tonal" prepend-icon="mdi-star-outline">
          {{ t('settings.favoritesCount', { count: favorites.ids.length }) }}
        </v-chip>
        <v-chip size="small" variant="tonal" prepend-icon="mdi-clock-outline">
          {{ t('settings.recentsCount', { count: recents.ids.length }) }}
        </v-chip>
      </div>
      <div class="d-flex flex-wrap ga-2">
        <v-btn variant="tonal" prepend-icon="mdi-history" to="/history">{{ t('settings.manageHistory') }}</v-btn>
        <v-btn variant="outlined" color="error" prepend-icon="mdi-delete-sweep-outline" @click="confirmClear = true">
          {{ t('settings.clearAll') }}
        </v-btn>
      </div>
    </v-card>

    <!-- Shortcuts -->
    <h2 class="text-subtitle-2 text-medium-emphasis mb-2">{{ t('settings.shortcuts') }}</h2>
    <v-card rounded="lg" variant="outlined" class="pa-4">
      <div class="d-flex align-center justify-space-between">
        <span class="text-body-2">{{ t('settings.shortcutSearch') }}</span>
        <span class="d-flex ga-1">
          <kbd>{{ isMac ? '⌘' : 'Ctrl' }}</kbd><kbd>K</kbd>
          <span class="text-medium-emphasis mx-1">/</span>
          <kbd>/</kbd>
        </span>
      </div>
    </v-card>

    <v-dialog v-model="confirmClear" max-width="480">
      <v-card>
        <v-card-title>{{ t('settings.clearAll') }}</v-card-title>
        <v-card-text>{{ t('settings.clearAllConfirm') }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmClear = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="error" @click="clearAllData">{{ t('common.confirm') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="cleared" :timeout="2500" color="success">{{ t('settings.cleared') }}</v-snackbar>
  </v-container>
</template>

<style scoped>
kbd {
  font-family: inherit;
  font-size: 0.75rem;
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid rgba(var(--v-border-color), 0.5);
  background: rgba(var(--v-theme-on-surface), 0.04);
}
</style>
