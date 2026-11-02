<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import { useAudioContext } from '@/composables/useAudioContext'
import { intBetween, useStoredRef } from '@/composables/useStoredRef'
import { BPM_MAX, BPM_MIN, clampBpm, detectPitch, freqToNote, planBeats, tapTempo, type Accent, type BeatEvent, type NoteInfo } from '@/lib/music'

const { t } = useI18n()
const K = (k: string, a?: Record<string, unknown>) => t(`tools.metronome-tuner.${k}`, a ?? {})
const audio = useAudioContext()

const tab = ref<'metronome' | 'tuner'>('metronome')

// ---------------------------------------------------------------- metronome
const bpm = useStoredRef('metronome-tuner.bpm', 100, intBetween(BPM_MIN, BPM_MAX))
const beats = useStoredRef('metronome-tuner.beats', 4, intBetween(1, 12))
const subdiv = useStoredRef('metronome-tuner.subdiv', 1, intBetween(1, 4))
const playing = ref(false)
const activeBeat = ref(-1)
const taps: number[] = []

const LOOKAHEAD = 0.12 // seconds of audio scheduled ahead
const TICK_MS = 25 // how often the scheduler wakes up (sound timing itself is on the audio clock)
let nextTime = 0
let tickIndex = 0
let schedTimer: ReturnType<typeof setInterval> | undefined
let raf = 0
let visQueue: BeatEvent[] = []

const FREQ: Record<Accent, number> = { strong: 1600, medium: 1000, weak: 700 }
const GAIN: Record<Accent, number> = { strong: 0.9, medium: 0.6, weak: 0.3 }

function click(ctx: AudioContext, e: BeatEvent) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.frequency.value = FREQ[e.accent]
  g.gain.setValueAtTime(GAIN[e.accent], e.time)
  g.gain.exponentialRampToValueAtTime(0.0001, e.time + 0.05)
  osc.connect(g).connect(ctx.destination)
  osc.start(e.time)
  osc.stop(e.time + 0.06)
}

function schedule() {
  audio.play((ctx) => {
    const plan = planBeats(nextTime, tickIndex, ctx.currentTime, LOOKAHEAD, bpm.value, beats.value, subdiv.value)
    for (const e of plan.events) {
      click(ctx, e)
      visQueue.push(e)
    }
    nextTime = plan.nextTime
    tickIndex = plan.tickIndex
  })
}

function paint() {
  audio.play((ctx) => {
    while (visQueue.length && visQueue[0].time <= ctx.currentTime) {
      const e = visQueue.shift()!
      if (e.sub === 0) activeBeat.value = e.beat
    }
  })
  raf = requestAnimationFrame(paint)
}

function startMetronome() {
  audio.play((ctx) => {
    nextTime = ctx.currentTime + 0.08
    tickIndex = 0
    visQueue = []
    playing.value = true
    schedule()
    schedTimer = setInterval(schedule, TICK_MS)
    raf = requestAnimationFrame(paint)
  })
}
function stopMetronome() {
  clearInterval(schedTimer)
  cancelAnimationFrame(raf)
  schedTimer = undefined
  visQueue = []
  playing.value = false
  activeBeat.value = -1
}
const toggleMetronome = () => (playing.value ? stopMetronome() : startMetronome())

function setBpm(v: number) { bpm.value = clampBpm(v) }
function onBpmInput(v: string) {
  const n = Number(v)
  if (v.trim() !== '' && Number.isFinite(n)) bpm.value = clampBpm(n)
}
function tap() {
  const now = performance.now()
  const last = taps[taps.length - 1]
  if (last !== undefined && now - last > 2000) taps.length = 0
  taps.push(now)
  if (taps.length > 16) taps.shift()
  const r = tapTempo(taps)
  if (r) bpm.value = r
}

const beatItems = computed(() => Array.from({ length: 12 }, (_, i) => ({ title: K('beatsN', { n: i + 1 }), value: i + 1 })))
const subItems = computed(() => [1, 2, 3, 4].map((s) => ({ title: K(`sub_${s}`), value: s })))

