<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'

const { t } = useI18n()

type ToolMode = 'none' | 'crop' | 'mosaic' | 'text'
type ExportFormat = 'image/png' | 'image/jpeg'

const canvasRef = ref<HTMLCanvasElement>()
const objectUrl = ref('')
const hasImage = ref(false)
const error = ref('')

// Working pixel dimensions of the canvas (the authoritative image state).
const imgWidth = ref(0)
const imgHeight = ref(0)

const mode = ref<ToolMode>('none')

// Resize controls.
const resizeWidth = ref(0)
const resizeHeight = ref(0)
const lockAspect = ref(true)

// Adjustment controls.
const brightness = ref(100) // %
const contrast = ref(100) // %
const saturation = ref(100) // %
const grayscale = ref(false)
const invert = ref(false)

// Mosaic / text controls.
const blockSize = ref(12)
const textContent = ref('')
const fontSize = ref(32)
const textColor = ref('#ff0000')

// Export controls.
const exportFormat = ref<ExportFormat>('image/png')
const exportQuality = ref(0.92)

// Drag selection (in canvas pixel coordinates).
const selection = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const dragging = ref(false)
const dragStart = ref<{ x: number; y: number } | null>(null)

// Single-level undo: snapshot of committed pixels before the last operation.
const undoSnapshot = ref<ImageData | null>(null)

function ctx2d(): CanvasRenderingContext2D | null {
  const c = canvasRef.value
  if (!c) return null
  return c.getContext('2d')
}

function revoke() {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = ''
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('load'))
    img.src = url
  })
}

async function onFiles(files: File[]) {
  const file = files[0]
  if (!file) return
  error.value = ''
  revoke()
  objectUrl.value = URL.createObjectURL(file)
  try {
    const img = await loadImage(objectUrl.value)
    const canvas = canvasRef.value
    if (!canvas) return
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = ctx2d()
    if (!ctx) {
      error.value = t('tools.image-editor.errLoad')
      return
    }
    ctx.drawImage(img, 0, 0)
    imgWidth.value = canvas.width
    imgHeight.value = canvas.height
    resizeWidth.value = canvas.width
    resizeHeight.value = canvas.height
    hasImage.value = true
    undoSnapshot.value = null
    clearSelection()
  } catch {
    error.value = t('tools.image-editor.errLoad')
  }
}

// Snapshot current pixels so the next destructive op can be undone.
function commitSnapshot() {
  const ctx = ctx2d()
  const canvas = canvasRef.value
  if (!ctx || !canvas) return
  undoSnapshot.value = ctx.getImageData(0, 0, canvas.width, canvas.height)
}

function undo() {
  const ctx = ctx2d()
  const canvas = canvasRef.value
  const snap = undoSnapshot.value
  if (!ctx || !canvas || !snap) return
  canvas.width = snap.width
  canvas.height = snap.height
  ctx.putImageData(snap, 0, 0)
  imgWidth.value = canvas.width
  imgHeight.value = canvas.height
  resizeWidth.value = canvas.width
  resizeHeight.value = canvas.height
  undoSnapshot.value = null
  clearSelection()
}

const canUndo = computed(() => undoSnapshot.value !== null)

// Draw the current canvas onto a fresh off-screen canvas (used as the source for
// transforms so we read a stable copy while we mutate the visible canvas).
function snapshotCanvas(): HTMLCanvasElement | null {
  const src = canvasRef.value
  if (!src) return null
  const off = document.createElement('canvas')
  off.width = src.width
  off.height = src.height
  const offCtx = off.getContext('2d')
  if (!offCtx) return null
  offCtx.drawImage(src, 0, 0)
  return off
}

function syncDims() {
  const canvas = canvasRef.value
  if (!canvas) return
  imgWidth.value = canvas.width
  imgHeight.value = canvas.height
  resizeWidth.value = canvas.width
  resizeHeight.value = canvas.height
}

// --- Transforms -----------------------------------------------------------

function rotate(dir: 'left' | 'right') {
  const off = snapshotCanvas()
  const canvas = canvasRef.value
  const ctx = ctx2d()
  if (!off || !canvas || !ctx) return
  commitSnapshot()
  const w = off.width
  const h = off.height
  canvas.width = h
  canvas.height = w
  ctx.save()
  if (dir === 'right') {
    ctx.translate(h, 0)
    ctx.rotate(Math.PI / 2)
  } else {
    ctx.translate(0, w)
    ctx.rotate(-Math.PI / 2)
  }
  ctx.drawImage(off, 0, 0)
  ctx.restore()
  syncDims()
  clearSelection()
}

