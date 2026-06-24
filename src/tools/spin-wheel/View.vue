<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'

const { t } = useI18n()

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

interface WheelItem {
  id: number
  label: string
  weight: number
  color: string
}

const PALETTE = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#1abc9c', '#3498db', '#9b59b6', '#e91e63',
  '#ff5722', '#00bcd4', '#8bc34a', '#ff9800',
]

let nextId = 4

function colorFor(index: number): string {
  return PALETTE[index % PALETTE.length]
}

const items = ref<WheelItem[]>([
  { id: 1, label: '選項 A', weight: 1, color: colorFor(0) },
  { id: 2, label: '選項 B', weight: 1, color: colorFor(1) },
  { id: 3, label: '選項 C', weight: 1, color: colorFor(2) },
])

function addItem() {
  if (items.value.length >= 20) return
  const idx = items.value.length
  items.value.push({ id: nextId++, label: `選項 ${String.fromCharCode(65 + idx)}`, weight: 1, color: colorFor(idx) })
}

function removeItem(id: number) {
  if (items.value.length <= 1) return
  items.value = items.value.filter(i => i.id !== id)
  // Reassign colors so they stay consistent with position
  items.value.forEach((item, idx) => { item.color = colorFor(idx) })
}

function equalWeights() {
  items.value.forEach(i => { i.weight = 1 })
}

function clampWeight(item: WheelItem) {
  const v = Number(item.weight)
  item.weight = isNaN(v) ? 1 : Math.max(1, Math.min(100, Math.round(v)))
}

const totalWeight = computed(() => items.value.reduce((s, i) => s + i.weight, 0))

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const canvasSize = ref(400)

function drawWheel(canvas: HTMLCanvasElement, wheelItems: WheelItem[], angle: number) {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  const cx = w / 2
  const cy = h / 2
  const r = Math.min(cx, cy) - 20
  const total = wheelItems.reduce((s, i) => s + i.weight, 0)

  let startAngle = angle
  for (const item of wheelItems) {
    const slice = (item.weight / total) * 2 * Math.PI

    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, startAngle, startAngle + slice)
    ctx.closePath()
    ctx.fillStyle = item.color
    ctx.fill()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.stroke()

    // Label
    const midAngle = startAngle + slice / 2
    const labelR = r * 0.65
    const lx = cx + Math.cos(midAngle) * labelR
    const ly = cy + Math.sin(midAngle) * labelR
    ctx.save()
    ctx.translate(lx, ly)
    ctx.rotate(midAngle + Math.PI / 2)
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${Math.min(14, 100 / wheelItems.length + 8)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const maxLen = 8
    const text = item.label.length > maxLen ? item.label.slice(0, maxLen) + '…' : item.label
    ctx.fillText(text, 0, 0)
    ctx.restore()

    startAngle += slice
  }

  // Center circle
  ctx.beginPath()
  ctx.arc(cx, cy, 18, 0, 2 * Math.PI)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.strokeStyle = '#ddd'
  ctx.lineWidth = 2
  ctx.stroke()
}

function redraw() {
  const canvas = canvasRef.value
  if (canvas) drawWheel(canvas, items.value, currentAngle.value)
}

// Redraw when items change (label, weight, color) while not spinning
watch(items, redraw, { deep: true })

// ---------------------------------------------------------------------------
// ResizeObserver
// ---------------------------------------------------------------------------

let ro: ResizeObserver | null = null

onMounted(() => {
  if (containerRef.value) {
    ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      canvasSize.value = Math.min(400, Math.max(200, w))
      const canvas = canvasRef.value
      if (canvas) {
        canvas.width = canvasSize.value
        canvas.height = canvasSize.value
        redraw()
      }
    })
    ro.observe(containerRef.value)
  }
  const canvas = canvasRef.value
  if (canvas) {
    canvas.width = canvasSize.value
    canvas.height = canvasSize.value
    redraw()
  }
})

// ---------------------------------------------------------------------------
// Spin animation
// ---------------------------------------------------------------------------

const currentAngle = ref(0)
const spinning = ref(false)
const winner = ref<string | null>(null)
let rafId = 0

// Audio
let audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

function playSpinSound(ctx: AudioContext, duration: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(40, ctx.currentTime)
  osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + duration * 0.4)
  osc.frequency.linearRampToValueAtTime(20, ctx.currentTime + duration)
  gain.gain.setValueAtTime(0.08, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + duration * 0.3)
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration)
  osc.start()
  osc.stop(ctx.currentTime + duration)
}

