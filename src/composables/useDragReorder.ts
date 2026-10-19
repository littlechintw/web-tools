import { onUnmounted, ref, type Ref } from 'vue'

/**
 * Pointer-based drag-to-reorder for a list or grid (mouse, pen and touch).
 *
 * Bind the container with `:ref="setContainer"` and give every item
 * `:data-index="i"`. Start a drag from a handle with
 * `@pointerdown="start(i, $event)"`; while the pointer moves over another
 * item the parent is told to move the dragged item there (`onMove(from, to)`)
 * so the list reorders live under the finger.
 *
 *   const { setContainer, dragging, start } = useDragReorder((from, to) => moveTo(from, to))
 *   <div :ref="setContainer"> <div v-for="(x, i)" :data-index="i" :class="{ 'is-dragging': dragging === i }">
 *     <v-icon class="drag-handle" icon="mdi-drag" @pointerdown="drag.start(i, $event)" />
 */
export function useDragReorder(onMove: (from: number, to: number) => void) {
  const containerRef: Ref<HTMLElement | null> = ref(null)
  /** Template ref callback: `<div :ref="setContainer">` (works with Vue's ref unwrapping). */
  const setContainer = (el: unknown) => {
    containerRef.value = el instanceof HTMLElement ? el : null
  }
  const dragging = ref<number | null>(null)
  let pointerId: number | null = null
  let lastClientY = 0
  let scrollTimer: number | null = null

  function itemAt(x: number, y: number): number | null {
    const root = containerRef.value
    if (!root) return null
    const items = root.querySelectorAll<HTMLElement>('[data-index]')
    let best: { index: number; dist: number } | null = null
    for (const el of items) {
      const r = el.getBoundingClientRect()
      const index = Number(el.dataset.index)
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return index
      // Fall back to the nearest item centre so dragging past the edges still reorders.
      const dx = Math.max(r.left - x, 0, x - r.right)
      const dy = Math.max(r.top - y, 0, y - r.bottom)
      const dist = dx * dx + dy * dy
      if (!best || dist < best.dist) best = { index, dist }
    }
    return best?.index ?? null
  }

  function onPointerMove(e: PointerEvent) {
    if (dragging.value === null || e.pointerId !== pointerId) return
    e.preventDefault()
    lastClientY = e.clientY
    const target = itemAt(e.clientX, e.clientY)
    if (target !== null && target !== dragging.value) {
      onMove(dragging.value, target)
      dragging.value = target
    }
  }

  // Keep the page scrolling when the pointer is held near the viewport edge.
  function autoScroll() {
    if (dragging.value === null) return
    const edge = 48
    const vh = window.innerHeight
    if (lastClientY < edge) window.scrollBy(0, -12)
    else if (lastClientY > vh - edge) window.scrollBy(0, 12)
    scrollTimer = window.setTimeout(autoScroll, 32)
  }

  function stop() {
    dragging.value = null
    pointerId = null
    if (scrollTimer !== null) {
      clearTimeout(scrollTimer)
      scrollTimer = null
    }
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', stop)
    window.removeEventListener('pointercancel', stop)
  }

  function start(index: number, e: PointerEvent) {
    if (e.button !== 0 || dragging.value !== null) return
    e.preventDefault()
    dragging.value = index
    pointerId = e.pointerId
    lastClientY = e.clientY
    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    autoScroll()
  }

  onUnmounted(stop)

  return { containerRef, setContainer, dragging, start }
}

/** Move one element of an array to a new position (pure). */
export function arrayMove<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice()
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
