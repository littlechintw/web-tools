import { computed, ref, shallowRef } from 'vue'

/**
 * Multi-level undo/redo over immutable snapshots.
 *
 *   const history = useUndoStack<ImageData>({ maxEntries: 30, maxBytes: 300e6, sizeOf: (s) => s.data.byteLength })
 *   history.push(currentSnapshot)        // before every destructive operation
 *   const prev = history.undo(current)   // returns the snapshot to restore, or undefined
 *   const next = history.redo(current)
 */
export function useUndoStack<T>(options: { maxEntries?: number; maxBytes?: number; sizeOf?: (s: T) => number } = {}) {
  const { maxEntries = 50, maxBytes = Infinity, sizeOf = () => 0 } = options
  const undoStack = shallowRef<T[]>([])
  const redoStack = shallowRef<T[]>([])
  const version = ref(0) // bumps so computed flags refresh after in-place edits

  const canUndo = computed(() => version.value >= 0 && undoStack.value.length > 0)
  const canRedo = computed(() => version.value >= 0 && redoStack.value.length > 0)

  function trim() {
    const stack = undoStack.value
    let bytes = stack.reduce((n, s) => n + sizeOf(s), 0)
    while (stack.length > maxEntries || (bytes > maxBytes && stack.length > 1)) {
      const dropped = stack.shift()
      if (dropped) bytes -= sizeOf(dropped)
    }
  }

  /** Record the state *before* a change. Clears the redo branch. */
  function push(snapshot: T) {
    undoStack.value = [...undoStack.value, snapshot]
    trim()
    redoStack.value = []
    version.value++
  }

  function undo(current: T): T | undefined {
    const stack = undoStack.value
    if (!stack.length) return undefined
    const prev = stack[stack.length - 1]
    undoStack.value = stack.slice(0, -1)
    redoStack.value = [...redoStack.value, current]
    version.value++
    return prev
  }

  function redo(current: T): T | undefined {
    const stack = redoStack.value
    if (!stack.length) return undefined
    const next = stack[stack.length - 1]
    redoStack.value = stack.slice(0, -1)
    undoStack.value = [...undoStack.value, current]
    version.value++
    return next
  }

  function clear() {
    undoStack.value = []
    redoStack.value = []
    version.value++
  }

  return { canUndo, canRedo, push, undo, redo, clear }
}

/** True for Ctrl/⌘+Z (undo) and Ctrl/⌘+Shift+Z or Ctrl+Y (redo) when not typing in a field. */
export function undoRedoShortcut(e: KeyboardEvent): 'undo' | 'redo' | null {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return null
  const el = document.activeElement as HTMLElement | null
  if (el?.closest('input, textarea, select, [contenteditable="true"]')) return null
  const key = e.key.toLowerCase()
  if (key === 'z') return e.shiftKey ? 'redo' : 'undo'
  if (key === 'y') return 'redo'
  return null
}
