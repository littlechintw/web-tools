<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { PDFDocument } from '@cantoo/pdf-lib'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'
import { getDocument } from '@/utils/pdfjs'

type SigMode = 'draw' | 'upload'

interface PlacementPoint {
  /** Click position in CSS pixels relative to the preview canvas. */
  x: number
  y: number
}

const { t } = useI18n()

const fileName = ref('')
const rawBytes = ref<Uint8Array | null>(null)
const pageCount = ref(0)
const currentPage = ref(1)
const loading = ref(false)
const applying = ref(false)
const error = ref('')

// Preview canvas and its rendered viewport dimensions (CSS px === canvas px).
const previewCanvas = ref<HTMLCanvasElement | null>(null)
const previewW = ref(0)
const previewH = ref(0)

// Signature
const sigMode = ref<SigMode>('draw')
const padCanvas = ref<HTMLCanvasElement | null>(null)
const hasDrawing = ref(false)
const uploadedSig = ref<{ dataUrl: string; w: number; h: number } | null>(null)
const sizePct = ref(25) // signature width as % of page width

const placement = ref<PlacementPoint | null>(null)

/* ---------------- PDF load ---------------- */

function clearState() {
  rawBytes.value = null
  fileName.value = ''
  pageCount.value = 0
  currentPage.value = 1
  placement.value = null
  error.value = ''
  previewW.value = 0
  previewH.value = 0
}

async function onFiles(files: File[]) {
  const file = files[0]
  if (!file) return
  clearState()
  loading.value = true
  fileName.value = file.name
  try {
    rawBytes.value = new Uint8Array(await file.arrayBuffer())
    const pdf = await getDocument({ data: new Uint8Array(rawBytes.value.slice(0)) }).promise
    pageCount.value = pdf.numPages
    await pdf.cleanup()
    currentPage.value = 1
    await renderPreview()
  } catch {
    clearState()
    error.value = t('tools.pdf-sign.loadError')
  } finally {
    loading.value = false
  }
}

async function renderPreview() {
  if (!rawBytes.value) return
  await nextTick()
  const canvas = previewCanvas.value
  if (!canvas) return
  const pdf = await getDocument({ data: new Uint8Array(rawBytes.value.slice(0)) }).promise
  try {
    const page = await pdf.getPage(currentPage.value)
    // Fit preview to a sensible max width.
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(1.5, 640 / base.width)
    const viewport = page.getViewport({ scale })
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    previewW.value = canvas.width
    previewH.value = canvas.height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      await page.render({ canvasContext: ctx, viewport, canvas }).promise
    }
  } finally {
    await pdf.cleanup()
  }
}

watch(currentPage, () => {
  placement.value = null
  void renderPreview()
})

/* ---------------- Placement ---------------- */

function onPreviewClick(e: MouseEvent) {
  const canvas = previewCanvas.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  // Map from displayed CSS pixels to canvas (== viewport) pixels.
  const x = ((e.clientX - rect.left) / rect.width) * canvas.width
  const y = ((e.clientY - rect.top) / rect.height) * canvas.height
  placement.value = { x, y }
}

// Signature display box (in canvas px), centered on the placement point.
const sigBox = computed(() => {
  if (!placement.value || !previewW.value) return null
  const w = (sizePct.value / 100) * previewW.value
  const ar = aspectRatio()
  const h = w * ar
  return {
    left: placement.value.x - w / 2,
    top: placement.value.y - h / 2,
    width: w,
    height: h,
  }
})

function aspectRatio(): number {
  // height / width of the current signature source.
  if (sigMode.value === 'upload' && uploadedSig.value) {
    return uploadedSig.value.h / uploadedSig.value.w
  }
  const c = padCanvas.value
  if (c) return c.height / c.width
  return 0.4
}

/* ---------------- Signature pad ---------------- */

let drawing = false
let lastX = 0
let lastY = 0

function padCtx(): CanvasRenderingContext2D | null {
  return padCanvas.value?.getContext('2d') ?? null
}

function padPos(e: PointerEvent) {
  const canvas = padCanvas.value!
  const rect = canvas.getBoundingClientRect()
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  }
}

function onPadDown(e: PointerEvent) {
  const canvas = padCanvas.value
  if (!canvas) return
  canvas.setPointerCapture(e.pointerId)
  drawing = true
  const p = padPos(e)
  lastX = p.x
  lastY = p.y
}

