<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import FileDrop from '@/components/FileDrop.vue'
import { chunksToSrt, type TranscriptChunk } from './srt'
import {
  SEGMENT_SECONDS,
  SAMPLE_RATE,
  LIVE_START_INTERVAL_S,
  LIVE_MAX_INTERVAL_S,
  TRANSFORMERS_CACHE_NAME,
} from './constants'
import type { ProgressInfo } from '@huggingface/transformers'

const { t } = useI18n()

// ---------------------------------------------------------------------------
// Recording state
// ---------------------------------------------------------------------------

type MicState = 'idle' | 'recording' | 'paused'
const micState = ref<MicState>('idle')
const micError = ref('')
const elapsedMs = ref(0)
const recordedBlob = ref<Blob | null>(null)
const recordedUrl = ref<string | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)

let mediaRecorder: MediaRecorder | null = null
let mediaStream: MediaStream | null = null
let audioChunks: Blob[] = []
let timerHandle: ReturnType<typeof setInterval> | null = null
let recordingStartedAt = 0
let pausedAccum = 0
let pausedAt = 0

let liveContext: AudioContext | null = null
let liveAnalyser: AnalyserNode | null = null
let liveRafId = 0

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

const elapsedLabel = computed(() => {
  const totalSec = Math.floor(elapsedMs.value / 1000)
  return `${pad2(Math.floor(totalSec / 60))}:${pad2(totalSec % 60)}`
})

function pickMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
  return candidates.find((c) => MediaRecorder.isTypeSupported(c))
}

// ---------------------------------------------------------------------------
// Waveform: live amplitude while recording, static peaks + playhead after
// ---------------------------------------------------------------------------

const WAVEFORM_BUCKETS = 200
const waveformPeaks = ref<number[]>([])
const playbackFraction = ref(0)
const audioDuration = ref(0)

function drawLiveFrame(data: Uint8Array) {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  const { width, height } = canvas
  ctx.clearRect(0, 0, width, height)
  ctx.lineWidth = 2
  ctx.strokeStyle = '#1976d2'
  ctx.beginPath()
  const slice = width / data.length
  let x = 0
  for (let i = 0; i < data.length; i++) {
    const y = (data[i] / 128) * (height / 2)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
    x += slice
  }
  ctx.stroke()
}

function startLiveVisualizer(stream: MediaStream) {
  liveContext = new AudioContext()
  liveAnalyser = liveContext.createAnalyser()
  liveAnalyser.fftSize = 256
  liveContext.createMediaStreamSource(stream).connect(liveAnalyser)

  const data = new Uint8Array(liveAnalyser.frequencyBinCount)
  const render = () => {
    if (!liveAnalyser) return
    liveAnalyser.getByteTimeDomainData(data)
    drawLiveFrame(data)
    liveRafId = requestAnimationFrame(render)
  }
  liveRafId = requestAnimationFrame(render)
}

function stopLiveVisualizer() {
  if (liveRafId) cancelAnimationFrame(liveRafId)
  liveRafId = 0
  liveAnalyser = null
  liveContext?.close()
  liveContext = null
}

async function computeWaveformPeaks(blob: Blob): Promise<number[]> {
  const arrayBuffer = await blob.arrayBuffer()
  const ctx = new AudioContext()
  try {
    const buffer = await ctx.decodeAudioData(arrayBuffer)
    const data = buffer.getChannelData(0)
    const bucketSize = Math.max(1, Math.floor(data.length / WAVEFORM_BUCKETS))
    const peaks: number[] = []
    for (let i = 0; i < WAVEFORM_BUCKETS; i++) {
      const start = i * bucketSize
      let max = 0
      for (let j = start; j < start + bucketSize && j < data.length; j++) {
        const v = Math.abs(data[j])
        if (v > max) max = v
      }
      peaks.push(max)
    }
    return peaks
  } finally {
    void ctx.close()
  }
}

