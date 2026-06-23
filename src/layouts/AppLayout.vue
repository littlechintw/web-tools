<script setup lang="ts">
import { ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { useDisplay } from 'vuetify'
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { allTools, categoryOrder } from '@/tools/registry'
import { persistTheme } from '@/plugins/vuetify'
import { SUPPORTED_LOCALES, setLocale } from '@/plugins/i18n'
import type { Locale } from '@/types'

const theme = useTheme()
const { mobile } = useDisplay()
const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()

// Keep the browser tab title in sync with the active route and locale.
watch(
  [() => route.meta.titleKey, locale],
  () => {
    const key = route.meta.titleKey as string | undefined
    document.title = key ? `${t(key)} · ${t('app.name')}` : t('app.name')
  },
  { immediate: true },
)

const drawer = ref(!mobile.value)

function toggleTheme() {
  const next = theme.global.current.value.dark ? 'light' : 'dark'
  theme.change(next)
  persistTheme(next)
}

function pickLocale(l: Locale) {
  setLocale(l)
}

const GITHUB_URL = 'https://github.com/littlechintw/web-tools'

// Group tools by category for the drawer. Labels via t('categories.<id>').
const grouped = categoryOrder
  .map((cat) => ({
    cat,
    tools: allTools.filter((tl) => tl.category === cat),
  }))
  .filter((g) => g.tools.length > 0)

function go(path: string) {
  router.push(path)
  if (mobile.value) drawer.value = false
}
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

    <v-spacer />

    <v-btn :icon="theme.global.current.value.dark ? 'mdi-weather-night' : 'mdi-weather-sunny'"
      :title="t('nav.theme')" @click="toggleTheme" />

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

    <v-btn icon="mdi-github" :href="GITHUB_URL" target="_blank" rel="noopener" :title="t('nav.github')" />
  </v-app-bar>

  <v-navigation-drawer v-model="drawer" :temporary="mobile" width="280">
    <v-list density="compact" nav>
      <v-list-item prepend-icon="mdi-home-outline" :title="t('nav.home')" @click="go('/')" />
      <v-list-item prepend-icon="mdi-history" :title="t('nav.history')" @click="go('/history')" />
    </v-list>
    <v-divider />
    <v-list density="compact" nav>
      <template v-for="g in grouped" :key="g.cat">
        <v-list-subheader>{{ t('categories.' + g.cat) }}</v-list-subheader>
        <v-list-item
          v-for="tl in g.tools"
          :key="tl.id"
          :prepend-icon="tl.icon"
          :title="t('tools.' + tl.id + '.title')"
          @click="go('/' + tl.route)"
        />
      </template>
    </v-list>
  </v-navigation-drawer>

  <v-main>
    <RouterView v-slot="{ Component }">
      <Suspense>
        <component :is="Component" />
        <template #fallback>
          <div class="d-flex justify-center align-center" style="height: 60vh">
            <v-progress-circular indeterminate color="primary" />
          </div>
        </template>
      </Suspense>
    </RouterView>

    <v-footer class="text-center d-flex flex-column ga-1 py-6 mt-8" color="transparent">
      <div class="text-caption text-medium-emphasis">{{ t('app.privacy') }}</div>
      <div class="text-caption text-disabled">
        © {{ new Date().getFullYear() }} tools.littlechin.tw · {{ t('app.tagline') }}
      </div>
    </v-footer>
  </v-main>
</template>
