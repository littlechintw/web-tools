/** Keeps the transcription worker (and the model loaded inside it) alive
 *  across route changes, so leaving the tool page and coming back doesn't
 *  force a full model reload. The View attaches its message handler on mount
 *  and detaches it on unmount; the worker itself survives. */

let worker: Worker | null = null
let handler: ((data: unknown) => void) | null = null
let loadedModel: string | null = null

export function getWhisperWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent) => handler?.(e.data)
  }
  return worker
}

export function setWhisperMessageHandler(h: ((data: unknown) => void) | null) {
  handler = h
}

export function whisperLoadedModel(): string | null {
  return loadedModel
}

export function setWhisperLoadedModel(m: string | null) {
  loadedModel = m
}

export function terminateWhisperWorker() {
  worker?.terminate()
  worker = null
  loadedModel = null
}
