<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import { maskName } from '@/lib/lottery'

const { t } = useI18n()

// ── Types ─────────────────────────────────────────────────────────────────────
interface Prize {
  name: string
  count: number
}

interface HistoryItem {
  maskedName: string
  originalName: string
  prizeName: string
}

// ── Setup state ───────────────────────────────────────────────────────────────
type Phase = 'setup' | 'lottery'
const phase = ref<Phase>('setup')

const namesInput = ref('')
const privacyEnabled = ref(true)
const maskPosition = ref<'middle' | 'sides'>('middle')
const maskCount = ref(1)
const maskChar = ref('*')

const prizes = ref<Prize[]>([{ name: '', count: 1 }])

// ── Derived: raw names (only used internally for pool indexing) ───────────────
const names = ref<string[]>([])
const maskedNames = ref<string[]>([])

// ── Live preview: ALL names from textarea, masked or plain based on toggle ────
const previewNames = computed(() => {
  const lines = namesInput.value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (!privacyEnabled.value) return lines
  const char = maskChar.value.length > 0 ? maskChar.value[0] : '*'
  return lines.map((n) => maskName(n, maskPosition.value, maskCount.value, char))
})

// ── Prize management ──────────────────────────────────────────────────────────
function addPrize() {
  prizes.value.push({ name: '', count: 1 })
}

function removePrize(index: number) {
  prizes.value.splice(index, 1)
}

// ── Validation ────────────────────────────────────────────────────────────────
const hasValidNames = computed(() => {
  return namesInput.value.split('\n').some((l) => l.trim().length > 0)
})

const hasValidPrizes = computed(() => {
  return prizes.value.some((p) => p.name.trim().length > 0 && p.count > 0)
})

const canStart = computed(() => hasValidNames.value && hasValidPrizes.value)

// ── Lottery state ─────────────────────────────────────────────────────────────
// Pool: indices into the names/maskedNames arrays
const pool = ref<number[]>([])
// Prize queue: working copy so we can decrement counts
const prizeQueue = ref<Prize[]>([])
// Draw history
const history = ref<HistoryItem[]>([])
// Which pool index is currently "highlighted" after a draw
const winnerIndex = ref<number | null>(null)
// Animation
const animating = ref(false)
const displayMasked = ref('')
let animInterval: ReturnType<typeof setInterval> | null = null

// ── Start lottery ─────────────────────────────────────────────────────────────
function startLottery() {
  if (!canStart.value) return

  const rawLines = namesInput.value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const char = maskChar.value.length > 0 ? maskChar.value[0] : '*'
  names.value = rawLines
  maskedNames.value = privacyEnabled.value
    ? rawLines.map((n) => maskName(n, maskPosition.value, maskCount.value, char))
    : rawLines

  pool.value = rawLines.map((_, i) => i)

  prizeQueue.value = prizes.value
    .filter((p) => p.name.trim().length > 0 && p.count > 0)
    .map((p) => ({ name: p.name.trim(), count: p.count }))

  history.value = []
  winnerIndex.value = null
  displayMasked.value = ''
  phase.value = 'lottery'
}

// ── Draw logic ────────────────────────────────────────────────────────────────
const currentPrize = computed(() => prizeQueue.value.find((p) => p.count > 0) ?? null)

const allDrawn = computed(
  () => prizeQueue.value.every((p) => p.count <= 0) || pool.value.length === 0,
)

function draw() {
  if (animating.value) return
  if (pool.value.length === 0 || !currentPrize.value) return

  animating.value = true
  winnerIndex.value = null

  // Phase 1: fast cycling 50ms for 1.5s
  let elapsed = 0
  let interval = 50

  function step() {
    const randomIdx = Math.floor(Math.random() * pool.value.length)
    displayMasked.value = maskedNames.value[pool.value[randomIdx]]
    elapsed += interval

    if (elapsed < 1500) {
      // Stay fast
      animInterval = setTimeout(step, interval)
    } else if (elapsed < 2200) {
      // Slow down phase
      interval = 80
      animInterval = setTimeout(step, interval)
    } else if (elapsed < 2800) {
      interval = 120
      animInterval = setTimeout(step, interval)
    } else if (elapsed < 3200) {
      interval = 200
      animInterval = setTimeout(step, interval)
    } else if (elapsed < 3600) {
      interval = 350
      animInterval = setTimeout(step, interval)
    } else {
      // Pick winner
      const winnerPoolIdx = Math.floor(Math.random() * pool.value.length)
      const winnerNameIdx = pool.value[winnerPoolIdx]
      displayMasked.value = maskedNames.value[winnerNameIdx]
      winnerIndex.value = winnerNameIdx

      const prize = currentPrize.value!
      history.value.unshift({ maskedName: maskedNames.value[winnerNameIdx], originalName: names.value[winnerNameIdx], prizeName: prize.name })
      prize.count--

      // Remove from pool
      pool.value.splice(winnerPoolIdx, 1)

      animating.value = false
    }
  }

  animInterval = setTimeout(step, interval)
}

