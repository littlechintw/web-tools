<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// ---- config ----
const ROWS = 10
const COLS = 15
const TOTAL = ROWS * COLS

// Random size per bubble (30–52 px), seeded once on mount
const bubbleSizes = Array.from({ length: TOTAL }, () => 30 + Math.floor(Math.random() * 23))

// ---- state ----
const bubbles = ref<boolean[]>(Array(TOTAL).fill(false))

const poppedCount = computed(() => bubbles.value.filter(Boolean).length)
const allPopped = computed(() => poppedCount.value === TOTAL)

// ---- audio ----
let audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = new Ctor()
  }
  return audioCtx
}

function playPop(ctx: AudioContext, size: number) {
  // Larger bubbles = deeper, longer pop
  const freq = 1400 - size * 16
  const dur = 0.04 + size * 0.001
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.2))
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  filter.Q.value = 0.6
  const gain = ctx.createGain()
  // Larger bubbles are louder, with a bit of randomness
  gain.gain.value = 0.2 + (size / 52) * 0.35 + Math.random() * 0.12
  src.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  src.start()
}

// ---- pop a single bubble ----
function popBubble(index: number) {
  if (bubbles.value[index]) return
  bubbles.value[index] = true
  try {
    playPop(getAudioCtx(), bubbleSizes[index])
  } catch {
    /* audio unavailable */
  }
}

// ---- pop all in random order ----
const poppingAll = ref(false)

async function popAll() {
  if (poppingAll.value) return
  poppingAll.value = true
  try {
    const ctx = getAudioCtx()
    // Fisher-Yates shuffle of un-popped indices
    const indices = Array.from({ length: TOTAL }, (_, i) => i).filter((i) => !bubbles.value[i])
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
    for (const i of indices) {
      bubbles.value[i] = true
      try {
        playPop(ctx, bubbleSizes[i])
      } catch {
        /* audio unavailable */
      }
      await new Promise<void>((r) => setTimeout(r, 28))
    }
  } finally {
    poppingAll.value = false
  }
}

// ---- reset ----
function reset() {
  bubbles.value = Array(TOTAL).fill(false)
}
</script>

<template>
  <v-container class="pa-4" style="max-width: 860px">
    <!-- counter row -->
    <div class="d-flex align-center justify-space-between flex-wrap gap-2 mb-4">
      <div class="text-body-1">
        <span class="font-weight-bold text-primary">{{ poppedCount }}</span>
        <span class="text-medium-emphasis"> / {{ TOTAL }} {{ t('tools.bubble-wrap.total') }}</span>
        <v-chip v-if="allPopped" color="success" size="small" class="ml-2" variant="flat">🎉</v-chip>
      </div>
      <div class="d-flex gap-2">
        <v-btn
          size="small"
          variant="tonal"
          color="primary"
          :disabled="poppingAll || allPopped"
          @click="popAll"
        >
          {{ t('tools.bubble-wrap.popAll') }}
        </v-btn>
        <v-btn
          size="small"
          variant="tonal"
          color="secondary"
          :disabled="poppingAll || poppedCount === 0"
          @click="reset"
        >
          {{ t('tools.bubble-wrap.reset') }}
        </v-btn>
      </div>
    </div>

    <!-- bubble grid — fixed cell spacing, variable bubble size -->
    <div class="bubble-scroll-wrap">
      <div class="bubble-grid">
        <div v-for="(popped, i) in bubbles" :key="i" class="bubble-cell">
          <button
            class="bubble"
            :class="{ 'bubble--popped': popped }"
            :style="{ width: bubbleSizes[i] + 'px', height: bubbleSizes[i] + 'px' }"
            :aria-label="popped ? t('tools.bubble-wrap.popped') : 'bubble ' + (i + 1)"
            :aria-pressed="popped"
            @click="popBubble(i)"
          />
        </div>
      </div>
    </div>
  </v-container>
</template>

<style scoped>
.bubble-scroll-wrap {
  overflow-x: auto;
}

/* Fixed 56px cell grid — centers are equally spaced */
.bubble-grid {
  display: grid;
  grid-template-columns: repeat(15, 56px);
  grid-template-rows: repeat(10, 56px);
  width: fit-content;
  margin: 0 auto;
}

/* Each cell centers its bubble */
.bubble-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
}

.bubble {
  border-radius: 50%;
  border: none;
  outline: none;
  padding: 0;
  cursor: pointer;
  background: radial-gradient(circle at 35% 35%, #e0f0ff, #90c8f0);
  box-shadow:
    inset -2px -2px 4px rgba(0, 0, 0, 0.2),
    2px 2px 6px rgba(0, 0, 0, 0.15);
  transition: transform 0.08s ease;
  -webkit-tap-highlight-color: transparent;
}

.bubble:hover:not(.bubble--popped) {
  transform: scale(1.1);
}

.bubble:active:not(.bubble--popped) {
  transform: scale(0.85);
}

.bubble--popped {
  background: #b0c4d8;
  box-shadow: inset 2px 2px 4px rgba(0, 0, 0, 0.3);
  cursor: default;
  transform: scale(0.88);
  opacity: 0.6;
}
</style>