function drawStaticWaveform() {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  const peaks = waveformPeaks.value
  if (!canvas || !ctx || !peaks.length) return
  const { width, height } = canvas
  ctx.clearRect(0, 0, width, height)
  const mid = height / 2

  if (segmentProgress.value && audioDuration.value > 0) {
    const segStart = (segmentProgress.value.index - 1) * SEGMENT_SECONDS
    const segEnd = Math.min(segmentProgress.value.index * SEGMENT_SECONDS, audioDuration.value)
    const x1 = (segStart / audioDuration.value) * width
    const x2 = (segEnd / audioDuration.value) * width
    ctx.fillStyle = 'rgba(255, 152, 0, 0.35)'
    ctx.fillRect(x1, 0, Math.max(1, x2 - x1), height)
  }

  const barWidth = width / peaks.length
  ctx.fillStyle = '#1976d2'
  for (let i = 0; i < peaks.length; i++) {
    const barHeight = Math.max(2, peaks[i] * height)
    ctx.fillRect(i * barWidth, mid - barHeight / 2, Math.max(1, barWidth - 1), barHeight)
  }

  if (audioDuration.value > 0) {
    const x = playbackFraction.value * width
    ctx.strokeStyle = '#e53935'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
}

const currentTime = ref(0)

function onAudioLoadedMetadata() {
  audioDuration.value = audioRef.value?.duration || 0
  drawStaticWaveform()
}

function onAudioTimeUpdate() {
  if (!audioRef.value || !audioDuration.value) return
  currentTime.value = audioRef.value.currentTime
  playbackFraction.value = audioRef.value.currentTime / audioDuration.value
  drawStaticWaveform()
}

function onAudioEnded() {
  currentTime.value = 0
  playbackFraction.value = 0
  drawStaticWaveform()
}

// ---------------------------------------------------------------------------
// Shared: adopt a Blob (from the recorder or an uploaded file) as the active audio
// ---------------------------------------------------------------------------

const uploadError = ref('')

function setRecordedAudio(blob: Blob, opts: { keepTranscript?: boolean } = {}) {
  if (recordedUrl.value) URL.revokeObjectURL(recordedUrl.value)
  recordedBlob.value = blob
  recordedUrl.value = URL.createObjectURL(blob)
  if (!opts.keepTranscript) {
    resultText.value = ''
    resultChunks.value = []
    segmentProgress.value = null
  }
  errorMessage.value = ''
  playbackFraction.value = 0
  audioDuration.value = 0
  currentTime.value = 0
  waveformPeaks.value = []
  void computeWaveformPeaks(blob)
    .then((peaks) => {
      waveformPeaks.value = peaks
      drawStaticWaveform()
    })
    .catch(() => {
      uploadError.value = t('tools.whisper-transcribe.uploadError')
    })
}

function onFilesSelected(files: File[]) {
  const file = files[0]
  if (!file || micState.value !== 'idle') return
  micError.value = ''
  uploadError.value = ''
  setRecordedAudio(file)
}

// ---------------------------------------------------------------------------
// Recording controls
// ---------------------------------------------------------------------------

async function startRecording() {
  // a running file transcription would otherwise keep overwriting the new
  // recording's transcript via its segment/complete messages
  if (phase.value !== 'idle') return
  micError.value = ''
  errorMessage.value = ''
  resultText.value = ''
  resultChunks.value = []
  segmentProgress.value = null
  waveformPeaks.value = []
  playbackFraction.value = 0
  audioDuration.value = 0
  if (recordedUrl.value) URL.revokeObjectURL(recordedUrl.value)
  recordedUrl.value = null
  recordedBlob.value = null

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch {
    micError.value = t('tools.whisper-transcribe.micDenied')
    return
  }

  audioChunks = []
  const mimeType = pickMimeType()
  mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined)
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data)
  }
  mediaRecorder.onstop = () => {
    const mime = mediaRecorder?.mimeType || 'audio/webm'
    const blob = new Blob(audioChunks, { type: mime })
    mediaStream?.getTracks().forEach((tr) => tr.stop())
    mediaStream = null
    mediaRecorder = null
    void finishStop(blob)
  }
  mediaRecorder.start()
  startLiveVisualizer(mediaStream)

  recordingStartedAt = performance.now()
  pausedAccum = 0
  elapsedMs.value = 0
  micState.value = 'recording'
  timerHandle = setInterval(() => {
    elapsedMs.value = performance.now() - recordingStartedAt - pausedAccum
  }, 200)

  if (transcribeMode.value === 'live') {
    resetLiveState()
    ensureModelLoaded(() => scheduleLiveTick(0))
  }
}

async function finishStop(blob: Blob) {
  if (liveTimer) {
    clearTimeout(liveTimer)
    liveTimer = null
  }
  const wasLive = transcribeMode.value === 'live'
  if (wasLive) await liveFinalTick(blob)
  setRecordedAudio(blob, { keepTranscript: wasLive })
}

function pauseRecording() {
  if (!mediaRecorder || micState.value !== 'recording') return
  mediaRecorder.pause()
  if (timerHandle) clearInterval(timerHandle)
  timerHandle = null
  if (liveTimer) {
    clearTimeout(liveTimer)
    liveTimer = null
  }
  pausedAt = performance.now()
  micState.value = 'paused'
}

