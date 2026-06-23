<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// ---- constants ----
const TOTAL = 24

// Color palette cycling through hue spectrum
const PALETTE = [
  { h: 4,   name: 'red'    },
  { h: 24,  name: 'orange' },
  { h: 44,  name: 'yellow' },
  { h: 142, name: 'green'  },
  { h: 187, name: 'cyan'   },
  { h: 217, name: 'blue'   },
  { h: 265, name: 'purple' },
  { h: 330, name: 'pink'   },
]

function getColor(index: number) {
  return PALETTE[index % PALETTE.length]
}

// ---- state ----
const states = ref<boolean[]>(Array(TOTAL).fill(false))

const onCount = computed(() => states.value.filter(Boolean).length)

// ---- labels ----
const labels = computed<string[]>(() =>
  Array.from({ length: TOTAL }, (_, i) =>
    t(`tools.satisfying-switch.labels[${i}]`),
  ),
)

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

function switchClick(ctx: AudioContext, on: boolean) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    const tSec = i / ctx.sampleRate
    data[i] = Math.sin(2 * Math.PI * (on ? 2000 : 800) * tSec) * Math.exp(-tSec * 80) * 0.5
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.connect(ctx.destination)
  src.start()
}

// ---- interactions ----
function toggle(index: number) {
  states.value[index] = !states.value[index]
  try {
    switchClick(getAudioCtx(), states.value[index])
  } catch {
    /* audio unavailable */
  }
}

function allOn() {
  states.value = Array(TOTAL).fill(true)
  try {
    switchClick(getAudioCtx(), true)
  } catch {
    /* audio unavailable */
  }
}

function allOff() {
  states.value = Array(TOTAL).fill(false)
  try {
    switchClick(getAudioCtx(), false)
  } catch {
    /* audio unavailable */
  }
}

function randomize() {
  states.value = Array.from({ length: TOTAL }, () => Math.random() > 0.5)
  try {
    switchClick(getAudioCtx(), Math.random() > 0.5)
  } catch {
    /* audio unavailable */
  }
}
</script>

<template>
  <v-container class="pa-4 panel-bg" style="max-width: 900px">
    <!-- Header bar -->
    <div class="d-flex align-center justify-space-between flex-wrap gap-3 mb-6">
      <div class="counter-display">
        {{ t('tools.satisfying-switch.onCount', { on: onCount, total: TOTAL }) }}
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <button class="ctrl-btn ctrl-btn--on" @click="allOn">
          {{ t('tools.satisfying-switch.allOn') }}
        </button>
        <button class="ctrl-btn ctrl-btn--off" @click="allOff">
          {{ t('tools.satisfying-switch.allOff') }}
        </button>
        <button class="ctrl-btn ctrl-btn--random" @click="randomize">
          {{ t('tools.satisfying-switch.random') }}
        </button>
      </div>
    </div>

    <!-- Switch grid -->
    <div class="switch-grid">
      <div
        v-for="(on, i) in states"
        :key="i"
        class="switch-cell"
        :class="{ 'switch-cell--on': on }"
        :style="{
          '--h': getColor(i).h,
        }"
        role="button"
        :aria-pressed="on"
        :aria-label="labels[i]"
        tabindex="0"
        @click="toggle(i)"
        @keydown.enter.prevent="toggle(i)"
        @keydown.space.prevent="toggle(i)"
      >
        <!-- Panel housing -->
        <div class="switch-housing">
          <!-- Indicator LED -->
          <div class="switch-led" />

          <!-- Toggle lever -->
          <div class="switch-lever-wrap">
            <div class="switch-lever">
              <div class="switch-lever-knob" />
            </div>
          </div>

          <!-- Label -->
          <div class="switch-label">{{ labels[i] }}</div>
        </div>
      </div>
    </div>

    <!-- Bottom bar — all-on celebration -->
    <div v-if="onCount === TOTAL" class="celebration mt-5">
      <span>⚡</span>
      <span class="celebration-text">{{ t('tools.satisfying-switch.allOn') }}!</span>
      <span>⚡</span>
    </div>
  </v-container>
</template>

<style scoped>
/* ── Panel background ────────────────────────────────────────────── */
.panel-bg {
  background: #1a1e2a;
  border-radius: 16px;
  min-height: 400px;
}

/* ── Counter display ─────────────────────────────────────────────── */
.counter-display {
  font-family: 'Courier New', monospace;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #7dffd0;
  text-shadow: 0 0 12px #7dffd055;
}

