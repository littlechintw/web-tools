<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'

const { t } = useI18n()

// ── Merit state ──────────────────────────────────────────────────────────────
const STORAGE_KEY = 'app.wooden-fish.merit'

const sessionMerit = ref(0)
const totalMerit = ref(parseInt(localStorage.getItem(STORAGE_KEY) ?? '0'))

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

// ── Web Audio API (lazy init) ────────────────────────────────────────────────
let audioCtx: AudioContext | null = null

function playKnock() {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!audioCtx) audioCtx = new Ctor()
    const ctx = audioCtx

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
  } catch {
    /* audio not available */
  }
}

// ── Click handler ────────────────────────────────────────────────────────────
function onFishClick(event: MouseEvent) {
  sessionMerit.value++
  totalMerit.value++
  localStorage.setItem(STORAGE_KEY, String(totalMerit.value))

  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  // Spawn the +1 near the click position, relative to the fish center
  const xOffset = event.clientX - rect.left - rect.width / 2
  spawnParticle(xOffset)

  strike()
  playKnock()
}

function resetMerit() {
  totalMerit.value = 0
  sessionMerit.value = 0
  localStorage.removeItem(STORAGE_KEY)
}

onUnmounted(() => {
  if (audioCtx) {
    audioCtx.close().catch(() => {})
    audioCtx = null
  }
})
</script>

<template>
  <ToolShell>
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
          @keydown.enter="onFishClick($event as unknown as MouseEvent)"
          @keydown.space.prevent="onFishClick($event as unknown as MouseEvent)"
        >
          <div class="eye" />
        </div>

        <!-- Floating +1 particles -->
        <div
          v-for="p in particles"
          :key="p.id"
          class="particle"
          :style="{ '--x': `${p.x}px` }"
        >
          +1
        </div>
      </div>

      <!-- Merit counters -->
      <div class="merit-counters mt-6">
        <v-chip color="primary" variant="tonal" size="large" class="mr-3">
          {{ t('tools.wooden-fish.session') }}：{{ sessionMerit.toLocaleString() }}
        </v-chip>
        <v-chip color="secondary" variant="tonal" size="large">
          {{ t('tools.wooden-fish.total') }}：{{ totalMerit.toLocaleString() }}
        </v-chip>
      </div>

      <!-- Reset -->
      <div class="mt-4">
        <v-btn variant="outlined" size="small" color="error" @click="resetMerit">
          {{ t('tools.wooden-fish.reset') }}
        </v-btn>
      </div>
    </div>
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
