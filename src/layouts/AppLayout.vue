<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useDisplay, useTheme } from 'vuetify'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { allTools, categoryOrder } from '@/tools/registry'
import { setThemeMode } from '@/plugins/vuetify'
import { SUPPORTED_LOCALES, setLocale } from '@/plugins/i18n'
import { useSettingsStore } from '@/stores/settings'
import { useRecentsStore } from '@/stores/recents'
import { trackPageView } from '@/plugins/analytics'
import { searchTools } from '@/lib/toolSearch'
import CommandPalette from '@/components/CommandPalette.vue'
import type { Locale } from '@/types'

const theme = useTheme()
const { mobile } = useDisplay()
const { t, locale } = useI18n()
const route = useRoute()
const settings = useSettingsStore()
const recents = useRecentsStore()

// Keep the browser tab title in sync with the active route and locale.
watch(
  [() => route.meta.titleKey, locale],
  () => {
    const key = route.meta.titleKey as string | undefined
    document.title = key ? `${t(key)} · ${t('app.name')}` : t('app.name')
  },
  { immediate: true },
)

// Remember which tools get used, for the home page and the palette.
watch(
  () => route.meta.toolId,
  (id) => {
    if (typeof id === 'string') recents.touch(id)
  },
  { immediate: true },
)

const drawer = ref(!mobile.value)
// Re-evaluate when the window crosses the mobile breakpoint, so a resized
// desktop window doesn't keep a permanent drawer squeezing the content.
watch(mobile, (m) => (drawer.value = !m))

function toggleTheme() {
  setThemeMode(theme.global.current.value.dark ? 'light' : 'dark')
}

function pickLocale(l: Locale) {
  setLocale(l)
}

const GITHUB_URL = 'https://github.com/littlechintw/web-tools'

function acceptAnalytics() {
  settings.setAnalyticsEnabled(true)
  // The initial page view fired before consent existed; record the current
  // page now that tracking is allowed.
  trackPageView(route.fullPath, document.title)
}

// ----- drawer: grouped tool list with a quick filter -----
const navFilter = ref('')
const titleOf = (id: string) => t(`tools.${id}.title`)
const descOf = (id: string) => t(`tools.${id}.description`)

const grouped = computed(() => {
  const list = navFilter.value.trim() ? searchTools(allTools, navFilter.value, titleOf, descOf) : allTools
  return categoryOrder
    .map((cat) => ({ cat, tools: list.filter((tl) => tl.category === cat) }))
    .filter((g) => g.tools.length > 0)
})

function onNavigate() {
  if (mobile.value) drawer.value = false
}

// ----- command palette (⌘K / Ctrl+K, or "/") -----
const palette = ref(false)
const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
const shortcutLabel = isMac ? '⌘K' : 'Ctrl K'

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null
  return !!el?.closest('input, textarea, select, [contenteditable="true"]')
}

function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    palette.value = !palette.value
  } else if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping()) {
    e.preventDefault()
    palette.value = true
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <v-app-bar flat border="b" density="comfortable">
    <v-app-bar-nav-icon :aria-label="t('nav.toggleNav')" @click="drawer = !drawer" />
    <v-app-bar-title>
      <RouterLink to="/" class="d-flex align-center text-decoration-none text-high-emphasis ga-2">
        <v-icon icon="mdi-toolbox-outline" color="primary" />
        <span class="font-weight-bold">{{ t('app.name') }}</span>
      </RouterLink>
    </v-app-bar-title>

    <v-btn
      v-if="!mobile"
      variant="tonal"
      class="text-none mr-2 search-btn"
      prepend-icon="mdi-magnify"
      @click="palette = true"
    >
      {{ t('nav.search') }}
      <kbd class="ml-3">{{ shortcutLabel }}</kbd>
    </v-btn>
    <v-btn v-else icon="mdi-magnify" :title="t('nav.search')" @click="palette = true" />

    <v-btn
      :icon="theme.global.current.value.dark ? 'mdi-weather-night' : 'mdi-weather-sunny'"
      :title="t('nav.theme')"
      @click="toggleTheme"
    />

    <v-menu>
      <template #activator="{ props }">
        <v-btn icon="mdi-translate" :title="t('nav.language')" v-bind="props" />
      </template>
      <v-list density="compact">
        <v-list-item
          v-for="l in SUPPORTED_LOCALES"
          :key="l.value"
          :active="locale === l.value"
          @click="pickLocale(l.value)"
        >
          <v-list-item-title>{{ l.label }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

    <!-- Phones have no room for a fifth icon beside the title; the repo link stays in the footer/README. -->
    <v-btn v-if="!mobile" icon="mdi-github" :href="GITHUB_URL" target="_blank" rel="noopener" :title="t('nav.github')" />
  </v-app-bar>

  <v-navigation-drawer v-model="drawer" :temporary="mobile" width="280">
    <v-list density="compact" nav>
      <v-list-item prepend-icon="mdi-home-outline" :title="t('nav.home')" to="/" exact @click="onNavigate" />
      <v-list-item prepend-icon="mdi-history" :title="t('nav.history')" to="/history" @click="onNavigate" />
      <v-list-item prepend-icon="mdi-cog-outline" :title="t('nav.settings')" to="/settings" @click="onNavigate" />
    </v-list>
    <v-divider />
    <div class="px-3 pt-3 pb-1">
      <v-text-field
        v-model="navFilter"
        :placeholder="t('nav.filterTools')"
        prepend-inner-icon="mdi-filter-variant"
        density="compact"
        variant="solo-filled"
        flat
        hide-details
        clearable
      />
    </div>
    <v-list density="compact" nav>
      <template v-for="g in grouped" :key="g.cat">
        <v-list-subheader>{{ t('categories.' + g.cat) }}</v-list-subheader>
        <v-list-item
          v-for="tl in g.tools"
          :key="tl.id"
          :prepend-icon="tl.icon"
          :title="t('tools.' + tl.id + '.title')"
          :to="'/' + tl.route"
          color="primary"
          @click="onNavigate"
        />
      </template>
      <div v-if="!grouped.length" class="text-caption text-medium-emphasis px-4 py-3">
        {{ t('home.noResults') }}
      </div>
    </v-list>
  </v-navigation-drawer>

  <v-main>
    <RouterView />

    <v-footer class="text-center d-flex flex-column ga-1 py-6 mt-8" color="transparent">
      <div class="text-caption text-medium-emphasis">{{ t('app.privacy') }}</div>
      <div class="text-caption text-disabled">
        © {{ new Date().getFullYear() }} tools.littlechin.tw · {{ t('app.tagline') }}
      </div>
    </v-footer>
  </v-main>

  <CommandPalette v-model="palette" />

  <v-snackbar
    :model-value="settings.analyticsEnabled === null"
    :timeout="-1"
    location="bottom center"
    multi-line
    max-width="600"
  >
    {{ t('analytics.consent.message') }}
    <template #actions>
      <v-btn variant="text" @click="settings.setAnalyticsEnabled(false)">
        {{ t('analytics.consent.decline') }}
      </v-btn>
      <v-btn color="primary" variant="tonal" @click="acceptAnalytics">
        {{ t('analytics.consent.accept') }}
      </v-btn>
    </template>
  </v-snackbar>
</template>

<style scoped>
.search-btn kbd {
  font-family: inherit;
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid rgba(var(--v-border-color), 0.5);
  color: rgba(var(--v-theme-on-surface), 0.6);
}
</style>
