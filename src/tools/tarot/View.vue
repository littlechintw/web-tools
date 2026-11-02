<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import { useAudioContext } from '@/composables/useAudioContext'
import { oneOf, useStoredRef } from '@/composables/useStoredRef'
import { drawSpread, type DrawnCard, type SpreadKind } from '@/lib/tarot'

const { t } = useI18n()
const audio = useAudioContext()

const spread = useStoredRef<SpreadKind>('tarot.spread', 'single', oneOf(['single', 'three'] as const))

const drawn = ref<DrawnCard[]>([])
const revealed = ref<boolean[]>([])
const shuffling = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const positions = computed(() => (spread.value === 'three' ? ['past', 'present', 'future'] : ['single']))
const allRevealed = computed(() => revealed.value.length > 0 && revealed.value.every(Boolean))

function swish(ctx: AudioContext) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain); gain.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(520, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12)
  gain.gain.setValueAtTime(0.12, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
  osc.start(); osc.stop(ctx.currentTime + 0.22)
}

function draw() {
  if (shuffling.value) return
  drawn.value = []
  revealed.value = []
  shuffling.value = true
  audio.play(swish)
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  timer = setTimeout(() => {
    const cards = drawSpread(spread.value)
    drawn.value = cards
    revealed.value = cards.map(() => false)
    shuffling.value = false
  }, reduce ? 0 : 500)
}

function reveal(i: number) {
  if (revealed.value[i] === false) {
    revealed.value[i] = true
    audio.play(swish)
  }
}

function revealAll() {
  revealed.value = revealed.value.map(() => true)
}

function onSpreadChange() {
  clearTimeout(timer)
  shuffling.value = false
  drawn.value = []
  revealed.value = []
}

/** A small deterministic star/polygon motif per card (decoration only). */
function motif(n: number): string {
  const points = 3 + (n % 7)
  const step = points % 2 === 1 || points < 5 ? 1 : 2
  const pts: string[] = []
  for (let i = 0; i < points; i++) {
    const a = ((i * step) / points) * Math.PI * 2 - Math.PI / 2
    pts.push(`${(60 + 30 * Math.cos(a)).toFixed(1)},${(100 + 30 * Math.sin(a)).toFixed(1)}`)
  }
  return pts.join(' ')
}

onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <ToolShell>
    <v-alert type="warning" variant="tonal" density="comfortable" icon="mdi-information-outline" class="mb-4">
      <strong>{{ t('tools.tarot.notice') }}</strong>
    </v-alert>

    <v-btn-toggle
      v-model="spread"
      mandatory
      density="comfortable"
      color="primary"
      variant="outlined"
      divided
      class="mb-4"
      @update:model-value="onSpreadChange"
    >
      <v-btn value="single">{{ t('tools.tarot.spreadSingle') }}</v-btn>
      <v-btn value="three">{{ t('tools.tarot.spreadThree') }}</v-btn>
    </v-btn-toggle>

    <div class="d-flex flex-wrap ga-2">
      <v-btn color="primary" size="large" prepend-icon="mdi-cards-playing-outline" :loading="shuffling" @click="draw">
        {{ drawn.length ? t('tools.tarot.redraw') : t('tools.tarot.draw') }}
      </v-btn>
      <v-btn v-if="drawn.length && !allRevealed" size="large" variant="tonal" prepend-icon="mdi-eye-outline" @click="revealAll">
        {{ t('tools.tarot.revealAll') }}
      </v-btn>
    </div>

    <div v-if="!drawn.length && !shuffling" class="text-medium-emphasis text-center py-8">
      {{ t('tools.tarot.empty') }}
    </div>
    <div v-else-if="shuffling" class="text-medium-emphasis text-center py-8">{{ t('tools.tarot.shuffling') }}</div>

    <div v-if="drawn.length" class="spread mt-4" :class="spread">
      <div v-for="(d, i) in drawn" :key="d.card.id" class="slot">
        <div v-if="spread === 'three'" class="text-subtitle-2 text-center mb-1">
          {{ t(`tools.tarot.${positions[i]}`) }}
        </div>
        <button
          type="button"
          class="card-btn"
          :class="{ flipped: revealed[i] }"
          :aria-label="revealed[i]
            ? `${d.card.numeral} ${t(`tools.tarot.cards.${d.card.id}.name`)}`
            : t('tools.tarot.tapToReveal')"
          :aria-pressed="revealed[i]"
          @click="reveal(i)"
        >
          <span class="card-inner">
            <span class="card-face back" aria-hidden="true">
              <svg viewBox="0 0 120 200" class="art" focusable="false">
                <rect x="6" y="6" width="108" height="188" rx="8" fill="none" stroke="currentColor" stroke-width="2" />
                <rect x="14" y="14" width="92" height="172" rx="5" fill="none" stroke="currentColor" stroke-width="1" opacity="0.6" />
                <circle cx="60" cy="100" r="28" fill="none" stroke="currentColor" stroke-width="2" />
                <circle cx="60" cy="100" r="16" fill="none" stroke="currentColor" stroke-width="1.5" />
                <polygon points="60,66 66,94 94,100 66,106 60,134 54,106 26,100 54,94" fill="currentColor" opacity="0.8" />
              </svg>
            </span>
            <span class="card-face front">
              <span class="numeral" aria-hidden="true">{{ d.card.numeral }}</span>
              <svg viewBox="0 0 120 200" class="art" :class="{ rev: d.reversed }" aria-hidden="true" focusable="false">
                <rect x="6" y="6" width="108" height="188" rx="8" fill="none" stroke="currentColor" stroke-width="2" />
                <circle cx="60" cy="100" r="42" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.7" />
                <polygon :points="motif(d.card.number)" fill="currentColor" opacity="0.25" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                <circle cx="60" cy="100" r="5" fill="currentColor" />
                <path d="M60 52 L66 62 L54 62 Z" fill="currentColor" />
              </svg>
              <span class="cname">{{ t(`tools.tarot.cards.${d.card.id}.name`) }}</span>
            </span>
          </span>
        </button>

        <div v-if="revealed[i]" class="reading mt-2" aria-live="polite">
          <v-chip size="small" :color="d.reversed ? 'deep-orange' : 'success'" variant="tonal" class="mb-1">
            <v-icon start :icon="d.reversed ? 'mdi-arrow-down' : 'mdi-arrow-up'" />
            {{ d.reversed ? t('tools.tarot.reversed') : t('tools.tarot.upright') }}
          </v-chip>
          <div class="text-body-2">
            {{ t(`tools.tarot.cards.${d.card.id}.${d.reversed ? 'rev' : 'up'}`) }}
          </div>
        </div>
        <div v-else class="text-caption text-medium-emphasis text-center mt-2">{{ t('tools.tarot.tapToReveal') }}</div>
      </div>
    </div>

    <div v-if="drawn.length" class="text-caption text-medium-emphasis mt-4">{{ t('tools.tarot.notice') }}</div>
  </ToolShell>
</template>

<style scoped>
.spread { display: grid; gap: 16px; justify-content: center; }
.spread.single { grid-template-columns: minmax(0, 220px); }
.spread.three { grid-template-columns: repeat(3, minmax(0, 1fr)); max-width: 720px; margin-inline: auto; }
.slot { min-width: 0; }
.card-btn {
  display: block;
  width: 100%;
  aspect-ratio: 3 / 5;
  perspective: 900px;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  color: inherit;
  border-radius: 10px;
}
.card-btn:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 3px; }
.card-inner {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.7s cubic-bezier(0.4, 0.2, 0.2, 1);
}
.card-btn.flipped .card-inner { transform: rotateY(180deg); }
.card-face {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 10px;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}
.card-face.back {
  background: linear-gradient(160deg, #2b1a5a, #4b2c8f);
  color: #e8c86a;
  justify-content: center;
}
.card-face.front {
  background: linear-gradient(170deg, #f6ecd2, #e6d3a1);
  color: #4a2f7a;
  transform: rotateY(180deg);
  border: 1px solid #b8975a;
}
.art { position: absolute; inset: 0; width: 100%; height: 100%; }
.art.rev { transform: rotate(180deg); }
.numeral {
  position: relative;
  z-index: 1;
  margin-top: 6%;
  font-family: Georgia, 'Times New Roman', serif;
  font-weight: 700;
  font-size: clamp(0.75rem, 3.5vw, 1.2rem);
  letter-spacing: 0.05em;
}
.cname {
  position: relative;
  z-index: 1;
  margin-top: auto;
  margin-bottom: 8%;
  padding: 0 6%;
  text-align: center;
  font-weight: 700;
  font-size: clamp(0.65rem, 2.8vw, 0.95rem);
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.reading { text-align: center; }
@media (max-width: 480px) {
  .spread.three { gap: 8px; }
  .reading .text-body-2 { font-size: 0.75rem !important; text-align: left; }
}
@media (prefers-reduced-motion: reduce) {
  .card-inner { transition: none; }
}
</style>
