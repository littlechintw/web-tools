import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { allTools } from '@/tools/registry'
import HomeView from '@/views/HomeView.vue'

const toolRoutes: RouteRecordRaw[] = allTools.map((tool) => ({
  path: `/${tool.route}`,
  name: `tool-${tool.id}`,
  component: tool.component,
  meta: { toolId: tool.id, title: tool.title },
}))

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView, meta: { title: { 'zh-TW': '首頁', en: 'Home' } } },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: { title: { 'zh-TW': '歷史紀錄', en: 'History' } },
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