/* ── Control buttons ─────────────────────────────────────────────── */
.ctrl-btn {
  padding: 6px 18px;
  border-radius: 6px;
  border: 1.5px solid #3a4060;
  background: #252a3a;
  color: #c0c8dc;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
  -webkit-tap-highlight-color: transparent;
}
.ctrl-btn:hover {
  background: #2e3450;
  border-color: #5a6090;
}
.ctrl-btn:active {
  transform: scale(0.94);
}
.ctrl-btn--on {
  border-color: #3a8a50;
  color: #7dffd0;
}
.ctrl-btn--on:hover {
  background: #1e3a28;
}
.ctrl-btn--off {
  border-color: #6a3040;
  color: #ffaab0;
}
.ctrl-btn--off:hover {
  background: #2e1a1e;
}
.ctrl-btn--random {
  border-color: #4a5090;
  color: #aac0ff;
}
.ctrl-btn--random:hover {
  background: #22283e;
}

/* ── Switch grid ─────────────────────────────────────────────────── */
.switch-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
}

@media (max-width: 700px) {
  .switch-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
}

@media (max-width: 480px) {
  .switch-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
}

/* ── Switch cell ─────────────────────────────────────────────────── */
.switch-cell {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  outline: none;
  border-radius: 10px;
  transition: transform 0.1s;
}
.switch-cell:active {
  transform: scale(0.92);
}
.switch-cell:focus-visible .switch-housing {
  box-shadow:
    0 0 0 2px #fff4,
    0 2px 8px #0008;
}

/* ── Switch housing (the panel) ──────────────────────────────────── */
.switch-housing {
  background: linear-gradient(160deg, #282e40 0%, #1c2030 100%);
  border: 1.5px solid #33394e;
  border-radius: 10px;
  padding: 10px 8px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    background 0.2s;
  position: relative;
  overflow: hidden;
}

/* OFF → ON: housing glow */
.switch-cell--on .switch-housing {
  background: linear-gradient(
    160deg,
    hsl(var(--h), 70%, 16%) 0%,
    hsl(var(--h), 60%, 10%) 100%
  );
  border-color: hsl(var(--h), 80%, 50%);
  box-shadow:
    0 0 14px hsl(var(--h), 90%, 50%, 0.45),
    inset 0 0 12px hsl(var(--h), 90%, 50%, 0.12);
}

/* ── LED indicator ───────────────────────────────────────────────── */
.switch-led {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2a3040;
  border: 1.5px solid #3a4050;
  transition: background 0.2s, box-shadow 0.2s, border-color 0.2s;
  align-self: flex-end;
  margin-right: 2px;
}
.switch-cell--on .switch-led {
  background: hsl(var(--h), 90%, 65%);
  border-color: hsl(var(--h), 90%, 70%);
  box-shadow:
    0 0 6px hsl(var(--h), 90%, 65%),
    0 0 12px hsl(var(--h), 90%, 50%);
}

/* ── Toggle lever ────────────────────────────────────────────────── */
.switch-lever-wrap {
  width: 36px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.switch-lever {
  width: 22px;
  height: 52px;
  background: linear-gradient(180deg, #3a404e 0%, #2a2e3a 100%);
  border-radius: 11px;
  border: 1.5px solid #4a5060;
  position: relative;
  transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
  box-shadow: inset 0 2px 4px #00000050;
}

.switch-cell--on .switch-lever {
  background: linear-gradient(
    180deg,
    hsl(var(--h), 80%, 38%) 0%,
    hsl(var(--h), 70%, 25%) 100%
  );
  border-color: hsl(var(--h), 80%, 55%);
  box-shadow:
    inset 0 2px 4px #00000050,
    0 0 8px hsl(var(--h), 90%, 50%, 0.5);
}

.switch-lever-knob {
  position: absolute;
  left: 50%;
  width: 18px;
  height: 22px;
  background: linear-gradient(160deg, #bcc0cc 0%, #8890a0 100%);
  border-radius: 8px;
  border: 1.5px solid #ccd0dc;
  transform: translateX(-50%);
  box-shadow:
    0 2px 6px #00000060,
    inset 0 1px 2px #ffffff30;
  transition: top 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s, border-color 0.2s;

  /* OFF position — knob at bottom */
  top: calc(100% - 24px);
}

.switch-cell--on .switch-lever-knob {
  /* ON position — knob at top */
  top: 2px;
  background: linear-gradient(160deg, #e8f0ff 0%, #c0ccee 100%);
  border-color: hsl(var(--h), 60%, 80%);
}

/* ── Label ───────────────────────────────────────────────────────── */
.switch-label {
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #667;
  text-align: center;
  line-height: 1.2;
  min-height: 1.4em;
  transition: color 0.2s;
  word-break: break-word;
  max-width: 100%;
}
.switch-cell--on .switch-label {
  color: hsl(var(--h), 70%, 72%);
}

/* ── Celebration bar ─────────────────────────────────────────────── */
.celebration {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 1.4rem;
  color: #ffd060;
  animation: pulse 1.2s ease-in-out infinite;
}
.celebration-text {
  font-weight: 700;
  letter-spacing: 0.1em;
  text-shadow: 0 0 16px #ffd060aa;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
</style>
