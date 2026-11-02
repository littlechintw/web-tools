<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import { useAudioContext } from '@/composables/useAudioContext'
import { isBoolean, useStoredRef } from '@/composables/useStoredRef'
import { classifyMediaError, levelFromTimeDomain, peakHold, toDb } from '@/lib/avTest'
import { downloadBlob } from '@/utils/download'
import { canvasToBlob } from '@/utils/image'

const { t } = useI18n()
const audio = useAudioContext()
const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

function errText(e: unknown) {
  return t(`tools.av-test.err_${classifyMediaError(e)}`)
}
async function listDevices(kind: MediaDeviceKind): Promise<MediaDeviceInfo[]> {
  try {
    return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === kind)
  } catch {
    return []
  }
}
const devItems = (list: MediaDeviceInfo[], fallback: string) =>
  list.map((d, i) => ({ title: d.label || `${fallback} ${i + 1}`, value: d.deviceId }))

// ---------- Camera ----------
const mirror = useStoredRef('av-test.mirror', true, isBoolean)
const videoEl = ref<HTMLVideoElement | null>(null)
const snapEl = ref<HTMLCanvasElement | null>(null)
const camStream = ref<MediaStream | null>(null)
const camDevices = ref<MediaDeviceInfo[]>([])
const camId = ref('')
const camError = ref('')
const camInfo = ref('')
const hasSnap = ref(false)
const camItems = computed(() => devItems(camDevices.value, t('tools.av-test.camera')))

function stopCam() {
  camStream.value?.getTracks().forEach((tr) => tr.stop())
  camStream.value = null
  if (videoEl.value) videoEl.value.srcObject = null
  camInfo.value = ''
}
function readCamInfo() {
  const s = camStream.value?.getVideoTracks()[0]?.getSettings()
  if (!s) return
  camInfo.value = `${s.width ?? '?'}×${s.height ?? '?'}${s.frameRate ? ` @ ${Math.round(s.frameRate)} fps` : ''}`
}
async function startCam(deviceId = camId.value) {
  camError.value = ''
  stopCam()
  if (!supported) {
    camError.value = t('tools.av-test.err_unsupported')
    return
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
      audio: false,
    })
    camStream.value = stream
    const v = videoEl.value
    if (v) {
      v.srcObject = stream
      await v.play().catch(() => {})
    }
    camId.value = stream.getVideoTracks()[0]?.getSettings().deviceId ?? deviceId
    readCamInfo()
    camDevices.value = await listDevices('videoinput')
  } catch (e) {
    camError.value = errText(e)
    stopCam()
  }
}
async function snapshot() {
  const v = videoEl.value
  const c = snapEl.value
  if (!v || !c || !v.videoWidth) return
  c.width = v.videoWidth
  c.height = v.videoHeight
  const ctx = c.getContext('2d')
  if (!ctx) return
  if (mirror.value) {
    ctx.translate(c.width, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(v, 0, 0)
  hasSnap.value = true
}
async function saveSnap() {
  if (snapEl.value && hasSnap.value) downloadBlob(await canvasToBlob(snapEl.value), 'snapshot.png')
}

// ---------- Microphone ----------
const micStream = ref<MediaStream | null>(null)
const micDevices = ref<MediaDeviceInfo[]>([])
const micId = ref('')
const micError = ref('')
const rms = ref(0)
const hold = ref(0)
const waveEl = ref<HTMLCanvasElement | null>(null)
const micItems = computed(() => devItems(micDevices.value, t('tools.av-test.microphone')))
const rmsDb = computed(() => toDb(rms.value))
const holdDb = computed(() => toDb(hold.value))
// -60..0 dBFS mapped onto the meter
const meterPct = computed(() => Math.max(0, Math.min(100, ((rmsDb.value + 60) / 60) * 100)))
const holdPct = computed(() => Math.max(0, Math.min(100, ((holdDb.value + 60) / 60) * 100)))

let source: MediaStreamAudioSourceNode | null = null
let analyser: AnalyserNode | null = null
let raf = 0
let lastT = 0

function frame(now: number) {
  if (!analyser) return
  const buf = new Uint8Array(analyser.fftSize)
  analyser.getByteTimeDomainData(buf)
  const lv = levelFromTimeDomain(buf)
  rms.value = lv.rms
  hold.value = peakHold(hold.value, lv.peak, lastT ? (now - lastT) / 1000 : 0)
  lastT = now
  drawWave(buf)
  raf = requestAnimationFrame(frame)
}
function drawWave(buf: Uint8Array) {
  const c = waveEl.value
  const g = c?.getContext('2d')
  if (!c || !g) return
  g.clearRect(0, 0, c.width, c.height)
  g.strokeStyle = getComputedStyle(c).color
  g.lineWidth = 2
  g.beginPath()
  for (let i = 0; i < buf.length; i++) {
    const x = (i / (buf.length - 1)) * c.width
    const y = (buf[i] / 255) * c.height
    if (i === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.stroke()
}
function stopMic() {
  cancelAnimationFrame(raf)
  raf = 0
  lastT = 0
  stopRecording()
  source?.disconnect()
  source = null
  analyser = null
  micStream.value?.getTracks().forEach((tr) => tr.stop())
  micStream.value = null
  rms.value = 0
  hold.value = 0
  const c = waveEl.value
  c?.getContext('2d')?.clearRect(0, 0, c.width, c.height)
}
async function startMic(deviceId = micId.value) {
  micError.value = ''
  stopMic()
  if (!supported) {
    micError.value = t('tools.av-test.err_unsupported')
    return
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    })
    micStream.value = stream
    const ctx = audio.get()
    analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    source = ctx.createMediaStreamSource(stream)
    // Analyse only: never connect to the destination, or the mic would feed back into the speakers.
    source.connect(analyser)
    micId.value = stream.getAudioTracks()[0]?.getSettings().deviceId ?? deviceId
    micDevices.value = await listDevices('audioinput')
    raf = requestAnimationFrame(frame)
  } catch (e) {
    micError.value = errText(e)
    stopMic()
  }
}

// ---------- Record & playback ----------
const REC_SECONDS = 5
const canRecord = typeof MediaRecorder !== 'undefined'
const recording = ref(false)
const recLeft = ref(0)
const recUrl = ref('')
let recorder: MediaRecorder | null = null
let recTimer: ReturnType<typeof setInterval> | undefined
let disposed = false

function revokeRec() {
  if (recUrl.value) URL.revokeObjectURL(recUrl.value)
  recUrl.value = ''
}
function startRecording() {
  if (!micStream.value || !canRecord || recording.value) return
  revokeRec()
  const chunks: Blob[] = []
  try {
    recorder = new MediaRecorder(micStream.value)
  } catch {
    micError.value = t('tools.av-test.err_other')
    return
  }
  const rec = recorder
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  rec.onstop = () => {
    clearInterval(recTimer)
    recording.value = false
    if (disposed) return
    if (chunks.length) recUrl.value = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }))
  }
  rec.start()
  recording.value = true
  recLeft.value = REC_SECONDS
  recTimer = setInterval(() => {
    recLeft.value -= 1
    if (recLeft.value <= 0) stopRecording()
  }, 1000)
}
function stopRecording() {
  clearInterval(recTimer)
  if (recorder && recorder.state !== 'inactive') recorder.stop()
  recorder = null
  recording.value = false
}