function resumeRecording() {
  if (!mediaRecorder || micState.value !== 'paused') return
  mediaRecorder.resume()
  pausedAccum += performance.now() - pausedAt
  micState.value = 'recording'
  timerHandle = setInterval(() => {
    elapsedMs.value = performance.now() - recordingStartedAt - pausedAccum
  }, 200)
  if (transcribeMode.value === 'live' && !liveDisabled.value && !liveTickInFlight) {
    scheduleLiveTick(liveIntervalSec.value * 1000)
  }
}

function stopRecording() {
  if (!mediaRecorder) return
  if (liveTimer) {
    clearTimeout(liveTimer)
    liveTimer = null
  }
  mediaRecorder.stop()
  micState.value = 'idle'
  if (timerHandle) clearInterval(timerHandle)
  timerHandle = null
  stopLiveVisualizer()
}

// ---------------------------------------------------------------------------
// Recognition settings
// ---------------------------------------------------------------------------

const MODELS = ['Xenova/whisper-tiny', 'Xenova/whisper-base'] as const
type ModelId = (typeof MODELS)[number]
const model = ref<ModelId>('Xenova/whisper-tiny')

const LANGUAGES = ['auto', 'zh', 'en', 'ja'] as const
type LanguageId = (typeof LANGUAGES)[number]
const language = ref<LanguageId>('zh')

const promptText = ref('')

const TRANSCRIBE_MODES = ['after', 'live'] as const
type TranscribeMode = (typeof TRANSCRIBE_MODES)[number]
const transcribeMode = ref<TranscribeMode>('after')

const modelItems = computed(() => [
  { title: t('tools.whisper-transcribe.modelTiny'), value: 'Xenova/whisper-tiny' },
  { title: t('tools.whisper-transcribe.modelBase'), value: 'Xenova/whisper-base' },
])

const languageItems = computed(() => [
  { title: t('tools.whisper-transcribe.languageAuto'), value: 'auto' },
  { title: t('tools.whisper-transcribe.languageZh'), value: 'zh' },
  { title: t('tools.whisper-transcribe.languageEn'), value: 'en' },
  { title: t('tools.whisper-transcribe.languageJa'), value: 'ja' },
])

// ---------------------------------------------------------------------------
// Transcription (delegated to a Web Worker so the UI never freezes)
// ---------------------------------------------------------------------------

type Phase = 'idle' | 'loading-model' | 'transcribing'
const phase = ref<Phase>('idle')
const modelProgress = ref(0)
const modelLoadedBytes = ref(0)
const modelTotalBytes = ref(0)
const modelLoadedFor = ref<ModelId | null>(null)
const segmentProgress = ref<{ index: number; total: number } | null>(null)
const resultText = ref('')
const resultChunks = ref<TranscriptChunk[]>([])
const errorMessage = ref('')

watch(segmentProgress, () => drawStaticWaveform())

const activeChunkIndex = computed(() => {
  if (!resultChunks.value.length) return -1
  const t = currentTime.value
  for (let i = 0; i < resultChunks.value.length; i++) {
    const [start, end] = resultChunks.value[i].timestamp
    const chunkEnd = end ?? resultChunks.value[i + 1]?.timestamp[0] ?? Infinity
    if (t >= start && t < chunkEnd) return i
  }
  return -1
})

const rowRefs = ref<(HTMLElement | null)[]>([])

function setRowRef(el: unknown, index: number) {
  rowRefs.value[index] = el as HTMLElement | null
}

watch(activeChunkIndex, (index) => {
  if (index < 0) return
  rowRefs.value[index]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
})

let worker: Worker | null = null
let onModelReady: (() => void) | null = null
const liveRequestResolvers = new Map<
  number,
  { resolve: (r: { text: string; chunks: TranscriptChunk[] }) => void; reject: (err: Error) => void }
>()

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent) => {
    const msg = e.data
    if (msg.type === 'progress') {
      const p = msg.progress as ProgressInfo
      if (p.status === 'progress_total') {
        modelProgress.value = Math.round(p.progress)
        modelLoadedBytes.value = p.loaded
        modelTotalBytes.value = p.total
      }
    } else if (msg.type === 'ready') {
      // record the model the worker was asked to load, not whatever is
      // currently selected in the UI (the user may have switched mid-load)
      modelLoadedFor.value = modelLoadRequested ?? model.value
      modelProgress.value = 100
      phase.value = 'idle'
      void refreshCachedModels()
      const cb = onModelReady
      onModelReady = null
      cb?.()
    } else if (msg.type === 'segment') {
      segmentProgress.value = { index: msg.index, total: msg.total }
      resultText.value = msg.fullTextSoFar
      resultChunks.value = msg.chunksSoFar as TranscriptChunk[]
    } else if (msg.type === 'complete') {
      phase.value = 'idle'
      segmentProgress.value = null
      resultText.value = msg.output.text ?? ''
      resultChunks.value = (msg.output.chunks ?? []) as TranscriptChunk[]
    } else if (msg.type === 'error') {
      phase.value = 'idle'
      segmentProgress.value = null
      errorMessage.value = msg.message
    } else if (msg.type === 'chunk-result') {
      const pending = liveRequestResolvers.get(msg.requestId)
      if (pending) {
        liveRequestResolvers.delete(msg.requestId)
        pending.resolve({ text: msg.text, chunks: msg.chunks as TranscriptChunk[] })
      }
    } else if (msg.type === 'chunk-error') {
      const pending = liveRequestResolvers.get(msg.requestId)
      if (pending) {
        liveRequestResolvers.delete(msg.requestId)
        pending.reject(new Error(msg.message))
      }
    }
  }
  return worker
}

