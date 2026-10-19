<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import { useAudioContext } from '@/composables/useAudioContext'
import { isNumber, useStoredRef } from '@/composables/useStoredRef'

const { t } = useI18n()
const T = (key: string, args?: Record<string, unknown>) => t(`tools.countdown.${key}`, args ?? {})

type Mode = 'target' | 'duration'
const mode = ref<Mode>('target')

// ---------- shared beep ----------
const audio = useAudioContext()

function beep() {
  audio.play((ctx) => {
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
  })
}

// ---------- Mode A: target datetime ----------
function defaultTarget(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000)
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
const QUICK_MINUTES = [1, 3, 5, 10, 25]

// The last duration is remembered between visits; nothing else is.
const inputMinutes = useStoredRef('countdown.inputMinutes', 5, isNumber)
const inputSeconds = useStoredRef('countdown.inputSeconds', 0, isNumber)
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
    restoreTitle()
    beep()
    return
  }
  durationRemaining.value = left
  showRemainingInTitle(left)
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
  showRemainingInTitle(base)
  durationTimer = setInterval(tickDuration, 200)
}

function pauseDuration() {
  if (!running.value) return
  running.value = false
  stopDurationTimer()
  durationRemaining.value = Math.max(0, deadline - Date.now())
  restoreTitle()
}

function resetDuration() {
  stopDurationTimer()
  running.value = false
  durationFinished.value = false
  durationRemaining.value = 0
  restoreTitle()
}

function pickMinutes(n: number) {
  if (running.value) return
  inputMinutes.value = n
  inputSeconds.value = 0
  resetDuration()
}

const isQuickPicked = (n: number) => Number(inputMinutes.value) === n && Number(inputSeconds.value) === 0

// Before the timer starts (or after a reset) show the configured duration, so
// the big display reflects what "Start" will count down from.
const durationDisplayMs = computed(() =>
  running.value || durationRemaining.value > 0 ? durationRemaining.value : totalDurationMs(),
)
const durationParts = computed(() => splitDHMS(durationDisplayMs.value))

// ---------- document.title while a duration timer runs ----------
// The app layout owns the title; remember what it set and put it back once
// the timer stops, so a running countdown is visible from any other tab.
let savedTitle: string | null = null

function showRemainingInTitle(ms: number) {
  if (savedTitle === null) savedTitle = document.title
  document.title = `${fmtClock(ms)} · ${savedTitle}`
}

function restoreTitle() {
  if (savedTitle !== null) {
    document.title = savedTitle
    savedTitle = null
  }
}

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
/** "mm:ss", or "h:mm:ss" once there is at least an hour left. */
function fmtClock(ms: number) {
  const total = Math.ceil(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

onUnmounted(() => {
  stopTargetTimer()
  stopDurationTimer()
  restoreTitle()
})
</script>

<template>
  <ToolShell>
    <div class="mb-4">
      <v-btn-toggle v-model="mode" mandatory color="primary" density="comfortable" variant="outlined">
        <v-btn value="target">{{ T('modeTarget') }}</v-btn>
        <v-btn value="duration">{{ T('modeDuration') }}</v-btn>
      </v-btn-toggle>
    </div>

    <!-- Mode A: target datetime -->
    <template v-if="mode === 'target'">
      <v-text-field
        v-model="target"
        type="datetime-local"
        :label="T('targetDateTime')"
        density="comfortable"
        @update:model-value="tickTarget"
      />

      <v-card variant="tonal" :color="targetReached ? 'success' : 'primary'" class="mt-2">
        <v-card-text class="text-center py-6">
          <div v-if="targetReached" class="text-h4 font-weight-bold">
            {{ T('reached') }}
          </div>
          <div v-else class="d-flex justify-center ga-4 flex-wrap tabular-nums">
            <div class="text-center">
              <div class="text-h3 font-weight-bold">{{ targetParts.days }}</div>
              <div class="text-caption">{{ T('days') }}</div>
            </div>
            <div class="text-center">
              <div class="text-h3 font-weight-bold">{{ pad(targetParts.hours) }}</div>
              <div class="text-caption">{{ T('hours') }}</div>
            </div>
            <div class="text-center">
              <div class="text-h3 font-weight-bold">{{ pad(targetParts.minutes) }}</div>
              <div class="text-caption">{{ T('minutes') }}</div>
            </div>
            <div class="text-center">
              <div class="text-h3 font-weight-bold">{{ pad(targetParts.seconds) }}</div>
              <div class="text-caption">{{ T('seconds') }}</div>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </template>

    <!-- Mode B: duration timer -->
    <template v-else>
      <div class="d-flex flex-wrap align-center ga-2 mb-3">
        <span class="text-caption text-medium-emphasis">{{ T('quickPick') }}</span>
        <v-chip
          v-for="n in QUICK_MINUTES"
          :key="n"
          size="small"
          :color="isQuickPicked(n) ? 'primary' : undefined"
          :variant="isQuickPicked(n) ? 'flat' : 'tonal'"
          :disabled="running"
          @click="pickMinutes(n)"
        >
          {{ T('minutesShort', { n }) }}
        </v-chip>
      </div>

      <v-row density="comfortable">
        <v-col cols="6">
          <v-text-field
            v-model.number="inputMinutes"
            type="number"
            min="0"
            :label="T('minutesLabel')"
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
            :label="T('secondsLabel')"
            :disabled="running"
            density="comfortable"
          />
        </v-col>
      </v-row>

      <v-card variant="tonal" :color="durationFinished ? 'success' : 'primary'" class="mb-3">
        <v-card-text class="text-center py-6">
          <div v-if="durationFinished" class="text-h4 font-weight-bold">
            {{ T('finished') }}
          </div>
          <div v-else class="text-h2 font-weight-bold tabular-nums">
            {{ pad(durationParts.hours) }}:{{ pad(durationParts.minutes) }}:{{ pad(durationParts.seconds) }}
          </div>
        </v-card-text>
      </v-card>

      <div class="d-flex ga-2 flex-wrap">
        <v-btn
          v-if="!running"
          color="primary"
          prepend-icon="mdi-play"
          :disabled="durationRemaining <= 0 && totalDurationMs() <= 0"
          @click="startDuration"
        >
          {{ durationRemaining > 0 ? T('resume') : T('start') }}
        </v-btn>
        <v-btn v-else color="warning" prepend-icon="mdi-pause" @click="pauseDuration">
          {{ T('pause') }}
        </v-btn>
        <v-btn variant="outlined" prepend-icon="mdi-restart" @click="resetDuration">
          {{ T('reset') }}
        </v-btn>
      </div>
    </template>
  </ToolShell>
</template>
