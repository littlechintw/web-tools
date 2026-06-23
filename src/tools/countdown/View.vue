<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'

const { t } = useI18n()

type Mode = 'target' | 'duration'
const mode = ref<Mode>('target')

// ---------- shared beep ----------
let audioCtx: AudioContext | null = null
function beep() {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!audioCtx) audioCtx = new Ctor()
    const ctx = audioCtx
    // Three short beeps.
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      const startAt = ctx.currentTime + i * 0.3
      gain.gain.setValueAtTime(0.0001, startAt)
      gain.gain.exponentialRampToValueAtTime(0.3, startAt + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(startAt)
      osc.stop(startAt + 0.22)
    }
  } catch {
    /* audio not available */
  }
}

// ---------- Mode A: target datetime ----------
function defaultTarget(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const target = ref(defaultTarget())
const targetRemaining = ref(0) // ms
let targetTimer: ReturnType<typeof setInterval> | null = null

function tickTarget() {
  const goal = new Date(target.value).getTime()
  if (Number.isNaN(goal)) {
    targetRemaining.value = 0
    return
  }
  targetRemaining.value = Math.max(0, goal - Date.now())
}

function startTargetTimer() {
  stopTargetTimer()
  tickTarget()
  targetTimer = setInterval(tickTarget, 1000)
}

function stopTargetTimer() {
  if (targetTimer !== null) {
    clearInterval(targetTimer)
    targetTimer = null
  }
}

const targetParts = computed(() => splitDHMS(targetRemaining.value))
const targetReached = computed(() => {
  const goal = new Date(target.value).getTime()
  return !Number.isNaN(goal) && targetRemaining.value <= 0
})

// Start the live ticking immediately for target mode.
startTargetTimer()

// ---------- Mode B: duration timer ----------
const inputMinutes = ref(5)
const inputSeconds = ref(0)
const durationRemaining = ref(0) // ms
const running = ref(false)
const durationFinished = ref(false)
let durationTimer: ReturnType<typeof setInterval> | null = null
let deadline = 0

function totalDurationMs(): number {
  const m = Math.max(0, Math.trunc(Number(inputMinutes.value) || 0))
  const s = Math.max(0, Math.trunc(Number(inputSeconds.value) || 0))
  return (m * 60 + s) * 1000
}

function stopDurationTimer() {
  if (durationTimer !== null) {
    clearInterval(durationTimer)
    durationTimer = null
  }
}

function tickDuration() {
  const left = deadline - Date.now()
  if (left <= 0) {
    durationRemaining.value = 0
    running.value = false
    durationFinished.value = true
    stopDurationTimer()
    beep()
    return
  }
  durationRemaining.value = left
}

function startDuration() {
  durationFinished.value = false
  // Resume from current remaining if paused mid-run, else fresh from inputs.
  const base = durationRemaining.value > 0 && !running.value ? durationRemaining.value : totalDurationMs()
  if (base <= 0) return
  durationRemaining.value = base
  deadline = Date.now() + base
  running.value = true
  stopDurationTimer()
  durationTimer = setInterval(tickDuration, 200)
}

function pauseDuration() {
  if (!running.value) return
  running.value = false
  stopDurationTimer()
  durationRemaining.value = Math.max(0, deadline - Date.now())
}

function resetDuration() {
  stopDurationTimer()
  running.value = false
  durationFinished.value = false
  durationRemaining.value = 0
}

const durationParts = computed(() => splitDHMS(durationRemaining.value))

// ---------- helpers ----------
function splitDHMS(ms: number) {
  const total = Math.floor(ms / 1000)
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}
function pad(n: number) {
  return String(n).padStart(2, '0')
}

onUnmounted(() => {
  stopTargetTimer()
  stopDurationTimer()
  if (audioCtx) {
    audioCtx.close().catch(() => {})
    audioCtx = null
  }
})
</script>

<template>
  <ToolShell>
    <div class="mb-4">
      <v-btn-toggle v-model="mode" mandatory color="primary" density="comfortable" variant="outlined">
        <v-btn value="target">{{ t('tools.countdown.modeTarget') }}</v-btn>
        <v-btn value="duration">{{ t('tools.countdown.modeDuration') }}</v-btn>
      </v-btn-toggle>
    </div>

    <!-- Mode A: target datetime -->
    <template v-if="mode === 'target'">
      <v-text-field
        v-model="target"
        type="datetime-local"
        :label="t('tools.countdown.targetDateTime')"
        density="comfortable"
        @update:model-value="tickTarget"
      />

      <v-card variant="tonal" :color="targetReached ? 'success' : 'primary'" class="mt-2">
        <v-card-text class="text-center py-6">
          <div v-if="targetReached" class="text-h4 font-weight-bold">
            {{ t('tools.countdown.reached') }}
          </div>
          <div v-else class="d-flex justify-center ga-4 flex-wrap">
            <div class="text-center">
              <div class="text-h3 font-weight-bold">{{ targetParts.days }}</div>
              <div class="text-caption">{{ t('tools.countdown.days') }}</div>
            </div>
            <div class="text-center">
              <div class="text-h3 font-weight-bold">{{ pad(targetParts.hours) }}</div>
              <div class="text-caption">{{ t('tools.countdown.hours') }}</div>
            </div>
            <div class="text-center">
              <div class="text-h3 font-weight-bold">{{ pad(targetParts.minutes) }}</div>
              <div class="text-caption">{{ t('tools.countdown.minutes') }}</div>
            </div>
            <div class="text-center">
              <div class="text-h3 font-weight-bold">{{ pad(targetParts.seconds) }}</div>
              <div class="text-caption">{{ t('tools.countdown.seconds') }}</div>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </template>

    <!-- Mode B: duration timer -->
    <template v-else>
      <v-row dense>
        <v-col cols="6">
          <v-text-field
            v-model.number="inputMinutes"
            type="number"
            min="0"
            :label="t('tools.countdown.minutesLabel')"
            :disabled="running"
            density="comfortable"
          />
        </v-col>
        <v-col cols="6">
          <v-text-field
            v-model.number="inputSeconds"
            type="number"
            min="0"
            max="59"
            :label="t('tools.countdown.secondsLabel')"
            :disabled="running"
            density="comfortable"
          />
        </v-col>
      </v-row>

      <v-card variant="tonal" :color="durationFinished ? 'success' : 'primary'" class="mb-3">
        <v-card-text class="text-center py-6">
          <div v-if="durationFinished" class="text-h4 font-weight-bold">
            {{ t('tools.countdown.finished') }}
          </div>
          <div v-else class="text-h2 font-weight-bold timer-mono">
            {{ pad(durationParts.hours) }}:{{ pad(durationParts.minutes) }}:{{ pad(durationParts.seconds) }}
          </div>
        </v-card-text>
      </v-card>

      <div class="d-flex ga-2 flex-wrap">
        <v-btn
          v-if="!running"
          color="primary"
          prepend-icon="mdi-play"
          @click="startDuration"
        >
          {{ durationRemaining > 0 ? t('tools.countdown.resume') : t('tools.countdown.start') }}
        </v-btn>
        <v-btn v-else color="warning" prepend-icon="mdi-pause" @click="pauseDuration">
          {{ t('tools.countdown.pause') }}
        </v-btn>
        <v-btn variant="outlined" prepend-icon="mdi-restart" @click="resetDuration">
          {{ t('tools.countdown.reset') }}
        </v-btn>
      </div>
    </template>
  </ToolShell>
</template>

<style scoped>
.timer-mono {
  font-variant-numeric: tabular-nums;
}
</style>
