import { ref } from 'vue'

/** Copy text to clipboard with a transient "copied" flag for UI feedback,
 *  plus a guarded read for paste buttons. */
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
        const ok = document.execCommand('copy')
        document.body.removeChild(ta)
        if (!ok) return false
      }
      copied.value = true
      clearTimeout(timer)
      timer = setTimeout(() => (copied.value = false), resetMs)
      return true
    } catch {
      return false
    }
  }

  /** Read clipboard text; null when unsupported or the user denied access. */
  async function read(): Promise<string | null> {
    try {
      if (!navigator.clipboard?.readText) return null
      return await navigator.clipboard.readText()
    } catch {
      return null
    }
  }

  return { copied, copy, read, canRead: typeof navigator !== 'undefined' && !!navigator.clipboard?.readText }
}
