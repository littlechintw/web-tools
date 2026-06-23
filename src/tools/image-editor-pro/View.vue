<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import * as fabric from 'fabric'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'

const TOOL_ID = 'image-editor-pro'

const { t } = useI18n()
const tt = (key: string) => t(`tools.${TOOL_ID}.${key}`)

const MAX_W = 900
const MAX_H = 560

const canvasEl = ref<HTMLCanvasElement | null>(null)
let canvas: fabric.Canvas | null = null

// Track object URLs so we can revoke them on unmount.
const objectUrls: string[] = []

const hasImage = ref(false)
const hasSelection = ref(false)
const drawingMode = ref(false)
const brushColor = ref('#ff5252')
const brushWidth = ref(6)
const fillColor = ref('#4caf50')
const strokeColor = ref('#000000')
const multiplier = ref<1 | 2>(1)
const errorMsg = ref('')

function syncSelection() {
  hasSelection.value = !!canvas?.getActiveObject()
  const obj = canvas?.getActiveObject()
  if (obj) {
    if (typeof obj.fill === 'string') fillColor.value = obj.fill
    if (typeof obj.stroke === 'string' && obj.stroke) strokeColor.value = obj.stroke
  }
}

onMounted(() => {
  if (!canvasEl.value) return
  canvas = new fabric.Canvas(canvasEl.value, {
    width: MAX_W,
    height: MAX_H,
    backgroundColor: '#ffffff',
    preserveObjectStacking: true,
  })
  canvas.on('selection:created', syncSelection)
  canvas.on('selection:updated', syncSelection)
  canvas.on('selection:cleared', syncSelection)
})

onUnmounted(() => {
  canvas?.dispose()
  canvas = null
  for (const url of objectUrls) URL.revokeObjectURL(url)
  objectUrls.length = 0
})

async function onFiles(files: File[]) {
  const file = files[0]
  if (!file || !canvas) return
  errorMsg.value = ''
  const url = URL.createObjectURL(file)
  objectUrls.push(url)
  try {
    const img = await fabric.FabricImage.fromURL(url)
    const iw = img.width ?? 1
    const ih = img.height ?? 1
    // Scale the image to fit within the canvas while keeping aspect ratio.
    const scale = Math.min(MAX_W / iw, MAX_H / ih, 1)
    img.scale(scale)
    img.set({
      left: (MAX_W - iw * scale) / 2,
      top: (MAX_H - ih * scale) / 2,
    })
    canvas.add(img)
    canvas.setActiveObject(img)
    canvas.requestRenderAll()
    hasImage.value = true
    syncSelection()
  } catch {
    errorMsg.value = tt('loadError')
  }
}

function centerDefaults() {
  return { left: MAX_W / 2 - 60, top: MAX_H / 2 - 30 }
}

function addText() {
  if (!canvas) return
  const tb = new fabric.Textbox(tt('defaultText'), {
    ...centerDefaults(),
    width: 220,
    fontSize: 28,
    fill: fillColor.value,
  })
  canvas.add(tb)
  canvas.setActiveObject(tb)
  canvas.requestRenderAll()
  syncSelection()
}

function addRect() {
  if (!canvas) return
  const rect = new fabric.Rect({
    ...centerDefaults(),
    width: 160,
    height: 100,
    fill: fillColor.value,
    stroke: strokeColor.value,
    strokeWidth: 2,
  })
  canvas.add(rect)
  canvas.setActiveObject(rect)
  canvas.requestRenderAll()
  syncSelection()
}

function addCircle() {
  if (!canvas) return
  const circle = new fabric.Circle({
    ...centerDefaults(),
    radius: 60,
    fill: fillColor.value,
    stroke: strokeColor.value,
    strokeWidth: 2,
  })
  canvas.add(circle)
  canvas.setActiveObject(circle)
  canvas.requestRenderAll()
  syncSelection()
}

function addLine() {
  if (!canvas) return
  const cx = MAX_W / 2
  const cy = MAX_H / 2
  const line = new fabric.Line([cx - 80, cy, cx + 80, cy], {
    stroke: strokeColor.value,
    strokeWidth: 4,
  })
  canvas.add(line)
  canvas.setActiveObject(line)
  canvas.requestRenderAll()
  syncSelection()
}