function onPadMove(e: PointerEvent) {
  if (!drawing) return
  const ctx = padCtx()
  if (!ctx) return
  const p = padPos(e)
  ctx.strokeStyle = '#111'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(lastX, lastY)
  ctx.lineTo(p.x, p.y)
  ctx.stroke()
  lastX = p.x
  lastY = p.y
  hasDrawing.value = true
}

function onPadUp(e: PointerEvent) {
  drawing = false
  padCanvas.value?.releasePointerCapture(e.pointerId)
}

function clearPad() {
  const ctx = padCtx()
  const c = padCanvas.value
  if (ctx && c) ctx.clearRect(0, 0, c.width, c.height)
  hasDrawing.value = false
}

/* ---------------- Upload signature ---------------- */

function onSigFiles(files: File[]) {
  const file = files[0]
  if (!file) return
  error.value = ''
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = reader.result as string
    const img = new Image()
    img.onload = () => {
      uploadedSig.value = { dataUrl, w: img.width, h: img.height }
    }
    img.onerror = () => {
      error.value = t('tools.pdf-sign.signatureError')
    }
    img.src = dataUrl
  }
  reader.onerror = () => {
    error.value = t('tools.pdf-sign.signatureError')
  }
  reader.readAsDataURL(file)
}

const hasSignature = computed(() =>
  sigMode.value === 'draw' ? hasDrawing.value : uploadedSig.value !== null,
)

/* ---------------- Apply ---------------- */

