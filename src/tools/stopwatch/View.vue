<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'

const { t } = useI18n()
const T = (key: string, args?: Record<string, unknown>) => t(`tools.stopwatch.${key}`, args ?? {})

const elapsed = ref(0) // ms
const running = ref(false)

let rafId: number | null = null
let startStamp = 0 // performance.now() at last (re)start
let accumulated = 0 // ms accumulated before the current run segment

interface Lap {
  index: number
  total: number // total elapsed at the lap
  split: number // delta from previous lap
}
const laps = ref<Lap[]>([])

function frame() {
  elapsed.value = accumulated + (performance.now() - startStamp)
  rafId = requestAnimationFrame(frame)
}

function stopRaf() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

function start() {
  if (running.value) return
  running.value = true
  startStamp = performance.now()
  rafId = requestAnimationFrame(frame)
}

function pause() {
  if (!running.value) return
  running.value = false
  accumulated += performance.now() - startStamp
  elapsed.value = accumulated
  stopRaf()
}

function toggle() {
  if (running.value) pause()
  else start()
}

function reset() {
  stopRaf()
  running.value = false
  accumulated = 0
  elapsed.value = 0
  laps.value = []
}

function lap() {
  // Allow lapping while running or paused; ignore at zero.
  if (elapsed.value <= 0) return
  const prevTotal = laps.value.length ? laps.value[laps.value.length - 1].total : 0
  laps.value.push({
    index: laps.value.length + 1,
    total: elapsed.value,
    split: elapsed.value - prevTotal,
  })
}

/** Format ms as mm:ss.cs (centiseconds). Hours roll into minutes when long. */
function fmt(ms: number): string {
  const totalCs = Math.floor(ms / 10)
  const cs = totalCs % 100
  const totalSec = Math.floor(totalCs / 100)
  const sec = totalSec % 60
  const min = Math.floor(totalSec / 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(min)}:${pad(sec)}.${pad(cs)}`
}

const display = computed(() => fmt(elapsed.value))
const lapsReversed = computed(() => [...laps.value].reverse())
/** One line per lap, oldest first: "#1<tab>split<tab>total". */
const lapsText = computed(() => laps.value.map((l) => `#${l.index}\t${fmt(l.split)}\t${fmt(l.total)}`).join('\n'))

/* ---------------- Keyboard shortcuts ---------------- */

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable="true"]')
}

function isSpace(e: KeyboardEvent): boolean {
  return e.code === 'Space' || e.key === ' '
}

function onKeydown(e: KeyboardEvent) {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
  if (isTypingTarget(e.target)) return
  if (isSpace(e)) {
    e.preventDefault()
    toggle()
    return
  }
  const key = e.key.toLowerCase()
  if (key === 'l') {
    e.preventDefault()
    lap()
  } else if (key === 'r') {
    e.preventDefault()
    reset()
  }
}

// Buttons activate on the keyup of Space, so a shortcut press while a button
// still has focus (e.g. after clicking "Lap") would also click that button.
function onKeyup(e: KeyboardEvent) {
  if (isSpace(e) && e.target instanceof HTMLElement && e.target.closest('button') && !isTypingTarget(e.target)) {
    e.preventDefault()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('keyup', onKeyup)
})

onUnmounted(() => {
  stopRaf()
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('keyup', onKeyup)
})
</script>

<template>
  <ToolShell>
    <v-card variant="tonal" color="primary" class="mb-4">
      <v-card-text class="text-center py-8">
        <div class="text-h2 font-weight-bold font-mono tabular-nums">{{ display }}</div>
      </v-card-text>
    </v-card>

    <div class="d-flex ga-2 flex-wrap mb-2">
      <v-btn v-if="!running" color="primary" prepend-icon="mdi-play" @click="start">
        {{ elapsed > 0 ? T('resume') : T('start') }}
      </v-btn>
      <v-btn v-else color="warning" prepend-icon="mdi-pause" @click="pause">
        {{ T('pause') }}
      </v-btn>
      <v-btn
        color="secondary"
        variant="tonal"
        prepend-icon="mdi-flag-outline"
        :disabled="elapsed <= 0"
        @click="lap"
      >
        {{ T('lap') }}
      </v-btn>
      <v-btn variant="outlined" prepend-icon="mdi-restart" :disabled="elapsed <= 0 && !running" @click="reset">
        {{ T('reset') }}
      </v-btn>
    </div>

    <p class="text-caption text-medium-emphasis mb-4">
      <v-icon icon="mdi-keyboard-outline" size="14" class="mr-1" />{{ T('shortcutsHint') }}
    </p>

    <template v-if="laps.length">
      <div class="d-flex align-center ga-2 mb-1">
        <span class="text-subtitle-2">{{ T('lapsTitle', { count: laps.length }) }}</span>
        <v-spacer />
        <CopyBtn :text="lapsText" variant="text" size="small" />
      </div>
      <v-table density="comfortable">
        <thead>
          <tr>
            <th>{{ T('lapNo') }}</th>
            <th class="text-right">{{ T('split') }}</th>
            <th class="text-right">{{ T('total') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in lapsReversed" :key="l.index">
            <td>#{{ l.index }}</td>
            <td class="text-right font-mono tabular-nums">{{ fmt(l.split) }}</td>
            <td class="text-right font-mono tabular-nums">{{ fmt(l.total) }}</td>
          </tr>
        </tbody>
      </v-table>
    </template>
  </ToolShell>
</template>