function flip(axis: 'h' | 'v') {
  const off = snapshotCanvas()
  const canvas = canvasRef.value
  const ctx = ctx2d()
  if (!off || !canvas || !ctx) return
  commitSnapshot()
  ctx.save()
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (axis === 'h') {
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
  } else {
    ctx.translate(0, canvas.height)
    ctx.scale(1, -1)
  }
  ctx.drawImage(off, 0, 0)
  ctx.restore()
  clearSelection()
}

function applyResize() {
  const off = snapshotCanvas()
  const canvas = canvasRef.value
  const ctx = ctx2d()
  if (!off || !canvas || !ctx) return
  const w = Math.max(1, Math.round(resizeWidth.value))
  const h = Math.max(1, Math.round(resizeHeight.value))
  commitSnapshot()
  canvas.width = w
  canvas.height = h
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(off, 0, 0, w, h)
  syncDims()
  clearSelection()
}

function onResizeWidthChange(val: number) {
  resizeWidth.value = val
  if (lockAspect.value && imgWidth.value > 0) {
    resizeHeight.value = Math.round((val * imgHeight.value) / imgWidth.value)
  }
}

function onResizeHeightChange(val: number) {
  resizeHeight.value = val
  if (lockAspect.value && imgHeight.value > 0) {
    resizeWidth.value = Math.round((val * imgWidth.value) / imgHeight.value)
  }
}

// --- Adjustments ----------------------------------------------------------

const filterString = computed(() => {
  const parts = [
    `brightness(${brightness.value}%)`,
    `contrast(${contrast.value}%)`,
    `saturate(${saturation.value}%)`,
  ]
  if (grayscale.value) parts.push('grayscale(100%)')
  if (invert.value) parts.push('invert(100%)')
  return parts.join(' ')
})

function applyAdjustments() {
  const off = snapshotCanvas()
  const canvas = canvasRef.value
  const ctx = ctx2d()
  if (!off || !canvas || !ctx) return
  commitSnapshot()
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.filter = filterString.value
  ctx.drawImage(off, 0, 0)
  ctx.filter = 'none'
  resetAdjustValues()
}

function resetAdjustValues() {
  brightness.value = 100
  contrast.value = 100
  saturation.value = 100
  grayscale.value = false
  invert.value = false
}

// --- Mosaic ---------------------------------------------------------------

function applyMosaic() {
  const sel = selection.value
  const ctx = ctx2d()
  if (!sel || !ctx || sel.w < 1 || sel.h < 1) return
  commitSnapshot()
  const size = Math.max(2, Math.round(blockSize.value))
  const x0 = Math.max(0, Math.floor(sel.x))
  const y0 = Math.max(0, Math.floor(sel.y))
  const x1 = Math.min(imgWidth.value, Math.ceil(sel.x + sel.w))
  const y1 = Math.min(imgHeight.value, Math.ceil(sel.y + sel.h))
  const region = ctx.getImageData(x0, y0, x1 - x0, y1 - y0)
  const data = region.data
  const rw = region.width
  const rh = region.height
  for (let by = 0; by < rh; by += size) {
    for (let bx = 0; bx < rw; bx += size) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let count = 0
      const maxY = Math.min(by + size, rh)
      const maxX = Math.min(bx + size, rw)
      for (let y = by; y < maxY; y++) {
        for (let x = bx; x < maxX; x++) {
          const i = (y * rw + x) * 4
          r += data[i]
          g += data[i + 1]
          b += data[i + 2]
          a += data[i + 3]
          count++
        }
      }
      r = Math.round(r / count)
      g = Math.round(g / count)
      b = Math.round(b / count)
      a = Math.round(a / count)
      for (let y = by; y < maxY; y++) {
        for (let x = bx; x < maxX; x++) {
          const i = (y * rw + x) * 4
          data[i] = r
          data[i + 1] = g
          data[i + 2] = b
          data[i + 3] = a
        }
      }
    }
  }
  ctx.putImageData(region, x0, y0)
  clearSelection()
}

// --- Text -----------------------------------------------------------------

function placeText(px: number, py: number) {
  const ctx = ctx2d()
  if (!ctx || !textContent.value) return
  commitSnapshot()
  ctx.save()
  ctx.font = `${Math.max(1, Math.round(fontSize.value))}px sans-serif`
  ctx.fillStyle = textColor.value
  ctx.textBaseline = 'top'
  ctx.fillText(textContent.value, px, py)
  ctx.restore()
}

// --- Crop -----------------------------------------------------------------

