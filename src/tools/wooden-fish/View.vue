<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import { useAudioContext } from '@/composables/useAudioContext'
import { isBoolean, useStoredRef } from '@/composables/useStoredRef'

const { t } = useI18n()
const audio = useAudioContext()

// ── Merit state ──────────────────────────────────────────────────────────────
const STORAGE_KEY = 'app.wooden-fish.merit'

const sessionMerit = ref(0)
const totalMerit = ref(loadTotalMerit())
const muted = useStoredRef('wooden-fish.muted', false, isBoolean)
const confirmReset = ref(false)

function loadTotalMerit(): number {
  try {
    const n = parseInt(localStorage.getItem(STORAGE_KEY) ?? '0')
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function saveTotalMerit() {
  try {
    localStorage.setItem(STORAGE_KEY, String(totalMerit.value))
  } catch {
    // Storage blocked: the total simply isn't remembered.
  }
}

// ── Floating +1 particles ────────────────────────────────────────────────────
interface Particle {
  id: number
  x: number
}

let nextId = 0
const particles = ref<Particle[]>([])

function spawnParticle(x: number) {
  const id = nextId++
  particles.value.push({ id, x })
  setTimeout(() => {
    particles.value = particles.value.filter((p) => p.id !== id)
  }, 800)
}

// ── Fish strike animation ────────────────────────────────────────────────────
const striking = ref(false)

function strike() {
  striking.value = true
  setTimeout(() => {
    striking.value = false
  }, 150)
}

// ── Web Audio ────────────────────────────────────────────────────────────────
function playKnock(ctx: AudioContext) {
  const times = [0, 0.004]
  for (const dt of times) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(dt === 0 ? 600 : 900, ctx.currentTime + dt)
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + dt + 0.3)
    gain.gain.setValueAtTime(0.4, ctx.currentTime + dt)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dt + 0.35)
    osc.start(ctx.currentTime + dt)
    osc.stop(ctx.currentTime + dt + 0.4)
  }
}

// ── Click handler ────────────────────────────────────────────────────────────
function onFishClick(event: MouseEvent | KeyboardEvent) {
  sessionMerit.value++
  totalMerit.value++
  saveTotalMerit()

  // Spawn the +1 near the click position, relative to the fish center
  // (keyboard activation lands it in the middle).
  let xOffset = 0
  if (event instanceof MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    xOffset = event.clientX - rect.left - rect.width / 2
  }
  spawnParticle(xOffset)

  strike()
  if (!muted.value) audio.play(playKnock)
}

function resetMerit() {
  totalMerit.value = 0
  sessionMerit.value = 0
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  confirmReset.value = false
}
</script>

<template>
  <ToolShell>
    <template #actions>
      <v-btn
        :icon="muted ? 'mdi-volume-off' : 'mdi-volume-high'"
        variant="text"
        :title="muted ? t('tools.wooden-fish.unmute') : t('tools.wooden-fish.mute')"
        :aria-label="muted ? t('tools.wooden-fish.unmute') : t('tools.wooden-fish.mute')"
        :aria-pressed="muted"
        @click="muted = !muted"
      />
    </template>

    <div class="wooden-fish-wrap">
      <!-- Fish -->
      <div class="fish-stage">
        <div
          class="fish"
          :class="{ striking }"
          role="button"
          tabindex="0"
          :aria-label="t('tools.wooden-fish.merit')"
          @click="onFishClick"
          @keydown.enter="onFishClick"
          @keydown.space.prevent="onFishClick"
        >
          <div class="eye" />
        </div>

        <!-- Floating +1 particles -->
        <div
          v-for="p in particles"
          :key="p.id"
          class="particle"
          :style="{ '--x': `${p.x}px` }"
          aria-hidden="true"
        >
          +1
        </div>
      </div>

      <!-- Merit counters -->
      <div class="merit-counters mt-6 tabular-nums">
        <v-chip color="primary" variant="tonal" size="large" class="mr-3">
          {{ t('tools.wooden-fish.session') }}：{{ sessionMerit.toLocaleString() }}
        </v-chip>
        <v-chip color="secondary" variant="tonal" size="large">
          {{ t('tools.wooden-fish.total') }}：{{ totalMerit.toLocaleString() }}
        </v-chip>
      </div>

      <!-- Reset -->
      <div class="mt-4">
        <v-btn
          variant="outlined"
          size="small"
          color="error"
          :disabled="totalMerit === 0 && sessionMerit === 0"
          @click="confirmReset = true"
        >
          {{ t('tools.wooden-fish.reset') }}
        </v-btn>
      </div>
    </div>

    <v-dialog v-model="confirmReset" max-width="420">
      <v-card>
        <v-card-title>{{ t('tools.wooden-fish.reset') }}</v-card-title>
        <v-card-text>{{ t('tools.wooden-fish.confirmReset') }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="confirmReset = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="error" @click="resetMerit">{{ t('common.confirm') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </ToolShell>
</template>

<style scoped>
.wooden-fish-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem;
  user-select: none;
}

/* ── Fish stage: anchors absolute-positioned particles ── */
.fish-stage {
  position: relative;
  width: 180px;
  height: 120px;
}

/* ── CSS-drawn wooden fish ── */
.fish {
  width: 180px;
  height: 120px;
  background: radial-gradient(ellipse at 40% 40%, #c8752a, #7a3a10);
  border-radius: 45% 55% 55% 45% / 40% 40% 60% 60%;
  cursor: pointer;
  position: relative;
  transition: transform 0.1s ease;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  outline: none;
}

.fish:focus-visible {
  box-shadow: 0 0 0 3px rgba(200, 117, 42, 0.6), 0 4px 16px rgba(0, 0, 0, 0.3);
}

.fish.striking {
  transform: scale(0.92) rotate(-3deg);
}

.fish .eye {
  position: absolute;
  top: 30%;
  right: 25%;
  width: 14px;
  height: 14px;
  background: #1a0a00;
  border-radius: 50%;
  box-shadow: 0 0 0 3px #e8a050;
}

/* ── Floating +1 animation ── */
.particle {
  position: absolute;
  /* horizontally centered in fish-stage, then offset by click x */
  left: 50%;
  bottom: 50%;
  transform: translateX(calc(-50% + var(--x, 0px)));
  font-size: 1.4rem;
  font-weight: 700;
  color: #e8a050;
  pointer-events: none;
  animation: float-up 0.8s ease-out forwards;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

@keyframes float-up {
  0% {
    opacity: 1;
    transform: translateX(calc(-50% + var(--x, 0px))) translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateX(calc(-50% + var(--x, 0px))) translateY(-80px);
  }
}

/* ── Merit counters ── */
.merit-counters {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
}
</style>
