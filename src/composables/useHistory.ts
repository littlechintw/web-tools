import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useHistoryStore } from '@/stores/history'
import type { HistoryEntry } from '@/types'

/**
 * Scoped history helper for a single tool.
 *
 *   const history = useHistory<{ input: string }>('base64')
 *   history.save('Encoded "hello"', { input: 'hello' })
 *   history.entries.value               // reactive list for this tool
 *   history.restoreFromRoute((d) => …)  // reopen an entry from /tool?h=<id>
 */
export function useHistory<T = unknown>(toolId: string) {
  const store = useHistoryStore()

  const entries = computed(() => store.forTool(toolId) as HistoryEntry<T>[])

  function save(label: string, data: T) {
    return store.add<T>(toolId, label, data)
  }

  function remove(id: string) {
    store.remove(id)
  }

  function clear() {
    store.clearTool(toolId)
  }

  /**
   * Call during setup. When the History Manager opens an entry it navigates
   * to `/<tool>?h=<entry id>`; this hands that entry's data to `apply` once
   * the component is mounted.
   */
  function restoreFromRoute(apply: (data: T) => void) {
    const route = useRoute()
    onMounted(() => {
      const h = route.query.h
      if (typeof h !== 'string') return
      const e = entries.value.find((x) => x.id === h)
      if (e) apply(e.data)
    })
  }

  return { entries, save, remove, clear, restoreFromRoute }
}