function signaturePngBytes(): Uint8Array | null {
  if (sigMode.value === 'upload') {
    if (!uploadedSig.value) return null
    const b64 = uploadedSig.value.dataUrl.split(',')[1] ?? ''
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }
  const c = padCanvas.value
  if (!c) return null
  const dataUrl = c.toDataURL('image/png')
  const b64 = dataUrl.split(',')[1] ?? ''
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function apply() {
  if (!rawBytes.value) return
  if (!hasSignature.value) {
    error.value = t('tools.pdf-sign.noSignature')
    return
  }
  if (!placement.value || !sigBox.value) {
    error.value = t('tools.pdf-sign.noPlacement')
    return
  }
  error.value = ''
  applying.value = true
  try {
    const pngBytes = signaturePngBytes()
    if (!pngBytes) throw new Error('no signature')

    const doc = await PDFDocument.load(rawBytes.value)
    const page = doc.getPage(currentPage.value - 1)
    const png = await doc.embedPng(pngBytes)

    const { width: pw, height: ph } = page.getSize()
    const box = sigBox.value

    // Convert preview (canvas) coords -> PDF user-space points.
    const sx = pw / previewW.value
    const sy = ph / previewH.value
    const drawW = box.width * sx
    const drawH = box.height * sy
    const pdfX = box.left * sx
    // Canvas top-left origin -> PDF bottom-left origin.
    const pdfY = ph - box.top * sy - drawH

    page.drawImage(png, { x: pdfX, y: pdfY, width: drawW, height: drawH })

    const bytes = await doc.save()
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName.value.replace(/\.pdf$/i, '') + '-signed.pdf'
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    error.value = t('tools.pdf-sign.applyError')
  } finally {
    applying.value = false
  }
}

onBeforeUnmount(() => {
  clearState()
})
</script>

<template>
  <ToolShell>
    <FileDrop
      v-if="!rawBytes && !loading"
      accept="application/pdf"
      :hint="t('tools.pdf-sign.dropHint')"
      @files="onFiles"
    />

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">
      {{ error }}
    </v-alert>

    <div v-if="loading" class="d-flex flex-column align-center ga-3 py-8">
      <v-progress-circular indeterminate color="primary" />
      <span class="text-medium-emphasis">{{ t('tools.pdf-sign.loading') }}</span>
    </div>

    <template v-if="rawBytes && !loading">
      <div class="d-flex flex-wrap align-center ga-3 mb-4">
        <span class="text-body-2 text-medium-emphasis">{{ fileName }}</span>
        <v-spacer />
        <v-btn variant="text" prepend-icon="mdi-refresh" @click="clearState">
          {{ t('tools.pdf-sign.reset') }}
        </v-btn>
      </div>

      <div class="d-flex flex-wrap ga-4">
        <!-- Page preview -->
        <div class="preview-col">
          <div class="d-flex align-center ga-2 mb-2">
            <span class="text-body-2">{{ t('tools.pdf-sign.page') }}</span>
            <v-btn
              icon="mdi-chevron-left"
              size="x-small"
              variant="text"
              :disabled="currentPage <= 1"
              @click="currentPage--"
            />
            <span class="text-body-2">{{ currentPage }} / {{ pageCount }}</span>
            <v-btn
              icon="mdi-chevron-right"
              size="x-small"
              variant="text"
              :disabled="currentPage >= pageCount"
              @click="currentPage++"
            />
          </div>

          <div class="preview-wrap">
            <canvas
              ref="previewCanvas"
              class="preview-canvas"
              @click="onPreviewClick"
            />
            <div
              v-if="sigBox"
              class="sig-ghost"
              :style="{
                left: sigBox.left + 'px',
                top: sigBox.top + 'px',
                width: sigBox.width + 'px',
                height: sigBox.height + 'px',
              }"
            />
          </div>
          <div class="text-caption text-medium-emphasis mt-1">
            {{ placement ? t('tools.pdf-sign.placed') : t('tools.pdf-sign.placeHint') }}
          </div>
        </div>

        <!-- Signature controls -->
        <div class="control-col">
          <div class="text-subtitle-2 mb-2">{{ t('tools.pdf-sign.signature') }}</div>

          <v-btn-toggle
            v-model="sigMode"
            mandatory
            color="primary"
            density="comfortable"
            variant="outlined"
            class="mb-3"
          >
            <v-btn value="draw">{{ t('tools.pdf-sign.draw') }}</v-btn>
            <v-btn value="upload">{{ t('tools.pdf-sign.upload') }}</v-btn>
          </v-btn-toggle>

          <template v-if="sigMode === 'draw'">
            <canvas
              ref="padCanvas"
              width="400"
              height="160"
              class="sig-pad mb-2"
              @pointerdown="onPadDown"
              @pointermove="onPadMove"
              @pointerup="onPadUp"
              @pointercancel="onPadUp"
            />
            <v-btn
              variant="tonal"
              size="small"
              prepend-icon="mdi-eraser"
              @click="clearPad"
            >
              {{ t('tools.pdf-sign.clear') }}
            </v-btn>
          </template>

          <template v-else>
            <FileDrop
              accept="image/png"
              :hint="t('tools.pdf-sign.uploadSignatureHint')"
              @files="onSigFiles"
            />
            <div v-if="uploadedSig" class="sig-preview mt-2">
              <img :src="uploadedSig.dataUrl" :alt="t('tools.pdf-sign.signature')" />
            </div>
          </template>

          <div class="mt-4">
            <span class="text-body-2">{{ t('tools.pdf-sign.size') }}</span>
            <v-slider
              v-model="sizePct"
              :min="5"
              :max="80"
              :step="1"
              thumb-label
              hide-details
              density="compact"
            />
          </div>

          <v-btn
            color="primary"
            variant="flat"
            block
            class="mt-4"
            prepend-icon="mdi-download"
            :loading="applying"
            @click="apply"
          >
            {{ t('tools.pdf-sign.apply') }}
          </v-btn>
        </div>
      </div>
    </template>
  </ToolShell>
</template>

<style scoped>
.preview-col {
  flex: 1 1 360px;
  min-width: 280px;
}
.control-col {
  flex: 1 1 300px;
  min-width: 260px;
}
.preview-wrap {
  position: relative;
  display: inline-block;
  line-height: 0;
  border: 1px solid rgba(var(--v-border-color), 0.3);
  border-radius: 4px;
  overflow: hidden;
  max-width: 100%;
}
.preview-canvas {
  display: block;
  max-width: 100%;
  height: auto;
  cursor: crosshair;
}
.sig-ghost {
  position: absolute;
  border: 1.5px dashed rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
  pointer-events: none;
}
.sig-pad {
  width: 100%;
  max-width: 400px;
  aspect-ratio: 400 / 160;
  background: #fff;
  border: 1px solid rgba(var(--v-border-color), 0.4);
  border-radius: 4px;
  touch-action: none;
  cursor: crosshair;
}
.sig-preview img {
  max-width: 100%;
  max-height: 120px;
  background:
    repeating-conic-gradient(#0001 0% 25%, transparent 0% 50%) 50% / 16px 16px;
  border: 1px solid rgba(var(--v-border-color), 0.3);
  border-radius: 4px;
}
</style>
