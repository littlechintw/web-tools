import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { nextTick } from 'vue'
import { allTools } from '@/tools/registry'
import HomeView from '@/views/HomeView.vue'
import { trackPageView } from '@/plugins/analytics'

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
  scrollBehavior() {
    return { top: 0 }
  },
})

router.afterEach((to) => {
  // Wait for AppLayout's title watcher to flush before reading document.title
  nextTick(() => {
    trackPageView(to.fullPath, document.title)
  })
})