function applyCrop() {
  const sel = selection.value
  const off = snapshotCanvas()
  const canvas = canvasRef.value
  const ctx = ctx2d()
  if (!sel || !off || !canvas || !ctx || sel.w < 1 || sel.h < 1) return
  commitSnapshot()
  const x = Math.max(0, Math.floor(sel.x))
  const y = Math.max(0, Math.floor(sel.y))
  const w = Math.min(imgWidth.value - x, Math.round(sel.w))
  const h = Math.min(imgHeight.value - y, Math.round(sel.h))
  canvas.width = w
  canvas.height = h
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(off, x, y, w, h, 0, 0, w, h)
  syncDims()
  clearSelection()
}

// --- Selection + pointer handling -----------------------------------------

function clearSelection() {
  selection.value = null
  dragging.value = false
  dragStart.value = null
}

// Map a pointer event to canvas pixel coordinates (canvas is CSS-scaled).
function toCanvasCoords(e: PointerEvent): { x: number; y: number } | null {
  const canvas = canvasRef.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const x = (e.clientX - rect.left) * scaleX
  const y = (e.clientY - rect.top) * scaleY
  return {
    x: Math.max(0, Math.min(canvas.width, x)),
    y: Math.max(0, Math.min(canvas.height, y)),
  }
}

function onPointerDown(e: PointerEvent) {
  if (!hasImage.value) return
  const p = toCanvasCoords(e)
  if (!p) return
  if (mode.value === 'text') {
    placeText(p.x, p.y)
    return
  }
  if (mode.value === 'crop' || mode.value === 'mosaic') {
    dragging.value = true
    dragStart.value = p
    selection.value = { x: p.x, y: p.y, w: 0, h: 0 }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value || !dragStart.value) return
  const p = toCanvasCoords(e)
  if (!p) return
  const s = dragStart.value
  selection.value = {
    x: Math.min(s.x, p.x),
    y: Math.min(s.y, p.y),
    w: Math.abs(p.x - s.x),
    h: Math.abs(p.y - s.y),
  }
}

function onPointerUp() {
  dragging.value = false
}

// Selection overlay rendered in CSS pixels over the canvas.
const selectionStyle = computed(() => {
  const sel = selection.value
  const canvas = canvasRef.value
  if (!sel || !canvas || imgWidth.value === 0) return { display: 'none' }
  const rect = canvas.getBoundingClientRect()
  const scaleX = rect.width / canvas.width
  const scaleY = rect.height / canvas.height
  return {
    left: `${sel.x * scaleX}px`,
    top: `${sel.y * scaleY}px`,
    width: `${sel.w * scaleX}px`,
    height: `${sel.h * scaleY}px`,
  }
})

const showSelectionTool = computed(() => mode.value === 'crop' || mode.value === 'mosaic')

const cursorClass = computed(() => {
  if (mode.value === 'text') return 'cursor-text'
  if (showSelectionTool.value) return 'cursor-cross'
  return ''
})

// --- Export ---------------------------------------------------------------

function download() {
  const canvas = canvasRef.value
  if (!canvas) return
  const isJpeg = exportFormat.value === 'image/jpeg'
  canvas.toBlob(
    (blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `edited.${isJpeg ? 'jpg' : 'png'}`
      a.click()
      URL.revokeObjectURL(url)
    },
    exportFormat.value,
    isJpeg ? exportQuality.value : undefined,
  )
}

const formats = [
  { title: 'PNG', value: 'image/png' as ExportFormat },
  { title: 'JPEG', value: 'image/jpeg' as ExportFormat },
]

// Switching tools clears any in-progress selection.
watch(mode, () => clearSelection())

onUnmounted(revoke)
</script>

