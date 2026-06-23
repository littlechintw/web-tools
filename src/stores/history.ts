import { defineStore } from 'pinia'
import { ref } from 'vue'
import { nanoid } from '@/utils/nanoid'
import type { HistoryEntry } from '@/types'

const STORAGE_KEY = 'app.history.v1'
const MAX_PER_TOOL = 100

function load(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>(load())

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.value))
    } catch (e) {
      console.warn('[history] failed to persist', e)
    }
  }

  function add<T>(toolId: string, label: string, data: T): HistoryEntry<T> {
    const entry: HistoryEntry<T> = {
      id: nanoid(),
      toolId,
      label: label.slice(0, 200),
      data,
      createdAt: Date.now(),
    }
    entries.value.unshift(entry as HistoryEntry)
    // Trim per-tool history to avoid unbounded growth.
    const ofTool = entries.value.filter((e) => e.toolId === toolId)
    if (ofTool.length > MAX_PER_TOOL) {
      const toRemove = new Set(ofTool.slice(MAX_PER_TOOL).map((e) => e.id))
      entries.value = entries.value.filter((e) => !toRemove.has(e.id))
    }
    persist()
    return entry
  }

  function forTool(toolId: string): HistoryEntry[] {
    return entries.value.filter((e) => e.toolId === toolId)
  }

  function update(id: string, patch: Partial<Pick<HistoryEntry, 'label' | 'data'>>) {
    const e = entries.value.find((x) => x.id === id)
    if (!e) return
    if (patch.label !== undefined) e.label = patch.label
    if (patch.data !== undefined) e.data = patch.data
    persist()
  }

  function remove(id: string) {
    entries.value = entries.value.filter((e) => e.id !== id)
    persist()
  }

  function clearTool(toolId: string) {
    entries.value = entries.value.filter((e) => e.toolId !== toolId)
    persist()
  }

  function clearAll() {
    entries.value = []
    persist()
  }

  function importEntries(incoming: HistoryEntry[], mode: 'merge' | 'replace' = 'merge') {
    if (mode === 'replace') {
      entries.value = incoming
    } else {
      const seen = new Set(entries.value.map((e) => e.id))
      const fresh = incoming.filter((e) => !seen.has(e.id))
      entries.value = [...fresh, ...entries.value].sort((a, b) => b.createdAt - a.createdAt)
    }
    persist()
  }

  return {
    entries,
    add,
    forTool,
    update,
    remove,
    clearTool,
    clearAll,
    importEntries,
  }
})
