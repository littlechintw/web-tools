// Runs entirely in a Web Worker so model download + inference never block the UI thread.
import { pipeline, env } from '@huggingface/transformers'
import type { AutomaticSpeechRecognitionPipeline, DeviceType, ProgressInfo } from '@huggingface/transformers'
import { SEGMENT_SECONDS, SAMPLE_RATE } from './constants'
import type { TranscriptChunk } from './srt'

env.allowLocalModels = false

type LoadRequest = { type: 'load'; model: string }
type TranscribeRequest = {
  type: 'transcribe'
  audio: Float32Array
  language: string
  prompt: string
}
/** One-shot transcription of a single (already-short) audio slice, used for
 *  live in-progress recordings — no internal further chunking. */
type TranscribeChunkRequest = {
  type: 'transcribe-chunk'
  requestId: number
  audio: Float32Array
  language: string
  prompt: string
  offsetSec: number
}
type InRequest = LoadRequest | TranscribeRequest | TranscribeChunkRequest

function buildOptions(language: string, prompt: string): Record<string, unknown> {
  const options: Record<string, unknown> = { task: 'transcribe', return_timestamps: true }
  if (language !== 'auto') options.language = language
  if (prompt.trim()) options.initial_prompt = prompt.trim()
  return options
}

// Memoize the in-flight load: worker messages are handled concurrently (async
// onmessage), so a second 'load' for the same model must reuse the pending
// promise instead of restarting the whole pipeline creation (which re-downloads
// the model), and transcribe requests that arrive mid-load must wait for it.
let transcriberPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null
let loadedModel: string | null = null

async function detectDevice(): Promise<DeviceType> {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu
  if (gpu) {
    try {
      if (await gpu.requestAdapter()) return 'webgpu'
    } catch {
      // WebGPU present but unusable (e.g. no adapter) — fall back to WASM.
    }
  }
  return 'wasm'
}

function loadModel(model: string): Promise<AutomaticSpeechRecognitionPipeline> {
  if (transcriberPromise && loadedModel === model) return transcriberPromise
  loadedModel = model
  const promise = (async () => {
    const device = await detectDevice()
    // Whisper's merged decoder graph fails session creation when fully int8-quantized
    // ("missing scale" error from onnxruntime-web's MatMulNBits dequant fusion), so only
    // the encoder is quantized; the decoder uses fp16 — still far smaller than fp32.
    return (await pipeline('automatic-speech-recognition', model, {
      device,
      dtype: { encoder_model: 'q8', decoder_model_merged: 'fp16' },
      progress_callback: (progress: ProgressInfo) => {
        self.postMessage({ type: 'progress', progress })
      },
    })) as AutomaticSpeechRecognitionPipeline
  })()
  transcriberPromise = promise
  // A failed load must not poison future retries.
  promise.catch(() => {
    if (transcriberPromise === promise) {
      transcriberPromise = null
      loadedModel = null
    }
  })
  return promise
}

/** Resolves once the current model is loaded; waits out an in-flight load. */
function getTranscriber(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!transcriberPromise) throw new Error('model-not-loaded')
  return transcriberPromise
}

/** Transcribes in fixed-length segments (instead of one long call) so progress
 *  and partial text can be reported back as each segment finishes. */
async function transcribeInSegments(
  transcriber: AutomaticSpeechRecognitionPipeline,
  audio: Float32Array,
  language: string,
  prompt: string,
) {
  const segmentLength = SEGMENT_SECONDS * SAMPLE_RATE
  const total = Math.max(1, Math.ceil(audio.length / segmentLength))
  let fullText = ''
  const allChunks: TranscriptChunk[] = []

  for (let i = 0; i < total; i++) {
    const start = i * segmentLength
    const segment = audio.subarray(start, start + segmentLength)
    const output = await transcriber(segment, buildOptions(language, prompt))
    const offsetSec = start / SAMPLE_RATE
    const segmentChunks: TranscriptChunk[] = (output.chunks ?? []).map((c: TranscriptChunk) => ({
      text: c.text,
      timestamp: [c.timestamp[0] + offsetSec, c.timestamp[1] == null ? null : c.timestamp[1] + offsetSec],
    }))
    const segmentText = (output.text as string).trim()
    fullText = fullText ? `${fullText} ${segmentText}` : segmentText
    allChunks.push(...segmentChunks)

    self.postMessage({
      type: 'segment',
      index: i + 1,
      total,
      fullTextSoFar: fullText,
      chunksSoFar: allChunks,
    })
  }

  return { text: fullText, chunks: allChunks }
}

self.onmessage = async (event: MessageEvent<InRequest>) => {
  const msg = event.data
  try {
    if (msg.type === 'load') {
      await loadModel(msg.model)
      self.postMessage({ type: 'ready' })
      return
    }

    if (msg.type === 'transcribe') {
      const transcriber = await getTranscriber()
      const output = await transcribeInSegments(transcriber, msg.audio, msg.language, msg.prompt)
      self.postMessage({ type: 'complete', output })
      return
    }

    if (msg.type === 'transcribe-chunk') {
      // Waits for an in-flight model load instead of failing, so live chunks
      // sent while the model is still downloading aren't lost.
      const transcriber = await getTranscriber()
      const output = await transcriber(msg.audio, buildOptions(msg.language, msg.prompt))
      const chunks: TranscriptChunk[] = (output.chunks ?? []).map((c: TranscriptChunk) => ({
        text: c.text,
        timestamp: [c.timestamp[0] + msg.offsetSec, c.timestamp[1] == null ? null : c.timestamp[1] + msg.offsetSec],
      }))
      self.postMessage({
        type: 'chunk-result',
        requestId: msg.requestId,
        text: (output.text as string).trim(),
        chunks,
      })
      return
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (msg.type === 'transcribe-chunk') {
      self.postMessage({ type: 'chunk-error', requestId: msg.requestId, message })
    } else {
      self.postMessage({ type: 'error', message })
    }
  }
}