onBeforeUnmount(() => {
  disposed = true
  stopCam()
  stopMic()
  revokeRec()
})
</script>

<template>
  <ToolShell>
    <v-alert type="info" variant="tonal" density="compact" icon="mdi-lock-outline" class="mb-4">
      {{ t('tools.av-test.privacy') }}
    </v-alert>
    <v-alert v-if="!supported" type="warning" variant="tonal" density="compact" class="mb-4">
      {{ t('tools.av-test.err_unsupported') }}
    </v-alert>

    <v-row density="comfortable">
      <v-col cols="12" md="6">
        <v-card variant="outlined" class="pa-4 h-100">
          <div class="text-subtitle-1 mb-2"><v-icon icon="mdi-webcam" class="me-1" />{{ t('tools.av-test.camera') }}</div>
          <div class="d-flex flex-wrap ga-2 mb-2">
            <v-btn v-if="!camStream" color="primary" :disabled="!supported" @click="startCam()">{{ t('tools.av-test.start') }}</v-btn>
            <v-btn v-else variant="tonal" @click="stopCam">{{ t('tools.av-test.stop') }}</v-btn>
            <v-btn variant="tonal" prepend-icon="mdi-camera" :disabled="!camStream" @click="snapshot">{{ t('tools.av-test.snapshot') }}</v-btn>
          </div>
          <v-select
            v-if="camItems.length"
            v-model="camId"
            :items="camItems"
            :label="t('tools.av-test.device')"
            density="comfortable"
            hide-details
            class="mb-2"
            @update:model-value="camStream && startCam($event as string)"
          />
          <v-switch v-model="mirror" :label="t('tools.av-test.mirror')" density="compact" hide-details color="primary" />
          <v-alert v-if="camError" type="error" variant="tonal" density="compact" class="my-2">{{ camError }}</v-alert>
          <div class="video-wrap rounded mt-2">
            <video ref="videoEl" muted playsinline autoplay :class="{ mirrored: mirror }" />
            <div v-if="!camStream" class="video-empty text-medium-emphasis">{{ t('tools.av-test.cameraOff') }}</div>
          </div>
          <div v-if="camInfo" class="text-caption tabular-nums mt-1">{{ t('tools.av-test.resolution') }}: {{ camInfo }}</div>
          <div v-show="hasSnap" class="mt-3">
            <canvas ref="snapEl" class="snap rounded" />
            <v-btn size="small" variant="tonal" prepend-icon="mdi-download" class="mt-2" @click="saveSnap">{{ t('tools.av-test.savePng') }}</v-btn>
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card variant="outlined" class="pa-4 h-100">
          <div class="text-subtitle-1 mb-2"><v-icon icon="mdi-microphone" class="me-1" />{{ t('tools.av-test.microphone') }}</div>
          <div class="d-flex flex-wrap ga-2 mb-2">
            <v-btn v-if="!micStream" color="primary" :disabled="!supported" @click="startMic()">{{ t('tools.av-test.start') }}</v-btn>
            <v-btn v-else variant="tonal" @click="stopMic">{{ t('tools.av-test.stop') }}</v-btn>
          </div>
          <v-select
            v-if="micItems.length"
            v-model="micId"
            :items="micItems"
            :label="t('tools.av-test.device')"
            density="comfortable"
            hide-details
            class="mb-2"
            @update:model-value="micStream && startMic($event as string)"
          />
          <v-alert v-if="micError" type="error" variant="tonal" density="compact" class="my-2">{{ micError }}</v-alert>

          <div class="meter rounded mt-2" role="meter" :aria-valuenow="Math.round(rmsDb)" aria-valuemin="-100" aria-valuemax="0" :aria-label="t('tools.av-test.level')">
            <div class="meter-fill" :style="{ width: meterPct + '%' }" />
            <div class="meter-hold" :style="{ left: holdPct + '%' }" />
          </div>
          <div class="d-flex justify-space-between text-caption tabular-nums mt-1">
            <span>{{ t('tools.av-test.level') }}: {{ rmsDb.toFixed(1) }} dBFS</span>
            <span>{{ t('tools.av-test.peak') }}: {{ holdDb.toFixed(1) }} dBFS</span>
          </div>
          <canvas ref="waveEl" width="600" height="120" class="wave rounded mt-2" />

          <div class="mt-3">
            <div class="text-subtitle-2 mb-1">{{ t('tools.av-test.loopback', { n: REC_SECONDS }) }}</div>
            <v-btn
              variant="tonal"
              :prepend-icon="recording ? 'mdi-record-rec' : 'mdi-record'"
              :disabled="!micStream || !canRecord || recording"
              @click="startRecording"
            >
              {{ recording ? t('tools.av-test.recording', { n: recLeft }) : t('tools.av-test.record') }}
            </v-btn>
            <div v-if="!canRecord" class="text-caption text-medium-emphasis mt-1">{{ t('tools.av-test.noRecorder') }}</div>
            <audio v-if="recUrl" :src="recUrl" controls class="mt-2 w-100" />
            <div class="text-caption text-medium-emphasis mt-1">{{ t('tools.av-test.headphones') }}</div>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </ToolShell>
</template>

<style scoped>
.video-wrap { position: relative; background: #000; aspect-ratio: 16 / 9; overflow: hidden; }
.video-wrap video { width: 100%; height: 100%; object-fit: contain; display: block; }
.mirrored { transform: scaleX(-1); }
.video-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.snap { max-width: 100%; height: auto; display: block; }
.meter { position: relative; height: 16px; background: rgba(128, 128, 128, 0.25); overflow: hidden; }
.meter-fill { height: 100%; background: rgb(var(--v-theme-success)); }
.meter-hold { position: absolute; top: 0; bottom: 0; width: 3px; background: rgb(var(--v-theme-error)); }
.wave { width: 100%; height: 80px; background: rgba(128, 128, 128, 0.12); color: rgb(var(--v-theme-primary)); }
</style>
