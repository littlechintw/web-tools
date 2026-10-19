import { onUnmounted } from 'vue'

/** Lazily-created AudioContext that is resumed on use (browsers start it
 *  suspended until a user gesture) and closed when the component unmounts. */
export function useAudioContext() {
  let ctx: AudioContext | null = null

  function get(): AudioContext {
    if (!ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  }

  /** Run `fn` with the context, swallowing "audio unavailable" errors. */
  function play(fn: (ctx: AudioContext) => void) {
    try {
      fn(get())
    } catch {
      // Audio is a nicety; never let it break the tool.
    }
  }

  onUnmounted(() => {
    ctx?.close().catch(() => {})
    ctx = null
  })

  return { get, play }
}