async function decodeToMono16k(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer()
  const ctx = new AudioContext({ sampleRate: 16000 })
  try {
    const buffer = await ctx.decodeAudioData(arrayBuffer)
    if (buffer.numberOfChannels === 1) return buffer.getChannelData(0).slice()
    const mono = new Float32Array(buffer.length)
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < buffer.length; i++) mono[i] += data[i] / buffer.numberOfChannels
    }
    return mono
  } finally {
    void ctx.close()
  }
}

async function startTranscription() {
  if (!recordedBlob.value) return
  phase.value = 'transcribing'
  segmentProgress.value = null
  try {
    const audio = await decodeToMono16k(recordedBlob.value)
    getWorker().postMessage(
      { type: 'transcribe', audio, language: language.value, prompt: promptText.value },
      [audio.buffer],
    )
  } catch (err) {
    phase.value = 'idle'
    errorMessage.value = err instanceof Error ? err.message : String(err)
  }
}

let modelLoadRequested: ModelId | null = null

function ensureModelLoaded(onReady: () => void) {
  if (modelLoadedFor.value === model.value) {
    onReady()
    return
  }
  phase.value = 'loading-model'
  modelProgress.value = 0
  modelLoadedBytes.value = 0
  modelTotalBytes.value = 0
  onModelReady = onReady
  modelLoadRequested = model.value
  getWorker().postMessage({ type: 'load', model: model.value })
}

function generateTranscript() {
  if (!recordedBlob.value) return
  errorMessage.value = ''
  resultText.value = ''
  resultChunks.value = []
  segmentProgress.value = null
  ensureModelLoaded(() => void startTranscription())
}

const canStartTranscribe = computed(() => !!recordedBlob.value && phase.value === 'idle')
const modelBusy = computed(() => phase.value === 'loading-model')
const transcribingNow = computed(() => phase.value === 'transcribing')
const segmentProgressPercent = computed(() =>
  segmentProgress.value ? Math.round((segmentProgress.value.index / segmentProgress.value.total) * 100) : 0,
)

// ---------------------------------------------------------------------------
// Live transcription (runs periodically while still recording)
// ---------------------------------------------------------------------------

const liveIntervalSec = ref(LIVE_START_INTERVAL_S)
const liveWarning = ref('')
const liveDisabled = ref(false)

let liveTimer: ReturnType<typeof setTimeout> | null = null
let liveProcessedSamples = 0
let liveRequestSeq = 0
let liveTickInFlight = false

function postLiveChunk(
  audio: Float32Array,
  lang: string,
  prompt: string,
  offsetSec: number,
): Promise<{ text: string; chunks: TranscriptChunk[] }> {
  const requestId = ++liveRequestSeq
  return new Promise((resolve, reject) => {
    liveRequestResolvers.set(requestId, { resolve, reject })
    getWorker().postMessage(
      { type: 'transcribe-chunk', requestId, audio, language: lang, prompt, offsetSec },
      [audio.buffer],
    )
  })
}

function appendLiveResult(text: string, chunks: TranscriptChunk[]) {
  if (text) resultText.value = resultText.value ? `${resultText.value} ${text}` : text
  if (chunks.length) resultChunks.value = [...resultChunks.value, ...chunks]
}

function resetLiveState() {
  liveIntervalSec.value = LIVE_START_INTERVAL_S
  liveWarning.value = ''
  liveDisabled.value = false
  liveProcessedSamples = 0
  liveTickInFlight = false
}

/** Backs off the cadence proportionally when a chunk takes longer than the
 *  audio it covers; gives up live mode entirely if even the slowest cadence
 *  can't keep up (the final "regenerate" pass afterward is always accurate). */
