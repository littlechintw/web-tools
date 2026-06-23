<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'

const { t } = useI18n()

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

onUnmounted(stopRaf)
</script>

<template>
  <ToolShell>
    <v-card variant="tonal" color="primary" class="mb-4">
      <v-card-text class="text-center py-8">
        <div class="text-h2 font-weight-bold stopwatch-mono">{{ display }}</div>
      </v-card-text>
    </v-card>

    <div class="d-flex ga-2 flex-wrap mb-4">
      <v-btn v-if="!running" color="primary" prepend-icon="mdi-play" @click="start">
        {{ elapsed > 0 ? t('tools.stopwatch.resume') : t('tools.stopwatch.start') }}
      </v-btn>
      <v-btn v-else color="warning" prepend-icon="mdi-pause" @click="pause">
        {{ t('tools.stopwatch.pause') }}
      </v-btn>
      <v-btn
        color="secondary"
        variant="tonal"
        prepend-icon="mdi-flag-outline"
        :disabled="elapsed <= 0"
        @click="lap"
      >
        {{ t('tools.stopwatch.lap') }}
      </v-btn>
      <v-btn variant="outlined" prepend-icon="mdi-restart" :disabled="elapsed <= 0 && !running" @click="reset">
        {{ t('tools.stopwatch.reset') }}
      </v-btn>
    </div>

    <v-table v-if="laps.length" density="comfortable">
      <thead>
        <tr>
          <th>{{ t('tools.stopwatch.lapNo') }}</th>
          <th class="text-right">{{ t('tools.stopwatch.split') }}</th>
          <th class="text-right">{{ t('tools.stopwatch.total') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="l in lapsReversed" :key="l.index">
          <td>#{{ l.index }}</td>
          <td class="text-right stopwatch-mono">{{ fmt(l.split) }}</td>
          <td class="text-right stopwatch-mono">{{ fmt(l.total) }}</td>
        </tr>
      </tbody>
    </v-table>
  </ToolShell>
</template>

<style scoped>
.stopwatch-mono {
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
