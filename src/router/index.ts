import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { nextTick } from 'vue'
import { allTools } from '@/tools/registry'
import HomeView from '@/views/HomeView.vue'
import { trackPageView } from '@/plugins/analytics'
import { shouldReloadForAds } from '@/config/ads'
import { isAdScriptLoaded } from '@/utils/adsense'

const toolRoutes: RouteRecordRaw[] = allTools.map((tool) => ({
  path: `/${tool.route}`,
  name: `tool-${tool.id}`,
  component: tool.component,
  meta: { toolId: tool.id, titleKey: `tools.${tool.id}.title` },
}))

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView, meta: { titleKey: 'nav.home' } },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: { titleKey: 'nav.history' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { titleKey: 'nav.settings' },
  },
  {
    path: '/privacy',
    name: 'privacy',
    component: () => import('@/views/PrivacyView.vue'),
    meta: { titleKey: 'privacyPage.title' },
  },
  ...toolRoutes,
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
  },
]

export const router = createRouter({
  history: createWebHistory('/'),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

// The ad script has full access to whatever page it runs in. Once it has been
// loaded (home / settings only), leaving for any other page is a full page load
// so the script is discarded before a tool that handles user data opens.
router.beforeEach((to) => {
  if (shouldReloadForAds(isAdScriptLoaded(), to.name)) {
    window.location.assign(to.fullPath)
    return false
  }
})

router.afterEach((to) => {
  // Wait for AppLayout's title watcher to flush before reading document.title
  nextTick(() => {
    trackPageView(to.fullPath, document.title)
  })
})