function adjustLiveInterval(elapsedMs: number, coveredSeconds: number) {
  const ratio = elapsedMs / 1000 / coveredSeconds
  if (ratio > 1) {
    if (liveIntervalSec.value >= LIVE_MAX_INTERVAL_S) {
      liveDisabled.value = true
      liveWarning.value = t('tools.whisper-transcribe.liveGaveUp')
      if (liveTimer) clearTimeout(liveTimer)
      liveTimer = null
      return
    }
    liveIntervalSec.value = Math.min(LIVE_MAX_INTERVAL_S, Math.max(liveIntervalSec.value, elapsedMs / 1000) * 1.3)
    liveWarning.value = t('tools.whisper-transcribe.liveSlowedDown', {
      seconds: Math.round(liveIntervalSec.value),
    })
  } else {
    if (ratio < 0.6 && liveIntervalSec.value > LIVE_START_INTERVAL_S) {
      liveIntervalSec.value = Math.max(LIVE_START_INTERVAL_S, liveIntervalSec.value * 0.8)
    }
    liveWarning.value = ''
  }
}

function scheduleLiveTick(delayMs: number) {
  if (liveTimer) clearTimeout(liveTimer)
  liveTimer = setTimeout(() => void liveTick(), delayMs)
}

async function liveTick() {
  liveTimer = null
  if (micState.value !== 'recording' || liveDisabled.value || !mediaRecorder) return
  liveTickInFlight = true
  const t0 = performance.now()
  try {
    const recorder = mediaRecorder
    await new Promise<void>((resolve) => {
      recorder.addEventListener('dataavailable', () => resolve(), { once: true })
      recorder.requestData()
    })
    const blob = new Blob(audioChunks, { type: recorder.mimeType || 'audio/webm' })
    // Re-decoding the whole (ever-growing) blob each tick is itself part of the
    // per-tick cost, so it's included in the timing below — otherwise the
    // scheduler would under-react as recordings get long and decoding slows down.
    const fullAudio = await decodeToMono16k(blob)
    const newAudio = fullAudio.subarray(liveProcessedSamples)
    const newSeconds = newAudio.length / SAMPLE_RATE
    if (newSeconds < 1) return

    const offsetSec = liveProcessedSamples / SAMPLE_RATE
    const result = await postLiveChunk(newAudio.slice(), language.value, promptText.value, offsetSec)
    const elapsedMs = performance.now() - t0

    liveProcessedSamples += newAudio.length
    appendLiveResult(result.text, result.chunks)
    adjustLiveInterval(elapsedMs, newSeconds)
  } catch (err) {
    liveWarning.value = err instanceof Error ? err.message : String(err)
  } finally {
    liveTickInFlight = false
    if (micState.value === 'recording' && !liveDisabled.value) {
      scheduleLiveTick(liveIntervalSec.value * 1000)
    }
  }
}

/** Catches whatever trailing audio the last live tick hadn't covered yet. */
async function liveFinalTick(blob: Blob) {
  while (liveTickInFlight) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  if (liveDisabled.value) return
  try {
    const fullAudio = await decodeToMono16k(blob)
    const remaining = fullAudio.subarray(liveProcessedSamples)
    if (remaining.length / SAMPLE_RATE < 0.3) return
    const offsetSec = liveProcessedSamples / SAMPLE_RATE
    const result = await postLiveChunk(remaining.slice(), language.value, promptText.value, offsetSec)
    liveProcessedSamples = fullAudio.length
    appendLiveResult(result.text, result.chunks)
  } catch {
    // Best-effort — the user can always hit "regenerate" for a full, accurate pass.
  }
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

function timestampLabel(): string {
  const d = new Date()
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}`
}

function formatChunkTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`
}