<template>
  <ToolShell>
    <FileDrop accept="image/*" :hint="t('tools.image-editor.uploadHint')" @files="onFiles" />

    <v-alert v-if="error" type="error" variant="tonal" class="mt-3">{{ error }}</v-alert>

    <template v-if="hasImage">
      <!-- Mode toolbar -->
      <div class="d-flex flex-wrap align-center ga-2 mt-4">
        <span class="text-body-2 text-medium-emphasis mr-1">{{ t('tools.image-editor.tools') }}:</span>
        <v-btn-toggle v-model="mode" mandatory color="primary" density="comfortable" variant="outlined">
          <v-btn value="none" prepend-icon="mdi-cursor-default">{{ t('tools.image-editor.toolNone') }}</v-btn>
          <v-btn value="crop" prepend-icon="mdi-crop">{{ t('tools.image-editor.toolCrop') }}</v-btn>
          <v-btn value="mosaic" prepend-icon="mdi-blur">{{ t('tools.image-editor.toolMosaic') }}</v-btn>
          <v-btn value="text" prepend-icon="mdi-format-text">{{ t('tools.image-editor.toolText') }}</v-btn>
        </v-btn-toggle>
        <v-spacer />
        <v-btn variant="tonal" :disabled="!canUndo" prepend-icon="mdi-undo" @click="undo">
          {{ t('tools.image-editor.undo') }}
        </v-btn>
      </div>

      <!-- Canvas -->
      <div class="canvas-wrap mt-3">
        <div class="canvas-inner" :class="cursorClass">
          <canvas
            ref="canvasRef"
            class="edit-canvas rounded"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
          />
          <div v-if="showSelectionTool" class="selection-box" :style="selectionStyle" />
        </div>
      </div>
      <div class="text-caption text-medium-emphasis mt-1">
        {{ t('tools.image-editor.dimensions') }}: {{ imgWidth }} × {{ imgHeight }}
      </div>

      <!-- Contextual hints / actions for selection tools -->
      <div v-if="mode === 'crop'" class="mt-2">
        <div class="text-body-2 mb-2">{{ t('tools.image-editor.cropHint') }}</div>
        <div class="d-flex ga-2">
          <v-btn color="primary" prepend-icon="mdi-crop" :disabled="!selection" @click="applyCrop">
            {{ t('tools.image-editor.applyCrop') }}
          </v-btn>
          <v-btn variant="text" :disabled="!selection" @click="clearSelection">
            {{ t('tools.image-editor.cancelSelect') }}
          </v-btn>
        </div>
      </div>

      <div v-if="mode === 'mosaic'" class="mt-2">
        <div class="text-body-2 mb-2">{{ t('tools.image-editor.mosaicHint') }}</div>
        <div style="max-width: 360px">
          <div class="text-body-2 mb-1">
            {{ t('tools.image-editor.blockSize') }}: {{ blockSize }}px
          </div>
          <v-slider v-model="blockSize" :min="2" :max="64" :step="1" hide-details class="mb-2" />
        </div>
        <div class="d-flex ga-2">
          <v-btn color="primary" prepend-icon="mdi-blur" :disabled="!selection" @click="applyMosaic">
            {{ t('tools.image-editor.applyMosaic') }}
          </v-btn>
          <v-btn variant="text" :disabled="!selection" @click="clearSelection">
            {{ t('tools.image-editor.cancelSelect') }}
          </v-btn>
        </div>
      </div>

      <div v-if="mode === 'text'" class="mt-2">
        <div class="text-body-2 mb-2">{{ t('tools.image-editor.textHint') }}</div>
        <v-row dense>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="textContent"
              :label="t('tools.image-editor.textContent')"
              hide-details
              density="comfortable"
            />
          </v-col>
          <v-col cols="6" sm="3">
            <v-text-field
              v-model.number="fontSize"
              type="number"
              :min="8"
              :label="t('tools.image-editor.fontSize')"
              hide-details
              density="comfortable"
            />
          </v-col>
          <v-col cols="6" sm="3">
            <v-text-field
              v-model="textColor"
              type="color"
              :label="t('tools.image-editor.textColor')"
              hide-details
              density="comfortable"
            />
          </v-col>
        </v-row>
      </div>

      <!-- Transform -->
      <v-card variant="tonal" class="mt-4">
        <v-card-title class="text-subtitle-2">{{ t('tools.image-editor.transform') }}</v-card-title>
        <v-card-text class="d-flex flex-wrap ga-2">
          <v-btn variant="outlined" prepend-icon="mdi-rotate-left" @click="rotate('left')">
            {{ t('tools.image-editor.rotateLeft') }}
          </v-btn>
          <v-btn variant="outlined" prepend-icon="mdi-rotate-right" @click="rotate('right')">
            {{ t('tools.image-editor.rotateRight') }}
          </v-btn>
          <v-btn variant="outlined" prepend-icon="mdi-flip-horizontal" @click="flip('h')">
            {{ t('tools.image-editor.flipH') }}
          </v-btn>
          <v-btn variant="outlined" prepend-icon="mdi-flip-vertical" @click="flip('v')">
            {{ t('tools.image-editor.flipV') }}
          </v-btn>
        </v-card-text>
      </v-card>

      <!-- Resize -->
      <v-card variant="tonal" class="mt-3">
        <v-card-title class="text-subtitle-2">{{ t('tools.image-editor.resize') }}</v-card-title>
        <v-card-text>
          <v-row dense align="center">
            <v-col cols="6" sm="4">
              <v-text-field
                :model-value="resizeWidth"
                type="number"
                :min="1"
                :label="t('tools.image-editor.width')"
                hide-details
                density="comfortable"
                @update:model-value="onResizeWidthChange(Number($event))"
              />
            </v-col>
            <v-col cols="6" sm="4">
              <v-text-field
                :model-value="resizeHeight"
                type="number"
                :min="1"
                :label="t('tools.image-editor.height')"
                hide-details
                density="comfortable"
                @update:model-value="onResizeHeightChange(Number($event))"
              />
            </v-col>
            <v-col cols="12" sm="4" class="d-flex align-center">
              <v-checkbox
                v-model="lockAspect"
                :label="t('tools.image-editor.lockAspect')"
                hide-details
                density="compact"
              />
            </v-col>
          </v-row>
          <v-btn color="primary" class="mt-2" prepend-icon="mdi-resize" @click="applyResize">
            {{ t('tools.image-editor.applyResize') }}
          </v-btn>
        </v-card-text>
      </v-card>

      <!-- Adjustments -->
      <v-card variant="tonal" class="mt-3">
        <v-card-title class="text-subtitle-2">{{ t('tools.image-editor.adjustments') }}</v-card-title>
        <v-card-text>
          <div class="text-body-2 mb-1">{{ t('tools.image-editor.brightness') }}: {{ brightness }}%</div>
          <v-slider v-model="brightness" :min="0" :max="200" :step="1" hide-details class="mb-2" />
          <div class="text-body-2 mb-1">{{ t('tools.image-editor.contrast') }}: {{ contrast }}%</div>
          <v-slider v-model="contrast" :min="0" :max="200" :step="1" hide-details class="mb-2" />
          <div class="text-body-2 mb-1">{{ t('tools.image-editor.saturation') }}: {{ saturation }}%</div>
          <v-slider v-model="saturation" :min="0" :max="200" :step="1" hide-details class="mb-2" />
          <div class="d-flex flex-wrap ga-4">
            <v-checkbox
              v-model="grayscale"
              :label="t('tools.image-editor.grayscale')"
              hide-details
              density="compact"
            />
            <v-checkbox
              v-model="invert"
              :label="t('tools.image-editor.invert')"
              hide-details
              density="compact"
            />
          </div>
          <div class="d-flex ga-2 mt-2">
            <v-btn color="primary" prepend-icon="mdi-auto-fix" @click="applyAdjustments">
              {{ t('tools.image-editor.applyAdjust') }}
            </v-btn>
            <v-btn variant="text" @click="resetAdjustValues">
              {{ t('tools.image-editor.resetAdjust') }}
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <!-- Export -->
      <v-card variant="tonal" class="mt-3">
        <v-card-title class="text-subtitle-2">{{ t('tools.image-editor.exportSection') }}</v-card-title>
        <v-card-text>
          <v-row dense align="center">
            <v-col cols="12" sm="4">
              <v-select
                v-model="exportFormat"
                :items="formats"
                :label="t('tools.image-editor.format')"
                hide-details
                density="comfortable"
              />
            </v-col>
            <v-col v-if="exportFormat === 'image/jpeg'" cols="12" sm="8">
              <div class="text-body-2 mb-1">
                {{ t('tools.image-editor.quality') }}: {{ exportQuality.toFixed(2) }}
              </div>
              <v-slider v-model="exportQuality" :min="0.1" :max="1" :step="0.01" hide-details />
            </v-col>
          </v-row>
          <v-btn color="primary" class="mt-2" prepend-icon="mdi-download" @click="download">
            {{ t('tools.image-editor.download') }}
          </v-btn>
        </v-card-text>
      </v-card>
    </template>

    <div v-else class="text-body-2 text-medium-emphasis mt-4">
      {{ t('tools.image-editor.noImage') }}
    </div>
  </ToolShell>
</template>

<style scoped>
.canvas-wrap {
  width: 100%;
  overflow: auto;
  background:
    repeating-conic-gradient(rgba(var(--v-border-color), 0.12) 0% 25%, transparent 0% 50%) 50% / 24px
    24px;
  border: 1px solid rgba(var(--v-border-color), 0.3);
  border-radius: 8px;
  padding: 8px;
}
.canvas-inner {
  position: relative;
  display: inline-block;
  line-height: 0;
}
.edit-canvas {
  max-width: 100%;
  height: auto;
  display: block;
  touch-action: none;
}
.cursor-cross {
  cursor: crosshair;
}
.cursor-text {
  cursor: text;
}
.selection-box {
  position: absolute;
  border: 2px dashed rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
  pointer-events: none;
}
</style>
