import { computed } from 'vue'
import { useHistoryStore } from '@/stores/history'
import type { HistoryEntry } from '@/types'

/**
 * Scoped history helper for a single tool.
 *
 *   const history = useHistory('base64')
 *   history.save('Encoded "hello"', { mode: 'encode', input: 'hello' })
 *   history.entries.value // reactive list for this tool
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

  return { entries, save, remove, clear }
}
