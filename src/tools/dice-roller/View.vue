<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import { useAudioContext } from '@/composables/useAudioContext'
import { intBetween, oneOf, useStoredRef } from '@/composables/useStoredRef'
import {
  MAX_DICE, MAX_SIDES, MIN_SIDES, PRESET_SIDES, formatDiceNotation, parseDiceNotation, rollDice,
  type DiceRoll, type DiceSpec,
} from '@/lib/dice'
import { prefersReducedMotion, randomRange } from '@/lib/random'

const { t } = useI18n()
const audio = useAudioContext()

const mode = useStoredRef('dice-roller.mode', 'simple', oneOf(['simple', 'notation'] as const))
const count = useStoredRef('dice-roller.count', 2, intBetween(1, MAX_DICE))
const sidesChoice = useStoredRef('dice-roller.sides', '6', (v): v is string =>
  v === 'custom' || PRESET_SIDES.some((s) => String(s) === v))
const customSides = useStoredRef('dice-roller.customSides', 30, intBetween(MIN_SIDES, MAX_SIDES))
const notation = ref('2d6+3')

interface HistoryItem { id: number; label: string; roll: DiceRoll }
const history = ref<HistoryItem[]>([])
const current = ref<DiceRoll | null>(null)
const rolling = ref(false)
const display = ref<number[]>([])
let nextId = 0
let timer: ReturnType<typeof setInterval> | undefined
let stopTimer: ReturnType<typeof setTimeout> | undefined

const sides = computed(() => (sidesChoice.value === 'custom' ? customSides.value : Number(sidesChoice.value)))

const parsed = computed(() => (mode.value === 'notation' ? parseDiceNotation(notation.value) : null))
const notationError = computed(() => {
  const p = parsed.value
  if (!p || p.ok) return ''
  return t(`tools.dice-roller.err.${p.error}`)
})

function currentSpec(): DiceSpec | null {
  if (mode.value === 'notation') {
    const p = parsed.value
    return p && p.ok ? p.spec : null
  }
  const n = Math.min(MAX_DICE, Math.max(1, Math.floor(Number(count.value)) || 1))
  const s = Math.min(MAX_SIDES, Math.max(MIN_SIDES, Math.floor(Number(sides.value)) || 6))
  return { count: n, sides: s, modifier: 0 }
}

const canRoll = computed(() => !rolling.value && currentSpec() !== null)

function clearTimers() {
  if (timer) clearInterval(timer)
  if (stopTimer) clearTimeout(stopTimer)
  timer = stopTimer = undefined
}

function thud(ctx: AudioContext) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain); gain.connect(ctx.destination)
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(260, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.12)
  gain.gain.setValueAtTime(0.3, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
  osc.start(); osc.stop(ctx.currentTime + 0.2)
}

function finish(roll: DiceRoll) {
  clearTimers()
  rolling.value = false
  current.value = roll
  history.value.unshift({ id: nextId++, label: formatDiceNotation(roll.spec), roll })
  if (history.value.length > 50) history.value.pop()
}

function doRoll() {
  const spec = currentSpec()
  if (!spec || rolling.value) return
  const roll = rollDice(spec)
  audio.play(thud)
  if (prefersReducedMotion()) {
    finish(roll)
    return
  }
  rolling.value = true
  current.value = null
  display.value = roll.rolls.map(() => randomRange(1, spec.sides))
  timer = setInterval(() => {
    display.value = roll.rolls.map(() => randomRange(1, spec.sides))
  }, 70)
  stopTimer = setTimeout(() => finish(roll), 650)
}

function clearHistory() {
  history.value = []
}

function rollText(h: HistoryItem): string {
  return h.roll.rolls.map((v, i) => (h.roll.kept[i] ? String(v) : `(${v})`)).join(' ')
}

const tiles = computed(() => {
  if (rolling.value) return display.value.map((v) => ({ v, kept: true }))
  const c = current.value
  return c ? c.rolls.map((v, i) => ({ v, kept: c.kept[i]! })) : []
})
const small = computed(() => tiles.value.length > 12)

onUnmounted(clearTimers)
</script>

