<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'

const { t } = useI18n()

type ResultType = 'shengbei' | 'xiaobei' | 'yinbei'

interface ThrowResult { type: ResultType; cup1FaceUp: boolean; cup2FaceUp: boolean }
interface HistoryItem { id: number; type: ResultType }

const question = ref('')
const throwing = ref(false)
const cup1FaceUp = ref(true)
const cup2FaceUp = ref(false)
const currentResult = ref<ThrowResult | null>(null)
const history = ref<HistoryItem[]>([])
const showFlying = ref(false)
let nextId = 0

let audioCtx: AudioContext | null = null

function knockSound() {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!audioCtx) audioCtx = new Ctor()
    const ctx = audioCtx
    for (const dt of [0, 0.1]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(480, ctx.currentTime + dt)
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + dt + 0.18)
      gain.gain.setValueAtTime(0.55, ctx.currentTime + dt)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dt + 0.3)
      osc.start(ctx.currentTime + dt)
      osc.stop(ctx.currentTime + dt + 0.3)
    }
  } catch { /* silent */ }
}

function determineResult(c1: boolean, c2: boolean): ResultType {
  if (c1 !== c2) return 'shengbei'
  return c1 ? 'xiaobei' : 'yinbei'
}

function throwCups() {
  if (throwing.value) return
  throwing.value = true
  currentResult.value = null

  const rand = Math.random()
  let c1: boolean, c2: boolean
  if (rand < 0.5)       { c1 = Math.random() < 0.5; c2 = !c1 }
  else if (rand < 0.75) { c1 = true;  c2 = true  }
  else                  { c1 = false; c2 = false }

  // Hide static cups, show flying animation
  showFlying.value = true

  // Animation is 800ms; at 750ms snap & hide flying, show static
  setTimeout(() => {
    cup1FaceUp.value = c1
    cup2FaceUp.value = c2
    showFlying.value = false

    setTimeout(() => {
      throwing.value = false
      const result: ThrowResult = { type: determineResult(c1, c2), cup1FaceUp: c1, cup2FaceUp: c2 }
      currentResult.value = result
      history.value.unshift({ id: nextId++, type: result.type })
      if (history.value.length > 5) history.value.pop()
      knockSound()
    }, 120)
  }, 750)
}

const resultConfig: Record<ResultType, { color: string; icon: string }> = {
  shengbei: { color: 'success', icon: '🟢' },
  xiaobei:  { color: 'warning', icon: '😄' },
  yinbei:   { color: 'error',   icon: '⬛' },
}

onUnmounted(() => { audioCtx?.close().catch(() => {}); audioCtx = null })
</script>

<template>
  <ToolShell>
    <div class="jiaobei-wrap">

      <v-text-field
        v-model="question"
        :label="t('tools.jiaobei.question')"
        :placeholder="t('tools.jiaobei.questionHint')"
        variant="outlined"
        density="comfortable"
        class="question-field"
        hide-details
        :disabled="throwing"
      />

      <!-- Stage: static cups hidden while flying -->
      <div class="cups-stage">
        <div v-show="!showFlying" class="cups-row">
          <div class="cup" :class="cup1FaceUp ? 'face-up' : 'face-down'" />
          <div class="cup" :class="cup2FaceUp ? 'face-up' : 'face-down'" />
        </div>

        <!-- Flying cups — GPU-only animation (translate3d + rotateZ + scale) -->
        <div v-if="showFlying" class="cups-row flying-row" aria-hidden="true">
          <div class="cup cup-fly cup-fly-1" />
          <div class="cup cup-fly cup-fly-2" />
        </div>
      </div>

      <v-btn
        color="primary"
        size="large"
        :loading="throwing"
        :disabled="throwing"
        class="throw-btn"
        @click="throwCups"
      >
        {{ throwing ? t('tools.jiaobei.throwing') : t('tools.jiaobei.throw') }}
      </v-btn>

      <Transition name="result-fade">
        <div v-if="currentResult" class="result-block">
          <v-chip
            :color="resultConfig[currentResult.type].color"
            size="x-large"
            variant="flat"
            class="result-chip"
          >
            <span class="result-icon mr-2">{{ resultConfig[currentResult.type].icon }}</span>
            <strong>{{ t(`tools.jiaobei.${currentResult.type}`) }}</strong>
          </v-chip>
          <div class="result-desc mt-2 text-body-1">
            {{ t(`tools.jiaobei.${currentResult.type}Desc`) }}
          </div>
        </div>
      </Transition>

      <div v-if="history.length" class="history-block mt-4">
        <div class="text-caption text-medium-emphasis mb-2">{{ t('tools.jiaobei.history') }}</div>
        <div class="history-icons">
          <v-tooltip
            v-for="item in history"
            :key="item.id"
            :text="t(`tools.jiaobei.${item.type}`)"
            location="top"
          >
            <template #activator="{ props }">
              <v-chip v-bind="props" :color="resultConfig[item.type].color" size="small" variant="tonal">
                {{ resultConfig[item.type].icon }}
              </v-chip>
            </template>
          </v-tooltip>
        </div>
      </div>

    </div>
  </ToolShell>
