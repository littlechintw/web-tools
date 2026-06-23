<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// ── Canvas ref ────────────────────────────────────────────────────────────────
const canvasRef = ref<HTMLCanvasElement | null>(null)

// ── State ─────────────────────────────────────────────────────────────────────
const burnedCount = ref(0)
const muted = ref(false)

// ── Web Audio ─────────────────────────────────────────────────────────────────
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

function crackle(ctx: AudioContext) {
  const bufLen = ctx.sampleRate * 0.15
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
  const data = buf.getChannelData(0)
  let v = 0
  for (let i = 0; i < bufLen; i++) {
    v = v * 0.95 + (Math.random() - 0.5) * 0.05
    if (Math.random() < 0.01) v += (Math.random() - 0.5) * 0.8
    data[i] = v
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  const gain = ctx.createGain()
  gain.gain.value = 0.4
  src.connect(gain)
  gain.connect(ctx.destination)
  src.start()
}

function playSound() {
  if (muted.value) return
  try {
    crackle(getAudioCtx())
  } catch {
    /* audio unavailable */
  }
}

// ── Particle system ───────────────────────────────────────────────────────────
interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number      // 0..1, starts at 1 decreases
  maxLife: number   // raw frame count
  age: number       // frames elapsed
  size: number
  r: number
  g: number
  b: number
}

interface JossPaper {
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotationSpeed: number
  width: number
  height: number
  life: number      // 0..1, start 1
  age: number
  maxAge: number
  burnProgress: number // 0..1
}

const particles: Particle[] = []
const papers: JossPaper[] = []

function spawnFireParticle(x: number, y: number, intensity = 1) {
  const count = Math.floor(2 + Math.random() * 3 * intensity)
  for (let i = 0; i < count; i++) {
    // Colour: cycle through yellow->orange->red as life decays
    const hot = Math.random()
    particles.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y + Math.random() * 5,
      vx: (Math.random() - 0.5) * 1.2,
      vy: -(1.5 + Math.random() * 2.5) * intensity,
      life: 1,
      maxLife: 40 + Math.random() * 40,
      age: 0,
      size: 3 + Math.random() * 5 * intensity,
      r: hot > 0.5 ? 255 : 200 + Math.floor(Math.random() * 55),
      g: hot > 0.5 ? 180 + Math.floor(Math.random() * 75) : 80 + Math.floor(Math.random() * 80),
      b: 0,
    })
  }
}

function spawnEmbers(x: number, y: number) {
  for (let i = 0; i < 6; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 30,
      y,
      vx: (Math.random() - 0.5) * 3,
      vy: -(0.5 + Math.random() * 2),
      life: 1,
      maxLife: 60 + Math.random() * 60,
      age: 0,
      size: 1 + Math.random() * 2,
      r: 255,
      g: 120 + Math.floor(Math.random() * 80),
      b: 0,
    })
  }
}

function addPaper(cx: number, cy: number) {
  const w = 36 + Math.random() * 20
  const h = 48 + Math.random() * 20
  papers.push({
    x: cx + (Math.random() - 0.5) * 60,
    y: cy - Math.random() * 30,
    vx: (Math.random() - 0.5) * 1.5,
    vy: 0.5 + Math.random() * 1,
    rotation: (Math.random() - 0.5) * 0.8,
    rotationSpeed: (Math.random() - 0.5) * 0.06,
    width: w,
    height: h,
    life: 1,
    age: 0,
    maxAge: 120 + Math.random() * 80,
    burnProgress: 0,
  })
  burnedCount.value++
  playSound()
}

// ── Continuous base fire ───────────────────────────────────────────────────────
let frameId: number | null = null
let lastTime = 0