function extensionFor(mime: string): string {
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a'
  if (mime.includes('flac')) return 'flac'
  return 'webm'
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Works both mid-recording (snapshots what's captured so far via requestData)
 *  and after the recording has fully stopped. */
async function downloadRecording() {
  if (mediaRecorder && micState.value !== 'idle') {
    const recorder = mediaRecorder
    await new Promise<void>((resolve) => {
      recorder.addEventListener('dataavailable', () => resolve(), { once: true })
      recorder.requestData()
    })
    const blob = new Blob(audioChunks, { type: recorder.mimeType || 'audio/webm' })
    triggerDownload(blob, `recording_${timestampLabel()}.${extensionFor(blob.type)}`)
    return
  }
  if (!recordedBlob.value) return
  const blob = recordedBlob.value
  const filename = blob instanceof File ? blob.name : `recording_${timestampLabel()}.${extensionFor(blob.type)}`
  triggerDownload(blob, filename)
}

function downloadTxt() {
  if (!resultText.value) return
  triggerDownload(
    new Blob([resultText.value], { type: 'text/plain;charset=utf-8' }),
    `transcript_${timestampLabel()}.txt`,
  )
}

function downloadSrt() {
  if (!resultChunks.value.length) return
  triggerDownload(
    new Blob([chunksToSrt(resultChunks.value)], { type: 'application/x-subrip;charset=utf-8' }),
    `transcript_${timestampLabel()}.srt`,
  )
}

const canDownloadRecording = computed(() => micState.value !== 'idle' || !!recordedBlob.value)

// ---------------------------------------------------------------------------
// Cached model management (transformers.js stores downloads in Cache Storage)
// ---------------------------------------------------------------------------

interface CachedModelInfo {
  id: string
  bytes: number
}

const cachedModels = ref<CachedModelInfo[]>([])
const cacheLoading = ref(false)
const cacheError = ref('')

function modelIdFromCacheUrl(url: string): string | null {
  const m = url.match(/huggingface\.co\/([^/]+\/[^/]+)\/resolve\//)
  return m ? m[1] : null
}

async function refreshCachedModels() {
  if (!('caches' in window)) return
  cacheLoading.value = true
  cacheError.value = ''
  try {
    const cache = await caches.open(TRANSFORMERS_CACHE_NAME)
    const requests = await cache.keys()
    const totals = new Map<string, number>()
    for (const req of requests) {
      const id = modelIdFromCacheUrl(req.url)
      if (!id) continue
      const res = await cache.match(req)
      const blob = await res?.blob()
      totals.set(id, (totals.get(id) ?? 0) + (blob?.size ?? 0))
    }
    cachedModels.value = Array.from(totals, ([id, bytes]) => ({ id, bytes })).sort((a, b) =>
      a.id.localeCompare(b.id),
    )
  } catch (err) {
    cacheError.value = err instanceof Error ? err.message : String(err)
  } finally {
    cacheLoading.value = false
  }
}

/** Terminate the worker and settle everything waiting on it, so no promise
 *  hangs and the UI can't get stuck in a busy phase forever. */
function teardownWorker() {
  worker?.terminate()
  worker = null
  onModelReady = null
  modelLoadRequested = null
  for (const pending of liveRequestResolvers.values()) {
    pending.reject(new Error('worker terminated'))
  }
  liveRequestResolvers.clear()
  if (phase.value === 'loading-model' || phase.value === 'transcribing') {
    phase.value = 'idle'
    segmentProgress.value = null
  }
}

/** Deleting the model that's currently loaded in the worker just forces a
 *  fresh re-download next time — the live session already in memory keeps
 *  working until the worker is recreated. */
function forgetLoadedWorkerIfMatches(id: string) {
  if (modelLoadedFor.value !== id) return
  modelLoadedFor.value = null
  teardownWorker()
}

async function deleteCachedModel(id: string) {
  const cache = await caches.open(TRANSFORMERS_CACHE_NAME)
  const requests = await cache.keys()
  await Promise.all(
    requests.filter((req) => modelIdFromCacheUrl(req.url) === id).map((req) => cache.delete(req)),
  )
  forgetLoadedWorkerIfMatches(id)
  await refreshCachedModels()
}

async function clearAllCachedModels() {
  await caches.delete(TRANSFORMERS_CACHE_NAME)
  modelLoadedFor.value = null
  teardownWorker()
  await refreshCachedModels()
}

onMounted(() => {
  void refreshCachedModels()
})

onBeforeUnmount(() => {
  if (timerHandle) clearInterval(timerHandle)
  if (liveTimer) clearTimeout(liveTimer)
  stopLiveVisualizer()
  mediaStream?.getTracks().forEach((tr) => tr.stop())
  if (recordedUrl.value) URL.revokeObjectURL(recordedUrl.value)
  worker?.terminate()
})
</script>

<template>
  <ToolShell>
    <v-alert type="info" variant="tonal" density="comfortable" class="mb-4">
      {{ t('tools.whisper-transcribe.privacyNote') }}
    </v-alert>

    <v-card variant="outlined" class="pa-4 mb-4">
      <div class="text-subtitle-1 font-weight-medium mb-3">{{ t('tools.whisper-transcribe.settingsTitle') }}</div>

      <div class="mb-4">
        <div class="text-caption text-medium-emphasis mb-1">
          {{ t('tools.whisper-transcribe.transcribeModeLabel') }}
        </div>
        <v-btn-toggle
          v-model="transcribeMode"
          mandatory
          color="primary"
          density="comfortable"
          variant="outlined"
          :disabled="micState !== 'idle'"
        >
          <v-btn value="after">{{ t('tools.whisper-transcribe.transcribeModeAfter') }}</v-btn>
          <v-btn value="live">{{ t('tools.whisper-transcribe.transcribeModeLive') }}</v-btn>
        </v-btn-toggle>
      </div>

      <v-row dense>
        <v-col cols="12" sm="6">
          <v-select
            v-model="model"
            :items="modelItems"
            :label="t('tools.whisper-transcribe.modelLabel')"
            hide-details
            density="comfortable"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-select
            v-model="language"
            :items="languageItems"
            :label="t('tools.whisper-transcribe.languageLabel')"
            hide-details
            density="comfortable"
          />
        </v-col>
        <v-col cols="12">
          <v-textarea
            v-model="promptText"
            :label="t('tools.whisper-transcribe.promptLabel')"
            :hint="t('tools.whisper-transcribe.promptHint')"
            persistent-hint
            rows="2"
            auto-grow
          />
        </v-col>
      </v-row>

      <v-btn
        v-if="recordedUrl"
        color="primary"
        class="mt-3"
        prepend-icon="mdi-text-recognition"
        :loading="modelBusy || transcribingNow"
        :disabled="!canStartTranscribe"
        @click="generateTranscript"
      >
        {{ t('tools.whisper-transcribe.generateTranscript') }}
      </v-btn>
      <div v-else-if="micState === 'idle'" class="text-caption text-medium-emphasis mt-3">
        {{ t('tools.whisper-transcribe.noAudioYet') }}
      </div>

      <div v-if="modelBusy" class="mt-3">
        <div class="text-caption text-medium-emphasis mb-1">
          {{
            t('tools.whisper-transcribe.loadingModel', {
              percent: modelProgress,
              loaded: formatMB(modelLoadedBytes),
              total: formatMB(modelTotalBytes),
            })
          }}
        </div>
        <v-progress-linear :model-value="modelProgress" color="primary" height="8" rounded />
      </div>
      <div v-else-if="transcribingNow" class="mt-3">
        <div class="text-caption text-medium-emphasis mb-1">
          {{
            segmentProgress
              ? t('tools.whisper-transcribe.transcribingSegment', {
                  index: segmentProgress.index,
                  total: segmentProgress.total,
                })
              : t('tools.whisper-transcribe.transcribing')
          }}
        </div>
        <v-progress-linear
          :indeterminate="!segmentProgress"
          :model-value="segmentProgressPercent"
          color="primary"
          height="8"
          rounded
        />
      </div>

      <v-alert v-if="errorMessage" type="error" variant="tonal" density="compact" class="mt-3">
        {{ errorMessage }}
      </v-alert>
    </v-card>

    <v-card variant="outlined" class="pa-4 mb-4">
      <div class="d-flex flex-wrap align-center ga-4">
        <div class="text-h5 font-weight-medium" style="min-width: 5ch">{{ elapsedLabel }}</div>
        <canvas ref="canvasRef" width="320" height="60" class="visualizer rounded" />
        <v-spacer />
        <div class="d-flex ga-2">
          <v-btn
            v-if="canDownloadRecording"
            variant="outlined"
            prepend-icon="mdi-download"
            @click="downloadRecording"
          >
            {{ t('tools.whisper-transcribe.downloadRecording') }}
          </v-btn>
          <v-btn v-if="micState === 'idle'" color="primary" prepend-icon="mdi-microphone" @click="startRecording">
            {{ t('tools.whisper-transcribe.startRecording') }}
          </v-btn>
          <template v-else>
            <v-btn
              v-if="micState === 'recording'"
              icon="mdi-pause"
              variant="tonal"
              :title="t('tools.whisper-transcribe.pauseRecording')"
              @click="pauseRecording"
            />
            <v-btn
              v-else
              icon="mdi-play"
              variant="tonal"
              :title="t('tools.whisper-transcribe.resumeRecording')"
              @click="resumeRecording"
            />
            <v-btn
              icon="mdi-stop"
              color="error"
              variant="tonal"
              :title="t('tools.whisper-transcribe.stopRecording')"
              @click="stopRecording"
            />
          </template>
        </div>
      </div>
      <v-alert v-if="micError" type="error" variant="tonal" density="compact" class="mt-3">{{ micError }}</v-alert>

      <div v-if="transcribeMode === 'live' && micState !== 'idle'" class="mt-3">
        <v-alert v-if="liveDisabled" type="warning" variant="tonal" density="compact">
          {{ liveWarning }}
        </v-alert>
        <div v-else class="text-caption" :class="liveWarning ? 'text-warning' : 'text-medium-emphasis'">
          {{ liveWarning || t('tools.whisper-transcribe.liveStatus', { seconds: Math.round(liveIntervalSec) }) }}
        </div>
      </div>
    </v-card>

    <template v-if="micState === 'idle'">
      <div class="text-caption text-medium-emphasis text-center mb-2">
        {{ t('tools.whisper-transcribe.uploadDivider') }}
      </div>
      <FileDrop accept="audio/*" :hint="t('tools.whisper-transcribe.uploadHint')" class="mb-4" @files="onFilesSelected" />
      <v-alert v-if="uploadError" type="error" variant="tonal" density="compact" class="mb-4">
        {{ uploadError }}
      </v-alert>
    </template>

    <audio
      v-if="recordedUrl"
      ref="audioRef"
      :src="recordedUrl"
      controls
      class="mb-4"
      style="width: 100%"
      @loadedmetadata="onAudioLoadedMetadata"
      @timeupdate="onAudioTimeUpdate"
      @ended="onAudioEnded"
    />

    <template v-if="resultText">
      <div class="d-flex align-center ga-2 mb-2">
        <div class="text-subtitle-1 font-weight-medium">{{ t('tools.whisper-transcribe.resultTitle') }}</div>
        <v-spacer />
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-refresh"
          :disabled="!canStartTranscribe"
          @click="generateTranscript"
        >
          {{ t('tools.whisper-transcribe.regenerate') }}
        </v-btn>
        <CopyBtn :text="resultText" />
      </div>
      <div v-if="resultChunks.length" class="transcript-list rounded">
        <div
          v-for="(chunk, i) in resultChunks"
          :key="i"
          :ref="(el) => setRowRef(el, i)"
          class="transcript-row"
          :class="{ 'transcript-row--active': i === activeChunkIndex }"
        >
          <span class="transcript-time text-caption text-medium-emphasis">{{ formatChunkTime(chunk.timestamp[0]) }}</span>
          <span class="transcript-text">{{ chunk.text.trim() }}</span>
        </div>
      </div>
      <v-textarea v-else :model-value="resultText" readonly rows="8" auto-grow class="code-area" />

      <div class="d-flex flex-wrap ga-2 mt-2">
        <v-btn variant="outlined" prepend-icon="mdi-file-download-outline" @click="downloadTxt">
          {{ t('tools.whisper-transcribe.downloadTxt') }}
        </v-btn>
        <v-btn
          variant="outlined"
          prepend-icon="mdi-closed-caption-outline"
          :disabled="!resultChunks.length"
          @click="downloadSrt"
        >
          {{ t('tools.whisper-transcribe.downloadSrt') }}
        </v-btn>
      </div>
      <div v-if="!resultChunks.length" class="text-caption text-medium-emphasis mt-2">
        {{ t('tools.whisper-transcribe.srtUnavailable') }}
      </div>
    </template>

    <v-card variant="outlined" class="pa-4 mt-4">
      <div class="d-flex align-center ga-2 mb-2">
        <div class="text-subtitle-1 font-weight-medium">{{ t('tools.whisper-transcribe.cachedModelsTitle') }}</div>
        <v-spacer />
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-refresh"
          :loading="cacheLoading"
          @click="refreshCachedModels"
        >
          {{ t('tools.whisper-transcribe.refreshCachedModels') }}
        </v-btn>
      </div>

      <div v-if="!cachedModels.length" class="text-caption text-medium-emphasis">
        {{ t('tools.whisper-transcribe.noCachedModels') }}
      </div>
      <div v-for="m in cachedModels" :key="m.id" class="d-flex align-center ga-2 py-1">
        <span class="flex-grow-1">{{ m.id }}</span>
        <span class="text-caption text-medium-emphasis">{{ formatMB(m.bytes) }} MB</span>
        <v-btn
          icon="mdi-delete-outline"
          size="small"
          variant="text"
          :title="t('tools.whisper-transcribe.deleteCachedModel')"
          @click="deleteCachedModel(m.id)"
        />
      </div>

      <v-btn
        v-if="cachedModels.length > 1"
        variant="text"
        size="small"
        color="error"
        class="mt-2"
        prepend-icon="mdi-delete-sweep-outline"
        @click="clearAllCachedModels"
      >
        {{ t('tools.whisper-transcribe.clearAllCached') }}
      </v-btn>

      <v-alert v-if="cacheError" type="error" variant="tonal" density="compact" class="mt-3">
        {{ cacheError }}
      </v-alert>
    </v-card>
  </ToolShell>
</template>

<style scoped>
.visualizer {
  background: rgba(var(--v-theme-on-surface), 0.05);
  width: 320px;
  height: 60px;
}

.code-area :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
}

.transcript-list {
  max-height: 420px;
  overflow-y: auto;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.transcript-row {
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.transcript-row:last-child {
  border-bottom: none;
}

.transcript-row--active {
  background: rgba(var(--v-theme-primary), 0.12);
}

.transcript-time {
  flex: 0 0 auto;
  width: 4.5em;
  padding-top: 1px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.transcript-text {
  flex: 1 1 auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