function drawAll() {
  if (animating.value) return
  while (pool.value.length > 0) {
    const prize = prizeQueue.value.find((p) => p.count > 0)
    if (!prize) break
    const winnerPoolIdx = Math.floor(Math.random() * pool.value.length)
    const winnerNameIdx = pool.value[winnerPoolIdx]
    history.value.unshift({
      maskedName: maskedNames.value[winnerNameIdx],
      originalName: names.value[winnerNameIdx],
      prizeName: prize.name,
    })
    prize.count--
    pool.value.splice(winnerPoolIdx, 1)
  }
  winnerIndex.value = null
  displayMasked.value = ''
}

function exportResults(mode: 'plain' | 'masked') {
  const lines = [...history.value].reverse().map((item, i) =>
    mode === 'plain'
      ? `${i + 1}. ${item.prizeName} → ${item.originalName}`
      : `${i + 1}. ${item.prizeName} → ${item.maskedName}`,
  )
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'lottery-results.txt'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Reset ─────────────────────────────────────────────────────────────────────
function reset() {
  if (animInterval !== null) {
    clearTimeout(animInterval)
    animInterval = null
  }
  animating.value = false
  winnerIndex.value = null
  displayMasked.value = ''
  history.value = []
  pool.value = []
  prizeQueue.value = []
  names.value = []
  maskedNames.value = []
  phase.value = 'setup'
}

onUnmounted(() => {
  if (animInterval !== null) {
    clearTimeout(animInterval)
  }
})

// ── Mask char validation (keep single char) ───────────────────────────────────
function onMaskCharInput(val: string) {
  maskChar.value = val.length > 0 ? val[val.length - 1] : '*'
}
</script>

<template>
  <ToolShell>
    <!-- ══════════════════════════════ SETUP PHASE ══════════════════════════════ -->
    <div v-if="phase === 'setup'">
      <v-row>
        <v-col cols="12">
          <div class="text-subtitle-1 font-weight-bold mb-3">{{ t('tools.lottery.setupTitle') }}</div>
        </v-col>
      </v-row>

      <!-- Names input -->
      <v-row>
        <v-col cols="12" md="6">
          <v-textarea
            v-model="namesInput"
            :label="t('tools.lottery.namesLabel')"
            :hint="t('tools.lottery.namesHint')"
            persistent-hint
            rows="8"
            auto-grow
            variant="outlined"
            density="comfortable"
          />
        </v-col>

        <!-- Privacy toggle + mask settings + preview -->
        <v-col cols="12" md="6">
          <!-- Privacy toggle -->
          <div class="d-flex align-center justify-space-between mb-3 privacy-toggle-row">
            <div>
              <div class="text-subtitle-2 font-weight-medium">{{ t('tools.lottery.privacyToggle') }}</div>
              <div class="text-caption text-medium-emphasis">{{ t('tools.lottery.maskSettings') }}</div>
            </div>
            <v-switch
              v-model="privacyEnabled"
              color="primary"
              hide-details
              density="compact"
              inset
            />
          </div>

          <!-- Mask details: only when privacy is enabled -->
          <template v-if="privacyEnabled">
            <v-select
              v-model="maskPosition"
              :label="t('tools.lottery.maskPosition')"
              :items="[
                { title: t('tools.lottery.maskMiddle'), value: 'middle' },
                { title: t('tools.lottery.maskSides'), value: 'sides' },
              ]"
              variant="outlined"
              density="comfortable"
              class="mb-3"
            />

            <v-text-field
              :model-value="maskCount"
              :label="t('tools.lottery.maskCount')"
              type="number"
              :min="1"
              :max="4"
              variant="outlined"
              density="comfortable"
              class="mb-3"
              @update:model-value="maskCount = Math.min(4, Math.max(1, Number($event) || 1))"
            />

            <v-text-field
              :model-value="maskChar"
              :label="t('tools.lottery.maskChar')"
              variant="outlined"
              density="comfortable"
              maxlength="2"
              class="mb-3"
              @update:model-value="onMaskCharInput($event)"
            />
          </template>

          <!-- Live preview: all names, updates as you paste -->
          <div v-if="previewNames.length > 0" class="preview-box pa-3 rounded">
            <div class="text-caption text-medium-emphasis mb-1">
              {{ t('tools.lottery.preview') }}（{{ previewNames.length }} {{ t('tools.lottery.people') }}）
            </div>
            <div
              v-for="(name, i) in previewNames"
              :key="i"
              class="preview-name font-weight-medium"
            >
              {{ name }}
            </div>
          </div>
        </v-col>
      </v-row>

      <!-- Prizes table -->
      <v-row class="mt-2">
        <v-col cols="12">
          <div class="text-subtitle-2 font-weight-medium mb-2">{{ t('tools.lottery.prizes') }}</div>

          <div
            v-for="(prize, idx) in prizes"
            :key="idx"
            class="d-flex align-center ga-2 mb-2"
          >
            <v-text-field
              v-model="prize.name"
              :label="t('tools.lottery.prizeName')"
              variant="outlined"
              density="compact"
              hide-details
              style="flex: 1"
            />
            <v-text-field
              :model-value="prize.count"
              :label="t('tools.lottery.prizeCount')"
              type="number"
              :min="1"
              variant="outlined"
              density="compact"
              hide-details
              style="width: 90px; flex-shrink: 0"
              @update:model-value="prize.count = Math.max(1, Number($event) || 1)"
            />
            <v-btn
              icon="mdi-minus"
              variant="text"
              color="error"
              size="small"
              :disabled="prizes.length <= 1"
              @click="removePrize(idx)"
            />
          </div>

          <v-btn
            variant="tonal"
            color="primary"
            size="small"
            prepend-icon="mdi-plus"
            class="mt-1"
            @click="addPrize"
          >
            {{ t('tools.lottery.addPrize') }}
          </v-btn>
        </v-col>
      </v-row>

      <!-- Start button -->
      <v-row class="mt-4">
        <v-col cols="12" class="d-flex justify-center">
          <v-btn
            color="primary"
            size="large"
            :disabled="!canStart"
            prepend-icon="mdi-ticket-confirmation"
            @click="startLottery"
          >
            {{ t('tools.lottery.startLottery') }}
          </v-btn>
        </v-col>
      </v-row>

      <!-- Inline validation hints -->
      <v-row v-if="!hasValidNames || !hasValidPrizes" class="mt-1">
        <v-col cols="12" class="d-flex justify-center">
          <span v-if="!hasValidNames" class="text-caption text-error mr-4">{{ t('tools.lottery.noNames') }}</span>
          <span v-if="!hasValidPrizes" class="text-caption text-error">{{ t('tools.lottery.noPrizes') }}</span>
        </v-col>
      </v-row>
    </div>

    <!-- ══════════════════════════════ LOTTERY PHASE ════════════════════════════ -->
    <div v-else>
      <!-- Top row: name pool + prize queue -->
      <v-row class="mb-4">
        <!-- Left: masked name pool -->
        <v-col cols="12" md="4">
          <div class="text-subtitle-2 font-weight-medium mb-1">
            {{ t('tools.lottery.remaining') }}：{{ pool.length }} {{ t('tools.lottery.people') }}
          </div>
          <div class="name-pool">
            <v-chip
              v-for="idx in maskedNames.map((_, i) => i)"
              :key="idx"
              :color="pool.includes(idx) ? 'primary' : 'default'"
              :variant="pool.includes(idx) ? (winnerIndex === idx ? 'elevated' : 'tonal') : 'outlined'"
              :class="{ 'winner-chip': winnerIndex === idx }"
              size="small"
              class="ma-1"
            >
              {{ maskedNames[idx] }}
            </v-chip>
          </div>
        </v-col>

        <!-- Center: animation display + draw button -->
        <v-col cols="12" md="4" class="d-flex flex-column align-center justify-center">
          <div
            class="draw-display mb-4"
            :class="{ 'draw-display--animating': animating, 'draw-display--winner': winnerIndex !== null && !animating }"
          >
            <span v-if="!displayMasked && !animating" class="text-medium-emphasis text-caption">
              ↑ {{ t('tools.lottery.draw') }}
            </span>
            <span v-else>{{ displayMasked }}</span>
          </div>

          <div v-if="winnerIndex !== null && !animating" class="text-center mb-2">
            <v-chip color="success" variant="elevated" size="small">
              {{ t('tools.lottery.winner') }}
            </v-chip>
            <div class="text-caption mt-1">{{ history[0]?.prizeName }}</div>
          </div>

          <v-btn
            color="primary"
            size="large"
            :disabled="animating || allDrawn || pool.length === 0"
            :loading="animating"
            @click="draw"
          >
            {{ animating ? t('tools.lottery.drawing') : t('tools.lottery.draw') }}
          </v-btn>

          <v-btn
            variant="outlined"
            color="secondary"
            size="small"
            :disabled="animating || allDrawn || pool.length === 0"
            class="mt-2"
            prepend-icon="mdi-fast-forward"
            @click="drawAll"
          >
            {{ t('tools.lottery.drawAll') }}
          </v-btn>

          <div v-if="allDrawn" class="text-caption text-success mt-2 text-center">
            {{ t('tools.lottery.allDrawn') }}
          </div>
        </v-col>

        <!-- Right: prize queue -->
        <v-col cols="12" md="4">
          <div class="text-subtitle-2 font-weight-medium mb-1">{{ t('tools.lottery.prizeQueue') }}</div>
          <div class="prize-queue">
            <div
              v-for="(prize, idx) in prizeQueue"
              :key="idx"
              class="d-flex align-center justify-space-between prize-row pa-2 rounded mb-1"
              :class="{ 'prize-row--active': prize.count > 0, 'prize-row--done': prize.count <= 0 }"
            >
              <span class="font-weight-medium">{{ prize.name }}</span>
              <v-chip
                :color="prize.count > 0 ? 'warning' : 'default'"
                variant="tonal"
                size="small"
              >
                {{ t('tools.lottery.prizeLeft') }}：{{ prize.count }}
              </v-chip>
            </div>
          </div>
        </v-col>
      </v-row>

      <!-- Draw history -->
      <v-divider class="mb-3" />
      <div class="text-subtitle-2 font-weight-medium mb-2">{{ t('tools.lottery.history') }}</div>

      <div v-if="history.length === 0" class="text-body-2 text-medium-emphasis mb-4">
        {{ t('tools.lottery.historyEmpty') }}
      </div>
      <div v-else class="history-list mb-4">
        <v-chip
          v-for="(item, idx) in history"
          :key="idx"
          color="secondary"
          variant="tonal"
          size="small"
          class="ma-1"
        >
          {{ item.prizeName }} → {{ item.maskedName }}
        </v-chip>
      </div>

      <div v-if="history.length > 0" class="d-flex justify-center ga-2 mb-4 flex-wrap">
        <v-btn
          variant="tonal"
          color="primary"
          prepend-icon="mdi-download"
          size="small"
          @click="exportResults('masked')"
        >
          {{ t('tools.lottery.exportMasked') }}
        </v-btn>
        <v-btn
          variant="tonal"
          color="secondary"
          prepend-icon="mdi-download"
          size="small"
          @click="exportResults('plain')"
        >
          {{ t('tools.lottery.exportPlain') }}
        </v-btn>
      </div>

      <!-- Reset button -->
      <div class="d-flex justify-center">
        <v-btn
          variant="outlined"
          color="error"
          prepend-icon="mdi-refresh"
          :disabled="animating"
          @click="reset"
        >
          {{ t('tools.lottery.reset') }}
        </v-btn>
      </div>
    </div>
  </ToolShell>