function toggleDrawing() {
  if (!canvas) return
  drawingMode.value = !drawingMode.value
  canvas.isDrawingMode = drawingMode.value
  if (drawingMode.value) {
    const brush = new fabric.PencilBrush(canvas)
    brush.color = brushColor.value
    brush.width = brushWidth.value
    canvas.freeDrawingBrush = brush
  }
}

function applyBrush() {
  if (canvas?.freeDrawingBrush) {
    canvas.freeDrawingBrush.color = brushColor.value
    canvas.freeDrawingBrush.width = brushWidth.value
  }
}

function applyFill() {
  const obj = canvas?.getActiveObject()
  if (!obj) return
  obj.set('fill', fillColor.value)
  canvas?.requestRenderAll()
}

function applyStroke() {
  const obj = canvas?.getActiveObject()
  if (!obj) return
  obj.set('stroke', strokeColor.value)
  canvas?.requestRenderAll()
}

function deleteSelected() {
  if (!canvas) return
  const objs = canvas.getActiveObjects()
  if (!objs.length) return
  for (const o of objs) canvas.remove(o)
  canvas.discardActiveObject()
  canvas.requestRenderAll()
  hasImage.value = canvas.getObjects().some((o) => o instanceof fabric.FabricImage)
  syncSelection()
}

async function duplicateSelected() {
  if (!canvas) return
  const obj = canvas.getActiveObject()
  if (!obj) return
  const cloned = await obj.clone()
  cloned.set({ left: (obj.left ?? 0) + 20, top: (obj.top ?? 0) + 20 })
  canvas.add(cloned)
  canvas.setActiveObject(cloned)
  canvas.requestRenderAll()
  if (cloned instanceof fabric.FabricImage) hasImage.value = true
  syncSelection()
}

function bringForward() {
  const obj = canvas?.getActiveObject()
  if (!obj || !canvas) return
  canvas.bringObjectForward(obj)
  canvas.requestRenderAll()
}

function sendBackward() {
  const obj = canvas?.getActiveObject()
  if (!obj || !canvas) return
  canvas.sendObjectBackwards(obj)
  canvas.requestRenderAll()
}

function clearCanvas() {
  if (!canvas) return
  canvas.remove(...canvas.getObjects())
  canvas.discardActiveObject()
  canvas.backgroundColor = '#ffffff'
  canvas.requestRenderAll()
  hasImage.value = false
  if (drawingMode.value) toggleDrawing()
  syncSelection()
}

function exportPng() {
  if (!canvas || !hasImage.value) {
    errorMsg.value = tt('needImage')
    return
  }
  errorMsg.value = ''
  canvas.discardActiveObject()
  canvas.requestRenderAll()
  const dataUrl = canvas.toDataURL({ format: 'png', multiplier: multiplier.value })
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = tt('outputName')
  a.click()
}
</script>