// -------------------------------------------------------------------- tuner
const a4 = useStoredRef('metronome-tuner.a4', 440, intBetween(415, 466))
const a4Items = Array.from({ length: 52 }, (_, i) => 415 + i)
const listening = ref(false)
const micError = ref('')
const note = ref<NoteInfo | null>(null)
const freq = ref(0)

let stream: MediaStream | null = null
let source: MediaStreamAudioSourceNode | null = null
let analyser: AnalyserNode | null = null
let tunerRaf = 0
let lastRun = 0
let misses = 0
let buf: Float32Array<ArrayBuffer> | null = null

async function startTuner() {
  micError.value = ''
  if (!navigator.mediaDevices?.getUserMedia) {
    micError.value = K('micUnsupported')
    return
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    })
  } catch {
    micError.value = K('micDenied')
    return
  }
  try {
    const ctx = audio.get()
    source = ctx.createMediaStreamSource(stream)
    analyser = ctx.createAnalyser()
    analyser.fftSize = 4096
    buf = new Float32Array(analyser.fftSize)
    source.connect(analyser) // not connected to destination: no feedback
    listening.value = true
    tunerRaf = requestAnimationFrame(analyse)
  } catch {
    stopTuner()
    micError.value = K('micUnsupported')
  }
}

function analyse(ts: number) {
  tunerRaf = requestAnimationFrame(analyse)
  if (!analyser || !buf || ts - lastRun < 60) return
  lastRun = ts
  analyser.getFloatTimeDomainData(buf)
  const p = detectPitch(buf, audio.get().sampleRate)
  const n = p ? freqToNote(p.freq, a4.value) : null
  if (p && n) {
    misses = 0
    freq.value = p.freq
    note.value = n
  } else if (++misses > 8) {
    note.value = null
  }
}

function stopTuner() {
  cancelAnimationFrame(tunerRaf)
  source?.disconnect()
  analyser?.disconnect()
  stream?.getTracks().forEach((tr) => tr.stop())
  stream = null
  source = null
  analyser = null
  listening.value = false
  note.value = null
}
const toggleTuner = () => (listening.value ? stopTuner() : void startTuner())

const needle = computed(() => (note.value ? 50 + Math.max(-50, Math.min(50, note.value.cents)) : 50))
const inTune = computed(() => note.value !== null && Math.abs(note.value.cents) <= 5)
const cents = computed(() => (note.value ? Math.round(note.value.cents) : 0))

watch(tab, (v) => {
  if (v !== 'tuner') stopTuner()
  if (v !== 'metronome') stopMetronome()
})
onBeforeUnmount(() => {
  stopMetronome()
  stopTuner()
})
</script>

