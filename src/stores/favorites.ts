import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'app.favorites.v1'

function load(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const useFavoritesStore = defineStore('favorites', () => {
  const ids = ref<string[]>(load())

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.value))
  }

  function isFavorite(id: string) {
    return ids.value.includes(id)
  }

  function toggle(id: string) {
    if (isFavorite(id)) {
      ids.value = ids.value.filter((x) => x !== id)
    } else {
      ids.value = [...ids.value, id]
    }
    persist()
  }

  return { ids, isFavorite, toggle }
})