</template>

<style scoped>
.jiaobei-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem;
  user-select: none;
  gap: 1.5rem;
}

.question-field { width: 100%; max-width: 420px; }

/* Stage clips the arc so cups don't overflow the page */
.cups-stage {
  position: relative;
  width: 260px;
  height: 200px;
  overflow: visible;
}

.cups-row {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 2.5rem;
  justify-content: center;
  align-items: flex-end;
}

/* Moon block */
.cup {
  width: 58px;
  height: 96px;
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  background: linear-gradient(145deg, #a0522d, #d2691e 50%, #8b4513);
  box-shadow: 0 6px 18px rgba(0,0,0,.45), inset 0 2px 8px rgba(255,200,120,.25);
  position: relative;
  flex-shrink: 0;
  transition: transform .2s cubic-bezier(.34,1.56,.64,1);
}
.cup::after {
  content: '';
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: 10px; height: 10px;
  border-radius: 50%;
  background: rgba(255,255,255,.4);
}
.cup.face-up   { transform: rotate(0deg); }
.cup.face-down { transform: rotate(180deg); }

/* ── Flying animation — GPU only (transform + opacity) ─────────────── */
.flying-row { pointer-events: none; }

.cup-fly {
  will-change: transform, opacity;
  transform-origin: 50% 100%;
}

/*
  Cup 1 (left): rises toward center-right (+X), grows → peak together
  → then spins & falls back to original X, fades out
*/
@keyframes fly1 {
  0%   { transform: translate3d(  0px,   0px, 0) scale(1.00) rotateZ(  0deg); opacity: 1; }
  20%  { transform: translate3d( 16px, -80px, 0) scale(1.10) rotateZ(  8deg); opacity: 1; }
  40%  { transform: translate3d( 22px,-150px, 0) scale(1.18) rotateZ( 18deg); opacity: 1; }
  62%  { transform: translate3d(  8px,-110px, 0) scale(1.05) rotateZ(-90deg); opacity: 1; }
  82%  { transform: translate3d( -5px, -28px, 0) scale(0.97) rotateZ(-220deg); opacity: .65; }
  100% { transform: translate3d(  0px,   0px, 0) scale(1.00) rotateZ(-300deg); opacity: 0; }
}

/*
  Cup 2 (right): rises toward center-left (-X), grows → peak together
  → then spins & falls back to original X, fades out
*/
@keyframes fly2 {
  0%   { transform: translate3d(  0px,   0px, 0) scale(1.00) rotateZ(  0deg); opacity: 1; }
  20%  { transform: translate3d(-18px, -80px, 0) scale(1.10) rotateZ( -8deg); opacity: 1; }
  40%  { transform: translate3d(-24px,-150px, 0) scale(1.18) rotateZ(-18deg); opacity: 1; }
  62%  { transform: translate3d( -8px,-110px, 0) scale(1.05) rotateZ( 95deg); opacity: 1; }
  82%  { transform: translate3d(  6px, -28px, 0) scale(0.97) rotateZ( 225deg); opacity: .65; }
  100% { transform: translate3d(  0px,   0px, 0) scale(1.00) rotateZ( 300deg); opacity: 0; }
}

.cup-fly-1 { animation: fly1 .82s cubic-bezier(.4,.0,.2,1) forwards; }
.cup-fly-2 { animation: fly2 .82s cubic-bezier(.35,.05,.25,1) forwards; }

.throw-btn { min-width: 140px; font-size: 1.1rem; letter-spacing: .05em; }

.result-block { display: flex; flex-direction: column; align-items: center; gap: .25rem; }
.result-chip  { font-size: 1.1rem; padding: 0 1.25rem; height: 44px; }
.result-icon  { font-size: 1.2rem; }
.result-desc  { text-align: center; opacity: .85; }

.result-fade-enter-active { transition: opacity .4s ease, transform .4s ease; }
.result-fade-enter-from   { opacity: 0; transform: translateY(12px); }

.history-block { display: flex; flex-direction: column; align-items: center; }
.history-icons { display: flex; gap: .5rem; flex-wrap: wrap; justify-content: center; }
</style>