<template>
  <ToolShell :max-width="1100">
    <FileDrop accept="image/*" :hint="tt('uploadHint')" @files="onFiles" />

    <v-alert v-if="errorMsg" type="error" variant="tonal" density="compact" class="mt-3">
      {{ errorMsg }}
    </v-alert>

    <!-- Add objects -->
    <div class="d-flex flex-wrap ga-2 mt-4">
      <v-btn prepend-icon="mdi-format-text" variant="tonal" @click="addText">
        {{ tt('addText') }}
      </v-btn>
      <v-btn prepend-icon="mdi-rectangle-outline" variant="tonal" @click="addRect">
        {{ tt('addRect') }}
      </v-btn>
      <v-btn prepend-icon="mdi-circle-outline" variant="tonal" @click="addCircle">
        {{ tt('addCircle') }}
      </v-btn>
      <v-btn prepend-icon="mdi-vector-line" variant="tonal" @click="addLine">
        {{ tt('addLine') }}
      </v-btn>
    </div>

    <!-- Free drawing -->
    <v-card variant="outlined" class="mt-4 pa-3">
      <div class="d-flex flex-wrap align-center ga-4">
        <v-btn
          :color="drawingMode ? 'primary' : undefined"
          :variant="drawingMode ? 'flat' : 'tonal'"
          prepend-icon="mdi-draw"
          @click="toggleDrawing"
        >
          {{ tt('drawing') }}: {{ drawingMode ? tt('drawOn') : tt('drawOff') }}
        </v-btn>
        <div class="d-flex align-center ga-2">
          <span class="text-body-2">{{ tt('brushColor') }}</span>
          <input type="color" v-model="brushColor" class="color-input" @input="applyBrush" />
        </div>
        <div class="d-flex align-center ga-2" style="min-width: 200px">
          <span class="text-body-2 text-no-wrap">{{ tt('brushWidth') }}</span>
          <v-slider
            v-model="brushWidth"
            :min="1"
            :max="40"
            :step="1"
            hide-details
            density="compact"
            thumb-label
            @update:model-value="applyBrush"
          />
        </div>
      </div>
    </v-card>

    <!-- Selection controls -->
    <v-card variant="outlined" class="mt-4 pa-3">
      <div class="text-subtitle-2 mb-2">{{ tt('selection') }}</div>
      <div v-if="!hasSelection" class="text-body-2 text-medium-emphasis">
        {{ tt('noSelection') }}
      </div>
      <div v-else class="d-flex flex-wrap align-center ga-4">
        <div class="d-flex align-center ga-2">
          <span class="text-body-2">{{ tt('fillColor') }}</span>
          <input type="color" v-model="fillColor" class="color-input" @input="applyFill" />
        </div>
        <div class="d-flex align-center ga-2">
          <span class="text-body-2">{{ tt('strokeColor') }}</span>
          <input type="color" v-model="strokeColor" class="color-input" @input="applyStroke" />
        </div>
        <v-btn size="small" variant="tonal" prepend-icon="mdi-content-duplicate" @click="duplicateSelected">
          {{ tt('duplicate') }}
        </v-btn>
        <v-btn size="small" variant="tonal" prepend-icon="mdi-arrange-bring-forward" @click="bringForward">
          {{ tt('bringForward') }}
        </v-btn>
        <v-btn size="small" variant="tonal" prepend-icon="mdi-arrange-send-backward" @click="sendBackward">
          {{ tt('sendBackward') }}
        </v-btn>
        <v-btn size="small" variant="tonal" color="error" prepend-icon="mdi-delete" @click="deleteSelected">
          {{ tt('deleteSelected') }}
        </v-btn>
      </div>
    </v-card>

    <!-- Canvas -->
    <div class="canvas-wrap mt-4">
      <canvas ref="canvasEl" />
    </div>

    <!-- Export / clear -->
    <div class="d-flex flex-wrap align-center ga-3 mt-4">
      <v-btn variant="tonal" color="error" prepend-icon="mdi-eraser-variant" @click="clearCanvas">
        {{ tt('clearCanvas') }}
      </v-btn>
      <v-spacer />
      <v-btn-toggle v-model="multiplier" mandatory density="comfortable" variant="outlined" color="primary">
        <v-btn :value="1">1x</v-btn>
        <v-btn :value="2">2x</v-btn>
      </v-btn-toggle>
      <span class="text-body-2 text-medium-emphasis">{{ tt('resolution') }}</span>
      <v-btn
        color="primary"
        prepend-icon="mdi-download"
        :disabled="!hasImage"
        @click="exportPng"
      >
        {{ tt('exportPng') }}
      </v-btn>
    </div>
  </ToolShell>
</template>

<style scoped>
.canvas-wrap {
  border: 1px solid rgba(var(--v-border-color), 0.3);
  border-radius: 8px;
  overflow: auto;
  max-width: 100%;
  background:
    repeating-conic-gradient(#f0f0f0 0% 25%, #ffffff 0% 50%) 50% / 24px 24px;
}
.canvas-wrap :deep(canvas) {
  display: block;
}
.color-input {
  width: 36px;
  height: 28px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
}
</style>
