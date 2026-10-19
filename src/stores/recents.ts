import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'app.recents.v1'
const MAX = 10

function load(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Recently opened tools, most recent first. Shown on the home page and in
 *  the command palette so the tools you actually use are one click away. */
export const useRecentsStore = defineStore('recents', () => {
  const ids = ref<string[]>(load())

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.value))
    } catch {
      // best-effort
    }
  }

  function touch(id: string) {
    ids.value = [id, ...ids.value.filter((x) => x !== id)].slice(0, MAX)
    persist()
  }

  function clear() {
    ids.value = []
    persist()
  }

  return { ids, touch, clear }
})