function playTick(ctx: AudioContext) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(800, ctx.currentTime)
  gain.gain.setValueAtTime(0.15, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.04)
  osc.start()
  osc.stop(ctx.currentTime + 0.04)
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

// Track which segment the pointer is currently in for tick sounds
function getSegmentAtAngle(angle: number, wheelItems: WheelItem[]): number {
  const total = wheelItems.reduce((s, i) => s + i.weight, 0)
  // Pointer is at -π/2 (top). Normalize the angle relative to -π/2
  let a = ((-Math.PI / 2 - angle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
  let cumAngle = 0
  for (let i = 0; i < wheelItems.length; i++) {
    cumAngle += (wheelItems[i].weight / total) * 2 * Math.PI
    if (a < cumAngle) return i
  }
  return wheelItems.length - 1
}

function spin() {
  if (spinning.value) return
  spinning.value = true
  winner.value = null

  // Weighted random pick
  const total = items.value.reduce((s, i) => s + i.weight, 0)
  let rand = Math.random() * total
  let targetIndex = items.value.length - 1
  for (let i = 0; i < items.value.length; i++) {
    rand -= items.value[i].weight
    if (rand <= 0) { targetIndex = i; break }
  }

  // Calculate target angle so the center of targetIndex's segment is under the pointer (top = -π/2)
  const total2 = items.value.reduce((s, i) => s + i.weight, 0)
  let cumAngle = 0
  for (let i = 0; i < targetIndex; i++) {
    cumAngle += (items.value[i].weight / total2) * 2 * Math.PI
  }
  const segHalf = (items.value[targetIndex].weight / total2) * Math.PI
  const segMid = cumAngle + segHalf

  // We want: startAngle + segMid ≡ -π/2 (mod 2π)
  // => finalAngle = -π/2 - segMid + 2π * k
  const spins = 5 + Math.floor(Math.random() * 4)
  // targetAngle relative to 0 reference
  const targetAngle = -Math.PI / 2 - segMid

  // How much to add to currentAngle: add enough full rotations so we always go forward
  const startA = currentAngle.value
  // We want finalAngle = startA + delta, where delta > 0 and finalAngle ≡ targetAngle (mod 2π)
  // delta = targetAngle - startA + 2π * k, pick k so delta > 2π * spins
  const base = targetAngle - startA
  const k = Math.ceil((2 * Math.PI * spins - base) / (2 * Math.PI))
  const finalAngle = startA + base + 2 * Math.PI * k

  const duration = 3000 + Math.random() * 1000
  const startTime = performance.now()

  let lastSegment = getSegmentAtAngle(startA, items.value)

  let ac: AudioContext | null = null
  try {
    ac = getAudioCtx()
    if (ac.state === 'suspended') ac.resume()
    playSpinSound(ac, duration / 1000)
  } catch {
    // Audio not available
  }

  function frame(now: number) {
    const elapsed = now - startTime
    const t = Math.min(elapsed / duration, 1)
    currentAngle.value = startA + (finalAngle - startA) * easeOut(t)

    // Tick sound on segment boundary crossing
    if (ac) {
      const seg = getSegmentAtAngle(currentAngle.value, items.value)
      if (seg !== lastSegment) {
        try { playTick(ac) } catch { /* ignore */ }
        lastSegment = seg
      }
    }

    const canvas = canvasRef.value
    if (canvas) drawWheel(canvas, items.value, currentAngle.value)

    if (t < 1) {
      rafId = requestAnimationFrame(frame)
    } else {
      spinning.value = false
      winner.value = items.value[targetIndex].label
    }
  }

  rafId = requestAnimationFrame(frame)
}

onUnmounted(() => {
  cancelAnimationFrame(rafId)
  if (audioCtx) {
    audioCtx.close()
    audioCtx = null
  }
  if (ro) ro.disconnect()
})
</script>

<template>
  <ToolShell>
    <div class="spin-wheel-layout">
      <!-- Left column: controls -->
      <div class="spin-wheel-controls">
        <div class="text-subtitle-1 font-weight-bold mb-3">{{ t('tools.spin-wheel.options') }}</div>

        <div class="items-list mb-3">
          <div
            v-for="item in items"
            :key="item.id"
            class="item-row mb-2"
          >
            <div class="color-swatch" :style="{ background: item.color }" />
            <v-text-field
              v-model="item.label"
              :label="t('tools.spin-wheel.label')"
              density="compact"
              variant="outlined"
              hide-details
              class="label-field"
            />
            <v-text-field
              v-model.number="item.weight"
              :label="t('tools.spin-wheel.weight')"
              type="number"
              min="1"
              max="100"
              density="compact"
              variant="outlined"
              hide-details
              class="weight-field"
              @blur="clampWeight(item)"
            />
            <v-btn
              icon
              variant="text"
              size="small"
              :disabled="items.length <= 1 || spinning"
              :title="t('tools.spin-wheel.removeOption')"
              @click="removeItem(item.id)"
            >
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </div>
        </div>

        <div class="d-flex ga-2 mb-4 flex-wrap">
          <v-btn
            variant="tonal"
            color="primary"
            prepend-icon="mdi-plus"
            :disabled="items.length >= 20 || spinning"
            @click="addItem"
          >
            {{ t('tools.spin-wheel.addOption') }}
          </v-btn>
          <v-btn
            variant="outlined"
            prepend-icon="mdi-equal"
            :disabled="spinning"
            @click="equalWeights"
          >
            {{ t('tools.spin-wheel.equalWeights') }}
          </v-btn>
        </div>

        <!-- Weight distribution -->
        <div class="text-subtitle-2 font-weight-bold mb-2">{{ t('tools.spin-wheel.weightDistribution') }}</div>
        <div class="weight-dist mb-2">
          <div
            v-for="item in items"
            :key="item.id"
            class="weight-row mb-1"
          >
            <div class="weight-label text-body-2 text-truncate">{{ item.label }}</div>
            <div class="weight-bar-track">
              <div
                class="weight-bar-fill"
                :style="{ width: (item.weight / totalWeight * 100) + '%', background: item.color }"
              />
            </div>
            <div class="weight-pct text-body-2 text-no-wrap">
              {{ Math.round(item.weight / totalWeight * 100) }}%
            </div>
          </div>
        </div>
        <div class="text-caption text-medium-emphasis">
          {{ t('tools.spin-wheel.totalWeight') }}: {{ totalWeight }}
        </div>
      </div>

      <!-- Right column: wheel -->
      <div class="spin-wheel-canvas-col">
        <div ref="containerRef" class="canvas-wrapper">
          <div class="pointer" />
          <canvas ref="canvasRef" class="wheel-canvas" />
        </div>

        <div class="mt-3 d-flex flex-column align-center ga-3">
          <v-btn
            color="primary"
            size="large"
            :loading="spinning"
            :disabled="items.length < 2"
            prepend-icon="mdi-autorenew"
            @click="spin"
          >
            {{ spinning ? t('tools.spin-wheel.spinning') : t('tools.spin-wheel.spin') }}
          </v-btn>

          <v-chip
            v-if="winner"
            color="success"
            size="large"
            variant="elevated"
            prepend-icon="mdi-trophy"
            class="winner-chip"
          >
            <span class="font-weight-bold">{{ t('tools.spin-wheel.winner') }}: {{ winner }}</span>
          </v-chip>
        </div>
      </div>
    </div>
  </ToolShell>
</template>

<style scoped>
.spin-wheel-layout {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: flex-start;
}

.spin-wheel-controls {
  flex: 1 1 280px;
  min-width: 260px;
}

.spin-wheel-canvas-col {
  flex: 0 1 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.canvas-wrapper {
  position: relative;
  width: 100%;
  max-width: 400px;
}

.wheel-canvas {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 50%;
}

.pointer {
  width: 0;
  height: 0;
  border-left: 12px solid transparent;
  border-right: 12px solid transparent;
  border-top: 24px solid #e74c3c;
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
}

.item-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.12);
}

.label-field {
  flex: 1 1 120px;
  min-width: 80px;
}

.weight-field {
  flex: 0 0 80px;
  width: 80px;
}

.weight-dist {
  max-height: 260px;
  overflow-y: auto;
}

.weight-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.weight-label {
  flex: 0 0 80px;
  max-width: 80px;
}

.weight-bar-track {
  flex: 1;
  height: 10px;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 5px;
  overflow: hidden;
}

.weight-bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.3s ease;
}

.weight-pct {
  flex: 0 0 36px;
  text-align: right;
}

.winner-chip {
  font-size: 1rem;
  padding: 0 16px;
  height: 40px;
}
</style>
