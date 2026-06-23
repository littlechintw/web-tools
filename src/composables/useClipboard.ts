import { ref } from 'vue'

/** Copy text to clipboard with a transient "copied" flag for UI feedback. */
export function useClipboard(resetMs = 1500) {
  const copied = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  async function copy(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for non-secure contexts.
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      copied.value = true
      clearTimeout(timer)
      timer = setTimeout(() => (copied.value = false), resetMs)
      return true
    } catch {
      return false
    }
  }

  return { copied, copy }
}