function tick(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, now: number) {
  const dt = Math.min((now - lastTime) / 16.67, 3) // normalize to ~60fps
  lastTime = now

  const W = canvas.width
  const H = canvas.height
  const fireBaseY = H - 60
  const fireBaseX = W / 2

  // Fade background (trail effect)
  ctx.fillStyle = 'rgba(10, 5, 0, 0.35)'
  ctx.fillRect(0, 0, W, H)

  // Spawn base fire particles continuously
  const baseCount = Math.floor(4 * dt)
  for (let i = 0; i < baseCount; i++) {
    const spread = 60
    spawnFireParticle(fireBaseX + (Math.random() - 0.5) * spread * 2, fireBaseY, 1.2)
  }

  // Update & draw particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.age += dt
    p.life = 1 - p.age / p.maxLife

    if (p.life <= 0) {
      particles.splice(i, 1)
      continue
    }

    p.x += p.vx * dt
    p.vy *= 0.995
    p.vx += (Math.random() - 0.5) * 0.15 * dt  // flicker
    p.y += p.vy * dt

    const t = 1 - p.life
    // Color transitions: yellow -> orange -> red -> dark red
    const r = Math.min(255, p.r)
    const g = Math.max(0, p.g * (1 - t * 0.9))
    const b = p.b
    const alpha = p.life * (t < 0.2 ? t / 0.2 : 1)  // fade in briefly then hold

    const sz = p.size * p.life
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(0.5, sz), 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha.toFixed(2)})`
    ctx.fill()
  }

  // Update & draw joss papers
  for (let i = papers.length - 1; i >= 0; i--) {
    const paper = papers[i]
    paper.age += dt
    paper.life = 1 - paper.age / paper.maxAge
    paper.burnProgress = paper.age / paper.maxAge

    if (paper.life <= 0) {
      // Spawn final burst of embers/particles
      spawnEmbers(paper.x, paper.y)
      papers.splice(i, 1)
      continue
    }

    // Float toward fire base
    paper.vy += 0.04 * dt
    paper.x += paper.vx * dt
    paper.y += paper.vy * dt
    paper.rotation += paper.rotationSpeed * dt
    paper.vx += (Math.random() - 0.5) * 0.05 * dt

    // Clamp to canvas
    if (paper.y > fireBaseY - 10) {
      paper.y = fireBaseY - 10
      paper.vy *= -0.3
    }

    // Spawn fire from burning paper
    if (paper.burnProgress > 0.15) {
      const intensity = paper.burnProgress
      if (Math.random() < 0.4 * intensity * dt) {
        spawnFireParticle(paper.x, paper.y - paper.height * 0.3, intensity * 0.8)
      }
    }

    // Draw paper
    ctx.save()
    ctx.translate(paper.x, paper.y)
    ctx.rotate(paper.rotation)

    const bp = paper.burnProgress
    const w = paper.width * (1 - bp * 0.6)
    const h = paper.height * (1 - bp * 0.7)

    // Paper color: gold/yellow -> dark brown/black as it burns
    const goldR = Math.round(220 - bp * 180)
    const goldG = Math.round(180 - bp * 160)
    const goldB = Math.round(50 - bp * 45)
    const alpha = Math.min(1, paper.life * 2)

    // Main paper body
    ctx.globalAlpha = alpha
    ctx.fillStyle = `rgb(${goldR},${goldG},${goldB})`
    ctx.fillRect(-w / 2, -h / 2, w, h)

    // Golden shimmer lines on the paper
    if (bp < 0.5) {
      const lineAlpha = (1 - bp * 2) * 0.4
      ctx.globalAlpha = lineAlpha * alpha
      ctx.strokeStyle = `rgba(255, 220, 80, 0.8)`
      ctx.lineWidth = 1
      // Horizontal gold lines (decorative)
      for (let li = 1; li < 4; li++) {
        const ly = -h / 2 + (h / 4) * li
        ctx.beginPath()
        ctx.moveTo(-w / 2 + 4, ly)
        ctx.lineTo(w / 2 - 4, ly)
        ctx.stroke()
      }
      // Center circle motif
      ctx.globalAlpha = lineAlpha * 0.6 * alpha
      ctx.beginPath()
      ctx.arc(0, 0, Math.min(w, h) * 0.2, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,200,50,0.9)'
      ctx.stroke()
    }

    // Burn edge glow
    if (bp > 0.05) {
      const glowAlpha = Math.min(1, bp * 2) * 0.6 * alpha
      ctx.globalAlpha = glowAlpha
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) * 0.7)
      gradient.addColorStop(0, 'rgba(255, 140, 0, 0)')
      gradient.addColorStop(0.7, 'rgba(255, 60, 0, 0.3)')
      gradient.addColorStop(1, 'rgba(200, 20, 0, 0.5)')
      ctx.fillStyle = gradient
      ctx.fillRect(-w / 2, -h / 2, w, h)
    }

    ctx.globalAlpha = 1
    ctx.restore()
  }

  // Draw glowing fire base (ground glow)
  const glowGrad = ctx.createRadialGradient(fireBaseX, fireBaseY + 20, 5, fireBaseX, fireBaseY + 20, 120)
  glowGrad.addColorStop(0, 'rgba(255, 180, 40, 0.25)')
  glowGrad.addColorStop(0.5, 'rgba(255, 80, 10, 0.1)')
  glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = glowGrad
  ctx.fillRect(fireBaseX - 120, fireBaseY - 40, 240, 100)

  frameId = requestAnimationFrame((t) => tick(canvas, ctx, t))
}

// ── Mouse/touch hold to burn ───────────────────────────────────────────────────
let holdInterval: ReturnType<typeof setInterval> | null = null
let isHolding = false

function onCanvasPointerDown(e: PointerEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  isHolding = true
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const cx = (e.clientX - rect.left) * scaleX
  const cy = (e.clientY - rect.top) * scaleY
  addPaper(cx, cy)
  holdInterval = setInterval(() => {
    if (!isHolding) return
    addPaper(cx + (Math.random() - 0.5) * 40, cy + (Math.random() - 0.5) * 20)
  }, 300)
}

function onCanvasPointerUp() {
  isHolding = false
  if (holdInterval !== null) {
    clearInterval(holdInterval)
    holdInterval = null
  }
}

// ── Burn button ───────────────────────────────────────────────────────────────
function burnOne() {
  const canvas = canvasRef.value
  if (!canvas) return
  const cx = canvas.width / 2 + (Math.random() - 0.5) * 80
  const cy = canvas.height - 120 - Math.random() * 80
  addPaper(cx, cy)
}

// ── Reset ─────────────────────────────────────────────────────────────────────
function reset() {
  papers.length = 0
  particles.length = 0
  burnedCount.value = 0
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Set canvas resolution to match display size
  function resize() {
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx!.scale(window.devicePixelRatio, window.devicePixelRatio)
    // Re-apply scale on every resize — we track logical pixels internally
    canvas.width = rect.width
    canvas.height = rect.height
  }
  resize()

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas)

  lastTime = performance.now()
  frameId = requestAnimationFrame((t) => tick(canvas, ctx, t))

  // Cleanup observer on unmount via closure
  ;(canvas as HTMLCanvasElement & { _ro?: ResizeObserver })._ro = resizeObserver
})

onUnmounted(() => {
  if (frameId !== null) {
    cancelAnimationFrame(frameId)
    frameId = null
  }
  if (holdInterval !== null) {
    clearInterval(holdInterval)
    holdInterval = null
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {})
    audioCtx = null
  }
  const canvas = canvasRef.value
  if (canvas) {
    const ro = (canvas as HTMLCanvasElement & { _ro?: ResizeObserver })._ro
    ro?.disconnect()
  }
  papers.length = 0
  particles.length = 0
})
</script>

<template>
  <v-container class="pa-4" style="max-width: 900px">
    <!-- Controls row -->
    <div class="d-flex align-center justify-space-between flex-wrap gap-2 mb-3">
      <!-- Merit counter -->
      <div class="d-flex align-center gap-2">
        <v-icon color="amber" size="20">mdi-fire</v-icon>
        <span class="text-body-1">
          <span class="font-weight-bold text-amber">{{ t('tools.joss-paper.burned') }}</span>
          <span class="text-medium-emphasis mx-1">{{ burnedCount.toLocaleString() }}</span>
          <span class="text-medium-emphasis">{{ t('tools.joss-paper.sheets') }}</span>
        </span>
      </div>

      <!-- Buttons -->
      <div class="d-flex gap-2 flex-wrap">
        <v-btn
          size="small"
          variant="tonal"
          color="amber"
          prepend-icon="mdi-fire"
          @click="burnOne"
        >
          {{ t('tools.joss-paper.burn') }}
        </v-btn>
        <v-btn
          size="small"
          variant="tonal"
          :color="muted ? 'grey' : 'orange'"
          :prepend-icon="muted ? 'mdi-volume-off' : 'mdi-volume-high'"
          @click="muted = !muted"
        >
          {{ muted ? t('tools.joss-paper.mute') : t('tools.joss-paper.sound') }}
        </v-btn>
        <v-btn
          size="small"
          variant="outlined"
          color="error"
          prepend-icon="mdi-refresh"
          @click="reset"
        >
          {{ t('tools.joss-paper.reset') }}
        </v-btn>
      </div>
    </div>

    <!-- Canvas -->
    <div class="canvas-wrap">
      <canvas
        ref="canvasRef"
        class="fire-canvas"
        @pointerdown="onCanvasPointerDown"
        @pointerup="onCanvasPointerUp"
        @pointerleave="onCanvasPointerUp"
        @pointercancel="onCanvasPointerUp"
      />
      <!-- Hint overlay shown when no papers burned yet -->
      <Transition name="hint-fade">
        <div v-if="burnedCount === 0" class="hint-overlay">
          <v-icon color="amber-lighten-2" size="32">mdi-gesture-tap</v-icon>
          <p class="text-amber-lighten-2 mt-2 text-body-2">
            {{ t('tools.joss-paper.burn') }} · Click / Hold
          </p>
        </div>
      </Transition>
    </div>
  </v-container>
</template>

<style scoped>
.canvas-wrap {
  position: relative;
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  background: #0a0500;
  box-shadow:
    0 0 40px rgba(255, 100, 0, 0.15),
    0 4px 24px rgba(0, 0, 0, 0.6);
}

.fire-canvas {
  display: block;
  width: 100%;
  height: 460px;
  cursor: crosshair;
  touch-action: none;
}

.hint-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  user-select: none;
}

/* Fade out the hint */
.hint-fade-leave-active {
  transition: opacity 0.8s ease;
}
.hint-fade-leave-to {
  opacity: 0;
}
</style>