</template>

<style scoped>
/* ── Setup ── */
.privacy-toggle-row {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px;
  padding: 8px 12px;
  background: rgba(var(--v-theme-on-surface), 0.02);
}

.preview-box {
  background: rgba(var(--v-theme-on-surface), 0.04);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  max-height: 260px;
  overflow-y: auto;
}

.preview-name {
  font-family: monospace;
  font-size: 0.95rem;
  line-height: 1.7;
  letter-spacing: 0.04em;
}

/* ── Pool ── */
.name-pool {
  max-height: 280px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 8px;
}

/* ── Draw display ── */
.draw-display {
  width: 100%;
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: monospace;
  font-size: clamp(0.85rem, 2.5vw, 1.3rem);
  font-weight: 700;
  letter-spacing: 0.04em;
  border: 2px solid rgba(var(--v-theme-on-surface), 0.18);
  border-radius: 10px;
  padding: 8px 12px;
  text-align: center;
  transition: border-color 0.2s, background 0.2s;
  background: rgba(var(--v-theme-on-surface), 0.03);
  word-break: break-all;
  overflow-wrap: break-word;
}

.draw-display--animating {
  border-color: rgb(var(--v-theme-primary));
  animation: flicker 0.12s infinite alternate;
}

.draw-display--winner {
  border-color: rgb(var(--v-theme-success));
  background: rgba(var(--v-theme-success), 0.08);
}

@keyframes flicker {
  from { opacity: 0.85; }
  to   { opacity: 1; }
}

/* ── Winner chip pulse ── */
.winner-chip {
  animation: pulse 0.6s ease-out;
}

@keyframes pulse {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.25); }
  100% { transform: scale(1); }
}

/* ── Prize queue ── */
.prize-queue {
  max-height: 280px;
  overflow-y: auto;
}

.prize-row {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}

.prize-row--active {
  border-color: rgba(var(--v-theme-primary), 0.35);
}

.prize-row--done {
  opacity: 0.45;
}

/* ── History ── */
.history-list {
  display: flex;
  flex-wrap: wrap;
}
</style>
