import { defineStore } from 'pinia'
import { ref } from 'vue'
import { nanoid } from '@/utils/nanoid'
import { useSettingsStore } from '@/stores/settings'
import type { HistoryEntry } from '@/types'

const STORAGE_KEY = 'app.history.v1'
const MAX_PER_TOOL = 100
// Saves for the same tool within this window update the latest entry in place,
// so typing produces one evolving entry instead of one entry per keystroke.
const COALESCE_MS = 15_000
const PERSIST_DEBOUNCE_MS = 400

function isValidEntry(e: unknown): e is HistoryEntry {
  if (typeof e !== 'object' || e === null) return false
  const o = e as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.toolId === 'string' &&
    typeof o.label === 'string' &&
    typeof o.createdAt === 'number' &&
    Number.isFinite(o.createdAt) &&
    'data' in o
  )
}

function load(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isValidEntry) : []
  } catch {
    return []
  }
}

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>(load())

  let persistTimer: ReturnType<typeof setTimeout> | undefined
  function persistNow() {
    persistTimer = undefined
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.value))
    } catch (e) {
      console.warn('[history] failed to persist', e)
    }
  }
  function persist() {
    if (persistTimer !== undefined) clearTimeout(persistTimer)
    persistTimer = setTimeout(persistNow, PERSIST_DEBOUNCE_MS)
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
      if (persistTimer !== undefined) {
        clearTimeout(persistTimer)
        persistNow()
      }
    })
  }

  function trimTool(toolId: string) {
    const ofTool = entries.value.filter((e) => e.toolId === toolId)
    if (ofTool.length > MAX_PER_TOOL) {
      const toRemove = new Set(ofTool.slice(MAX_PER_TOOL).map((e) => e.id))
      entries.value = entries.value.filter((e) => !toRemove.has(e.id))
    }
  }

  const settings = useSettingsStore()

  function add<T>(toolId: string, label: string, data: T): HistoryEntry<T> {
    const now = Date.now()
    // Recording is opt-out in Settings; return a detached entry so callers
    // don't need to special-case the disabled state.
    if (!settings.historyEnabled) {
      return { id: '', toolId, label: label.slice(0, 200), data, createdAt: now }
    }
    // Coalesce rapid successive saves (e.g. typing) into the tool's latest entry.
    const latest = entries.value.find((e) => e.toolId === toolId)
    if (latest && now - latest.createdAt < COALESCE_MS) {
      latest.label = label.slice(0, 200)
      latest.data = data
      latest.createdAt = now
      persist()
      return latest as HistoryEntry<T>
    }
    const entry: HistoryEntry<T> = {
      id: nanoid(),
      toolId,
      label: label.slice(0, 200),
      data,
      createdAt: now,
    }
    entries.value.unshift(entry as HistoryEntry)
    trimTool(toolId)
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
    const valid = incoming.filter(isValidEntry)
    if (mode === 'replace') {
      entries.value = valid
    } else {
      const seen = new Set(entries.value.map((e) => e.id))
      const fresh = valid.filter((e) => !seen.has(e.id))
      entries.value = [...fresh, ...entries.value].sort((a, b) => b.createdAt - a.createdAt)
    }
    for (const toolId of new Set(entries.value.map((e) => e.toolId))) trimTool(toolId)
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
