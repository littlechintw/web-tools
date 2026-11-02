<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import { useAudioContext } from '@/composables/useAudioContext'
import { intBetween, oneOf, useStoredRef } from '@/composables/useStoredRef'
import { MAX_COINS, computeStats, flipCoins, type Side } from '@/lib/coinFlip'
import { prefersReducedMotion } from '@/lib/random'

const { t } = useI18n()
const audio = useAudioContext()

const mode = useStoredRef('coin-flip.mode', 'flip', oneOf(['flip', 'decide'] as const))
const count = useStoredRef('coin-flip.count', 1, intBetween(1, MAX_COINS))
const optA = useStoredRef('coin-flip.optionA', '', (v): v is string => typeof v === 'string' && v.length <= 40)
const optB = useStoredRef('coin-flip.optionB', '', (v): v is string => typeof v === 'string' && v.length <= 40)

const SESSION_CAP = 20000
const session = ref<Side[]>([])
const stats = computed(() => computeStats(session.value))

const coins = ref<Side[]>([])
const flipId = ref(0)
const flipping = ref(false)
const showResult = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const labelA = computed(() => optA.value.trim() || t('tools.coin-flip.optionADefault'))
const labelB = computed(() => optB.value.trim() || t('tools.coin-flip.optionBDefault'))
const decision = computed(() => (coins.value[0] === 'heads' ? labelA.value : labelB.value))

const n = computed(() => (mode.value === 'decide' ? 1 : Math.min(MAX_COINS, Math.max(1, Math.floor(Number(count.value)) || 1))))
const roundStats = computed(() => computeStats(coins.value))

function clink(ctx: AudioContext) {
  for (const [dt, f] of [[0, 2400], [0.07, 3100]] as const) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = f
    gain.gain.setValueAtTime(0.18, ctx.currentTime + dt)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dt + 0.25)
    osc.start(ctx.currentTime + dt); osc.stop(ctx.currentTime + dt + 0.26)
  }
}

function land() {
  flipping.value = false
  showResult.value = true
  audio.play(clink)
}

function doFlip() {
  if (flipping.value) return
  const result = flipCoins(n.value)
  coins.value = result
  flipId.value++
  session.value = session.value.concat(result).slice(-SESSION_CAP)
  showResult.value = false
  if (prefersReducedMotion()) {
    land()
    return
  }
  flipping.value = true
  timer = setTimeout(land, result.length > 1 ? 1450 : 1150)
}

function resetStats() {
  session.value = []
}

const sideName = (s: Side | null) => (s ? t(`tools.coin-flip.${s}`) : '–')
const pct = computed(() => `${(stats.value.headsRatio * 100).toFixed(1)}%`)

onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <ToolShell>
    <v-btn-toggle v-model="mode" mandatory density="comfortable" color="primary" variant="outlined" divided class="mb-4">
      <v-btn value="flip">{{ t('tools.coin-flip.modeFlip') }}</v-btn>
      <v-btn value="decide">{{ t('tools.coin-flip.modeDecide') }}</v-btn>
    </v-btn-toggle>

    <v-text-field
      v-if="mode === 'flip'"
      v-model.number="count"
      type="number"
      :min="1"
      :max="MAX_COINS"
      :label="t('tools.coin-flip.count')"
      variant="outlined"
      density="comfortable"
      hide-details
      class="count-field"
      :disabled="flipping"
    />
    <v-row v-else density="comfortable">
      <v-col cols="12" sm="6">
        <v-text-field
          v-model="optA"
          :label="t('tools.coin-flip.optionA')"
          :placeholder="t('tools.coin-flip.optionAHint')"
          maxlength="40"
          variant="outlined"
          density="comfortable"
          hide-details
          :disabled="flipping"
        />
      </v-col>
      <v-col cols="12" sm="6">
        <v-text-field
          v-model="optB"
          :label="t('tools.coin-flip.optionB')"
          :placeholder="t('tools.coin-flip.optionBHint')"
          maxlength="40"
          variant="outlined"
          density="comfortable"
          hide-details
          :disabled="flipping"
        />
      </v-col>
    </v-row>

    <div v-if="mode === 'decide'" class="text-caption text-medium-emphasis mt-1">
      {{ t('tools.coin-flip.decideHint') }}
    </div>

    <v-btn
      color="primary"
      size="large"
      prepend-icon="mdi-hand-coin"
      class="mt-4"
      :loading="flipping"
      :disabled="flipping"
      @click="doFlip"
    >
      {{ mode === 'decide' ? t('tools.coin-flip.decide') : t('tools.coin-flip.flip') }}
    </v-btn>

    <div class="stage mt-4">
      <div v-if="coins.length" :key="flipId" class="coins" :class="{ big: coins.length === 1, tiny: coins.length > 20 }">
        <div
          v-for="(c, i) in coins"
          :key="i"
          class="coin-wrap"
          :class="{ lifting: flipping && coins.length === 1 }"
        >
          <div
            class="coin"
            :class="{ spinning: flipping }"
            :style="{
              '--final': c === 'heads' ? '0deg' : '180deg',
              '--end': c === 'heads' ? '1080deg' : '1260deg',
              '--delay': `${(i % 10) * 30}ms`,
            }"
          >
            <div class="face heads">{{ t('tools.coin-flip.headsShort') }}</div>
            <div class="face tails">{{ t('tools.coin-flip.tailsShort') }}</div>
          </div>
        </div>
      </div>
      <div v-else class="text-medium-emphasis text-center py-8">{{ t('tools.coin-flip.empty') }}</div>
    </div>

    <div aria-live="polite" class="mt-2">
      <v-card v-if="showResult && coins.length" variant="tonal" color="primary" class="pa-4 text-center">
        <template v-if="mode === 'decide'">
          <div class="text-caption">{{ t('tools.coin-flip.decisionIs') }}</div>
          <div class="decision break-all">{{ decision }}</div>
          <div class="text-caption mt-1">{{ sideName(coins[0] ?? null) }}</div>
        </template>
        <template v-else>
          <div class="tabular-nums text-h6">
            {{ t('tools.coin-flip.heads') }} {{ roundStats.heads }} · {{ t('tools.coin-flip.tails') }} {{ roundStats.tails }}
          </div>
          <div v-if="coins.length > 1" class="text-body-2 mt-1">
            {{ t('tools.coin-flip.longestThisRound') }}: {{ sideName(roundStats.longest.side) }} × {{ roundStats.longest.length }}
          </div>
        </template>
      </v-card>
    </div>

    <v-card variant="outlined" class="pa-4 mt-6">
      <div class="d-flex align-center justify-space-between mb-2">
        <span class="text-subtitle-2">{{ t('tools.coin-flip.statsTitle') }}</span>
        <v-btn size="small" variant="text" prepend-icon="mdi-restart" :disabled="!stats.total" @click="resetStats">
          {{ t('common.reset') }}
        </v-btn>
      </div>
      <v-row density="comfortable" class="text-center">
        <v-col cols="4">
          <div class="stat tabular-nums">{{ stats.total }}</div>
          <div class="text-caption">{{ t('tools.coin-flip.total') }}</div>
        </v-col>
        <v-col cols="4">
          <div class="stat tabular-nums">{{ stats.heads }}</div>
          <div class="text-caption">{{ t('tools.coin-flip.heads') }}</div>
        </v-col>
        <v-col cols="4">
          <div class="stat tabular-nums">{{ stats.tails }}</div>
          <div class="text-caption">{{ t('tools.coin-flip.tails') }}</div>
        </v-col>
      </v-row>
      <v-progress-linear
        :model-value="stats.headsRatio * 100"
        height="8"
        rounded
        color="amber-darken-2"
        bg-color="blue-grey"
        class="my-2"
        :aria-label="t('tools.coin-flip.headsShare')"
      />
      <div class="text-body-2 tabular-nums d-flex flex-wrap justify-space-between ga-2">
        <span>{{ t('tools.coin-flip.headsShare') }}: {{ pct }}</span>
        <span>{{ t('tools.coin-flip.currentStreak') }}: {{ sideName(stats.current.side) }} × {{ stats.current.length }}</span>
        <span>{{ t('tools.coin-flip.longestStreak') }}: {{ sideName(stats.longest.side) }} × {{ stats.longest.length }}</span>
      </div>
      <div class="text-caption text-medium-emphasis mt-2">{{ t('tools.coin-flip.sessionNote') }}</div>
    </v-card>
  </ToolShell>
</template>

<style scoped>
.count-field { max-width: 240px; }
.stage { min-height: 110px; perspective: 800px; }
.coins { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
.coin-wrap { --size: 44px; width: var(--size); height: var(--size); }
.coins.big .coin-wrap { --size: 120px; }
.coins.tiny .coin-wrap { --size: 28px; }
.coin {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transform: rotateY(var(--final));
}
.coin.spinning { animation: flip 1.1s cubic-bezier(0.3, 0.6, 0.4, 1) var(--delay) forwards; }
.face {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: calc(var(--size) * 0.42);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  color: #5d4300;
  border: calc(var(--size) * 0.06) solid #b8860b;
  box-shadow: inset 0 0 calc(var(--size) * 0.2) rgba(120, 80, 0, 0.45), 0 3px 8px rgba(0, 0, 0, 0.3);
}
.face.heads { background: radial-gradient(circle at 35% 30%, #fff1a8, #f2c230 60%, #c99a10); }
.face.tails { background: radial-gradient(circle at 35% 30%, #f4f4f4, #c8ccd2 60%, #9aa0a8); transform: rotateY(180deg); color: #3c4047; border-color: #7b828b; }
.coin-wrap.lifting { animation: lift 1.1s ease-out forwards; }
@keyframes flip {
  from { transform: rotateY(0deg); }
  to { transform: rotateY(var(--end)); }
}
@keyframes lift {
  0% { transform: translateY(0) scale(1); }
  45% { transform: translateY(-70px) scale(1.2); }
  100% { transform: translateY(0) scale(1); }
}
.decision { font-size: 2rem; font-weight: 700; line-height: 1.2; }
.stat { font-size: 1.6rem; font-weight: 700; }
@media (prefers-reduced-motion: reduce) {
  .coin.spinning, .coin-wrap.lifting { animation: none; }
}
</style>