<template>
  <ToolShell max-width="640">
    <v-tabs v-model="tab" grow class="mb-4">
      <v-tab value="metronome" prepend-icon="mdi-metronome">{{ K('tabMetronome') }}</v-tab>
      <v-tab value="tuner" prepend-icon="mdi-microphone">{{ K('tabTuner') }}</v-tab>
    </v-tabs>

    <div v-if="tab === 'metronome'">
      <div class="text-center">
        <div class="d-flex align-center justify-center ga-2">
          <v-btn icon="mdi-minus" variant="tonal" :title="K('slower')" :aria-label="K('slower')" @click="setBpm(bpm - 1)" />
          <div>
            <div class="bpm font-mono tabular-nums">{{ bpm }}</div>
            <div class="text-caption text-medium-emphasis">BPM</div>
          </div>
          <v-btn icon="mdi-plus" variant="tonal" :title="K('faster')" :aria-label="K('faster')" @click="setBpm(bpm + 1)" />
        </div>
        <v-slider
          :model-value="bpm"
          :min="BPM_MIN"
          :max="BPM_MAX"
          :step="1"
          hide-details
          class="mt-2"
          :aria-label="K('tempo')"
          @update:model-value="(v: number) => setBpm(v)"
        />
        <div class="d-flex ga-1 justify-center my-3" aria-hidden="true">
          <span v-for="i in beats" :key="i" class="dot" :class="{ on: activeBeat === i - 1, first: i === 1 }" />
        </div>
        <div class="d-flex justify-center ga-3 flex-wrap">
          <v-btn size="large" :color="playing ? 'error' : 'primary'" :prepend-icon="playing ? 'mdi-stop' : 'mdi-play'" @click="toggleMetronome">
            {{ playing ? K('stop') : K('start') }}
          </v-btn>
          <v-btn size="large" variant="tonal" prepend-icon="mdi-gesture-tap" @click="tap">{{ K('tap') }}</v-btn>
        </div>
      </div>
      <v-row density="comfortable" class="mt-3">
        <v-col cols="6">
          <v-select v-model="beats" :items="beatItems" :label="K('beats')" hide-details />
        </v-col>
        <v-col cols="6">
          <v-select v-model="subdiv" :items="subItems" :label="K('subdivision')" hide-details />
        </v-col>
        <v-col cols="12">
          <v-text-field
            :model-value="bpm"
            :label="K('tempo')"
            type="number"
            :min="BPM_MIN"
            :max="BPM_MAX"
            inputmode="numeric"
            hide-details
            class="tabular-nums"
            @update:model-value="onBpmInput"
          />
        </v-col>
      </v-row>
      <div class="text-caption text-medium-emphasis mt-2">{{ K('tapHint') }}</div>
    </div>

    <div v-else>
      <v-row density="comfortable">
        <v-col cols="6">
          <v-select v-model="a4" :items="a4Items" :label="K('a4')" suffix="Hz" hide-details />
        </v-col>
        <v-col cols="6" class="d-flex align-center">
          <v-btn block :color="listening ? 'error' : 'primary'" :prepend-icon="listening ? 'mdi-microphone-off' : 'mdi-microphone'" @click="toggleTuner">
            {{ listening ? K('stopListening') : K('startListening') }}
          </v-btn>
        </v-col>
      </v-row>
      <v-alert v-if="micError" type="error" variant="tonal" density="compact" class="mt-3">{{ micError }}</v-alert>

      <v-card variant="tonal" :color="inTune ? 'success' : undefined" class="mt-4 pa-5 text-center">
        <template v-if="note">
          <div class="note font-mono">{{ note.name }}<sub>{{ note.octave }}</sub></div>
          <div class="tabular-nums">{{ freq.toFixed(1) }} Hz · {{ K('target') }} {{ note.target.toFixed(1) }} Hz</div>
          <div class="text-h6 tabular-nums">{{ cents > 0 ? '+' : '' }}{{ cents }} {{ K('cents') }}</div>
        </template>
        <template v-else>
          <div class="note font-mono text-medium-emphasis">–</div>
          <div class="text-body-2">{{ listening ? K('listening') : K('idle') }}</div>
        </template>
        <div class="gauge mt-4" role="img" :aria-label="K('cents')">
          <div class="tick" style="left: 50%" />
          <div v-if="note" class="needle" :style="{ left: needle + '%' }" />
        </div>
        <div class="d-flex justify-space-between text-caption tabular-nums mt-1"><span>-50</span><span>0</span><span>+50</span></div>
      </v-card>
      <div class="text-caption text-medium-emphasis mt-2">{{ K('micNote') }}</div>
    </div>
  </ToolShell>
</template>

<style scoped>
.bpm { font-size: 4rem; line-height: 1; min-width: 5ch; }
.dot {
  width: 18px; height: 18px; border-radius: 50%;
  background: rgba(var(--v-theme-on-surface), 0.15);
  transition: background 0.05s;
}
.dot.first { outline: 2px solid rgba(var(--v-theme-primary), 0.6); }
.dot.on { background: rgb(var(--v-theme-primary)); }
.note { font-size: 4.5rem; line-height: 1.1; }
.gauge {
  position: relative; height: 14px; border-radius: 7px;
  background: linear-gradient(90deg, rgba(var(--v-theme-error), 0.5), rgba(var(--v-theme-success), 0.6) 45% 55%, rgba(var(--v-theme-error), 0.5));
}
.gauge .tick { position: absolute; top: -4px; width: 2px; height: 22px; margin-left: -1px; background: currentColor; opacity: 0.5; }
.gauge .needle {
  position: absolute; top: -6px; width: 6px; height: 26px; margin-left: -3px; border-radius: 3px;
  background: rgb(var(--v-theme-on-surface)); transition: left 0.08s linear;
}
</style>
