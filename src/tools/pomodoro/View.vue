<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import { useAudioContext } from '@/composables/useAudioContext'
import { intBetween, isBoolean, useStoredRef } from '@/composables/useStoredRef'
import {
  applyConfig, createState, formatClock, normalizeConfig, pause, phaseMs, remaining, reset, skip, start, tick,
  type Phase, type PomodoroState,
} from '@/lib/pomodoro'

const { t } = useI18n()
const K = (k: string, a?: Record<string, unknown>) => t(`tools.pomodoro.${k}`, a ?? {})
const audio = useAudioContext()

const focusMin = useStoredRef('pomodoro.focusMin', 25, intBetween(1, 180))
const shortMin = useStoredRef('pomodoro.shortMin', 5, intBetween(1, 60))
const longMin = useStoredRef('pomodoro.longMin', 15, intBetween(1, 120))
const rounds = useStoredRef('pomodoro.rounds', 4, intBetween(1, 12))
const autoStart = useStoredRef('pomodoro.autoStart', true, isBoolean)
const sound = useStoredRef('pomodoro.sound', true, isBoolean)
const notify = useStoredRef('pomodoro.notify', false, isBoolean)

const cfg = computed(() => normalizeConfig({ focusMin: focusMin.value, shortMin: shortMin.value, longMin: longMin.value, rounds: rounds.value }))
const state = ref<PomodoroState>(createState(cfg.value))
const nowMs = ref(Date.now())
const completed = ref(0) // today's focus rounds; memory only
const originalTitle = document.title
const canNotify = typeof Notification !== 'undefined'
const permission = ref<NotificationPermission>(canNotify ? Notification.permission : 'denied')

const left = computed(() => remaining(state.value, nowMs.value))
const clock = computed(() => formatClock(left.value))
const progress = computed(() => {
  const total = phaseMs(cfg.value, state.value.phase)
  return total > 0 ? Math.min(100, Math.max(0, (1 - left.value / total) * 100)) : 0
})
const running = computed(() => state.value.status === 'running')
const phaseColor: Record<Phase, string> = { focus: 'error', short: 'success', long: 'info' }

watch(cfg, (c) => { state.value = applyConfig(state.value, c) })

function chime() {
  if (!sound.value) return
  audio.play((ctx) => {
    const t0 = ctx.currentTime
    ;[880, 1175, 1480].forEach((f, i) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = f
      const s = t0 + i * 0.22
      g.gain.setValueAtTime(0.0001, s)
      g.gain.exponentialRampToValueAtTime(0.3, s + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.5)
      osc.connect(g).connect(ctx.destination)
      osc.start(s)
      osc.stop(s + 0.55)
    })
  })
}

function notifyDone(finished: Phase, next: Phase) {
  if (!notify.value || !canNotify || Notification.permission !== 'granted') return
  try {
    new Notification(K(`notif_${finished}`), { body: K(`next_${next}`) })
  } catch {
    // Some browsers only allow notifications via a service worker; ignore.
  }
}

function update() {
  nowMs.value = Date.now()
  const r = tick(state.value, cfg.value, nowMs.value, autoStart.value)
  if (r.finished) {
    if (r.finished === 'focus') completed.value++
    state.value = r.state
    chime()
    notifyDone(r.finished, r.state.phase)
  }
  document.title = running.value ? `${clock.value} · ${K(`phase_${state.value.phase}`)}` : originalTitle
}

// Timing is derived from Date.now() deltas, so a throttled background timer cannot drift.
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(update, 250) })
onUnmounted(() => {
  clearInterval(timer)
  document.title = originalTitle
})
document.addEventListener('visibilitychange', update)
onUnmounted(() => document.removeEventListener('visibilitychange', update))

function toggle() {
  const now = Date.now()
  state.value = running.value ? pause(state.value, now) : start(state.value, now)
  update()
}
function doSkip() { state.value = skip(state.value, cfg.value, Date.now()); update() }
function doReset() { state.value = reset(cfg.value); update() }

async function enableNotifications() {
  if (!canNotify) return
  try {
    permission.value = await Notification.requestPermission()
    notify.value = permission.value === 'granted'
  } catch {
    permission.value = 'denied'
  }
}

const durations = computed(() => [
  { model: focusMin, label: K('focusMin'), max: 180 },
  { model: shortMin, label: K('shortMin'), max: 60 },
  { model: longMin, label: K('longMin'), max: 120 },
  { model: rounds, label: K('rounds'), max: 12 },
])
function setNum(m: { value: number }, v: string, max: number) {
  const n = Math.round(Number(v))
  if (Number.isFinite(n) && n >= 1) m.value = Math.min(max, n)
}
</script>

<template>
  <ToolShell max-width="640">
    <v-card variant="tonal" :color="phaseColor[state.phase]" class="pa-5 text-center">
      <div class="text-h6">{{ K(`phase_${state.phase}`) }}</div>
      <div class="font-mono tabular-nums clock" role="timer" :aria-label="clock">{{ clock }}</div>
      <v-progress-linear :model-value="progress" height="8" rounded class="my-3" :color="phaseColor[state.phase]" />
      <div class="text-body-2">{{ K('roundOf', { n: state.round, total: cfg.rounds }) }} · {{ K('doneToday', { n: completed }) }}</div>
      <div class="d-flex justify-center ga-2 mt-4 flex-wrap">
        <v-btn size="large" :prepend-icon="running ? 'mdi-pause' : 'mdi-play'" @click="toggle">
          {{ running ? K('pause') : state.status === 'paused' ? K('resume') : K('start') }}
        </v-btn>
        <v-btn size="large" variant="outlined" prepend-icon="mdi-skip-next" @click="doSkip">{{ K('skip') }}</v-btn>
        <v-btn size="large" variant="text" prepend-icon="mdi-restart" @click="doReset">{{ t('common.reset') }}</v-btn>
      </div>
    </v-card>

    <v-row density="comfortable" class="mt-3">
      <v-col v-for="(d, i) in durations" :key="i" cols="6" md="3">
        <v-text-field
          :model-value="d.model.value"
          :label="d.label"
          type="number"
          min="1"
          :max="d.max"
          inputmode="numeric"
          hide-details
          class="tabular-nums"
          @update:model-value="(v: string) => setNum(d.model, v, d.max)"
        />
      </v-col>
      <v-col cols="12" class="d-flex flex-wrap ga-x-4 align-center">
        <v-switch v-model="autoStart" :label="K('autoStart')" hide-details density="compact" color="primary" />
        <v-switch v-model="sound" :label="K('sound')" hide-details density="compact" color="primary" />
        <v-switch
          v-if="canNotify && permission === 'granted'"
          v-model="notify"
          :label="K('notify')"
          hide-details
          density="compact"
          color="primary"
        />
        <v-btn v-else-if="canNotify && permission !== 'denied'" variant="tonal" size="small" prepend-icon="mdi-bell-outline" @click="enableNotifications">
          {{ K('enableNotify') }}
        </v-btn>
        <span v-else-if="canNotify" class="text-caption text-medium-emphasis">{{ K('notifyBlocked') }}</span>
      </v-col>
    </v-row>
  </ToolShell>
</template>

<style scoped>
.clock {
  font-size: clamp(3.5rem, 18vw, 6rem);
  line-height: 1.1;
}
</style>