<template>
  <ToolShell>
    <v-btn-toggle v-model="mode" mandatory density="comfortable" color="primary" variant="outlined" divided class="mb-4">
      <v-btn value="simple">{{ t('tools.dice-roller.modeSimple') }}</v-btn>
      <v-btn value="notation">{{ t('tools.dice-roller.modeNotation') }}</v-btn>
    </v-btn-toggle>

    <template v-if="mode === 'simple'">
      <v-row density="comfortable">
        <v-col cols="12" sm="6">
          <v-text-field
            v-model.number="count"
            type="number"
            :min="1"
            :max="MAX_DICE"
            :label="t('tools.dice-roller.count')"
            variant="outlined"
            density="comfortable"
            hide-details
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-if="sidesChoice === 'custom'"
            v-model.number="customSides"
            type="number"
            :min="MIN_SIDES"
            :max="MAX_SIDES"
            :label="t('tools.dice-roller.customSides')"
            variant="outlined"
            density="comfortable"
            hide-details
          />
        </v-col>
      </v-row>
      <div class="text-caption text-medium-emphasis mt-3 mb-1">{{ t('tools.dice-roller.sides') }}</div>
      <v-chip-group v-model="sidesChoice" mandatory selected-class="text-primary" column>
        <v-chip v-for="s in PRESET_SIDES" :key="s" :value="String(s)" variant="outlined" filter>d{{ s }}</v-chip>
        <v-chip value="custom" variant="outlined" filter>{{ t('tools.dice-roller.custom') }}</v-chip>
      </v-chip-group>
    </template>

    <template v-else>
      <v-text-field
        v-model="notation"
        :label="t('tools.dice-roller.notation')"
        placeholder="2d6+3"
        variant="outlined"
        density="comfortable"
        class="code-area"
        maxlength="40"
        :error-messages="notationError"
        :hint="t('tools.dice-roller.notationHint')"
        persistent-hint
        @keydown.enter="doRoll"
      />
    </template>

    <v-btn
      color="primary"
      size="large"
      prepend-icon="mdi-dice-multiple"
      class="mt-4"
      :disabled="!canRoll"
      :loading="rolling"
      @click="doRoll"
    >
      {{ t('tools.dice-roller.roll') }}
    </v-btn>

    <div class="stage mt-4" aria-live="polite">
      <div v-if="tiles.length" class="dice-grid" :class="{ small }">
        <div
          v-for="(d, i) in tiles"
          :key="i"
          class="die"
          :class="{ shaking: rolling, dropped: !d.kept }"
          :style="{ animationDelay: `${(i % 5) * 40}ms` }"
        >{{ d.v }}</div>
      </div>
      <div v-else class="text-medium-emphasis text-center py-6">{{ t('tools.dice-roller.empty') }}</div>
    </div>

    <v-card v-if="current && !rolling" variant="tonal" color="primary" class="pa-4 mt-2 text-center">
      <div class="text-caption">{{ formatDiceNotation(current.spec) }}</div>
      <div class="total tabular-nums">{{ current.total }}</div>
      <div v-if="current.spec.modifier !== 0 || current.spec.keep" class="text-body-2 tabular-nums">
        {{ t('tools.dice-roller.subtotal') }} {{ current.subtotal }}
        <template v-if="current.spec.modifier !== 0">
          {{ current.spec.modifier > 0 ? '+' : '−' }} {{ Math.abs(current.spec.modifier) }}
        </template>
      </div>
      <div v-if="current.spec.keep" class="text-caption">{{ t('tools.dice-roller.droppedNote') }}</div>
    </v-card>

    <div v-if="history.length" class="mt-6">
      <div class="d-flex align-center justify-space-between mb-2">
        <span class="text-subtitle-2">{{ t('tools.dice-roller.history') }}</span>
        <v-btn size="small" variant="text" prepend-icon="mdi-delete-outline" @click="clearHistory">
          {{ t('common.clear') }}
        </v-btn>
      </div>
      <v-list density="compact" lines="two" class="history-list">
        <v-list-item v-for="h in history" :key="h.id">
          <template #title>
            <span class="font-mono">{{ h.label }}</span>
            <span class="font-weight-bold ml-2 tabular-nums">= {{ h.roll.total }}</span>
          </template>
          <template #subtitle>
            <span class="font-mono break-all">{{ rollText(h) }}</span>
          </template>
        </v-list-item>
      </v-list>
      <div class="text-caption text-medium-emphasis mt-1">{{ t('tools.dice-roller.sessionNote') }}</div>
    </div>
  </ToolShell>
</template>

<style scoped>
.stage { min-height: 96px; }
.dice-grid { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.die {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  border: 2px solid rgb(var(--v-theme-primary));
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);
}
.dice-grid.small .die { width: 40px; height: 40px; font-size: 0.95rem; border-radius: 9px; border-width: 1.5px; }
.die.dropped { opacity: 0.4; text-decoration: line-through; border-style: dashed; }
.die.shaking { animation: tumble 0.35s ease-in-out infinite; }
@keyframes tumble {
  0% { transform: rotate(0deg) translateY(0); }
  25% { transform: rotate(-14deg) translateY(-8px); }
  50% { transform: rotate(10deg) translateY(0); }
  75% { transform: rotate(16deg) translateY(-6px); }
  100% { transform: rotate(0deg) translateY(0); }
}
.total { font-size: 3rem; font-weight: 700; line-height: 1.1; }
.history-list { max-height: 320px; overflow-y: auto; }
@media (prefers-reduced-motion: reduce) {
  .die.shaking { animation: none; }
}
</style>
