<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { PDFDocument, StandardFonts, degrees, rgb, type PDFPage } from '@cantoo/pdf-lib'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'
import { isNumber, oneOf, useStoredRef } from '@/composables/useStoredRef'
import { downloadBlob } from '@/utils/download'
import { stripExtension } from '@/utils/format'
import { getDocument } from '@/utils/pdfjs'

const { t } = useI18n()
const T = (key: string, args?: Record<string, unknown>) => t(`tools.pdf-watermark.${key}`, args ?? {})

const LAYOUTS = ['tile', 'center'] as const
type Layout = (typeof LAYOUTS)[number]

const isHexColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

const pdfBytes = ref<Uint8Array | null>(null)
const fileName = ref('')
const pageCount = ref(0)

// The text is data and is never persisted; the look is remembered.
const text = ref('CONFIDENTIAL')
const fontSize = useStoredRef('pdf-watermark.fontSize', 48, (v): v is number => isNumber(v) && v >= 1)
const color = useStoredRef('pdf-watermark.color', '#ff0000', isHexColor)
const opacity = useStoredRef('pdf-watermark.opacity', 0.3, (v): v is number => isNumber(v) && v >= 0 && v <= 1)
const rotation = useStoredRef('pdf-watermark.rotation', 45, (v): v is number => isNumber(v) && v >= -180 && v <= 180)
const layout = useStoredRef<Layout>('pdf-watermark.layout', 'tile', oneOf(LAYOUTS))

const busy = ref(false)
const error = ref('')
const success = ref('')

// ---------------------------------------------------------------------------
// Live preview: the chosen page rendered once by pdf.js, with the watermark
// drawn on an overlay canvas using the same placement maths as apply().
const previewCanvas = ref<HTMLCanvasElement | null>(null)
const overlayCanvas = ref<HTMLCanvasElement | null>(null)
const previewPage = ref(1)
const previewBusy = ref(false)
let pageImage: { canvas: HTMLCanvasElement; widthPt: number; heightPt: number } | null = null
let previewSeq = 0

async function renderPreviewPage() {
  if (!pdfBytes.value) return
  const seq = ++previewSeq
  previewBusy.value = true
  const pdf = await getDocument({ data: pdfBytes.value.slice() }).promise
  try {
    const page = await pdf.getPage(Math.min(Math.max(1, previewPage.value), pdf.numPages))
    // rotation 0 = PDF user space, the coordinate system the watermark is placed in.
    const base = page.getViewport({ scale: 1, rotation: 0 })
    const vp = page.getViewport({ scale: Math.min(2, 560 / base.width), rotation: 0 })
    const off = document.createElement('canvas')
    off.width = Math.floor(vp.width)
    off.height = Math.floor(vp.height)
    const ctx = off.getContext('2d')
    if (!ctx) return
    await page.render({ canvasContext: ctx, viewport: vp, canvas: off }).promise
    if (seq !== previewSeq) return
    pageImage = { canvas: off, widthPt: base.width, heightPt: base.height }
    await nextTick()
    drawPreview()
  } catch {
    // Preview is best-effort; applying still works without it.
  } finally {
    void pdf.loadingTask.destroy()
    if (seq === previewSeq) previewBusy.value = false
  }
}

function drawPreview() {
  const pc = previewCanvas.value
  const oc = overlayCanvas.value
  if (!pc || !oc || !pageImage) return
  pc.width = oc.width = pageImage.canvas.width
  pc.height = oc.height = pageImage.canvas.height
  pc.getContext('2d')?.drawImage(pageImage.canvas, 0, 0)
  const ctx = oc.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, oc.width, oc.height)
  if (!text.value) return

  const s = oc.width / pageImage.widthPt // canvas px per PDF point
  const { widthPt: width, heightPt: height } = pageImage
  const size = fontSize.value
  ctx.font = `${size * s}px Helvetica, Arial, sans-serif`
  ctx.textBaseline = 'alphabetic'
  ctx.globalAlpha = opacity.value
  ctx.fillStyle = color.value
  const textWidth = ctx.measureText(text.value).width / s
  const rad = (rotation.value * Math.PI) / 180
  // (x, y) is the baseline origin in PDF space (y up); pdf-lib rotates
  // counter-clockwise, which is a negative rotation on a y-down canvas.
  const mark = (x: number, y: number) => {
    ctx.save()
    ctx.translate(x * s, (height - y) * s)
    ctx.rotate(-rad)
    ctx.fillText(text.value, 0, 0)
    ctx.restore()
  }
  if (layout.value === 'center') {
    mark(width / 2 - (textWidth / 2) * Math.cos(rad), height / 2 - (textWidth / 2) * Math.sin(rad))
  } else {
    const stepX = Math.max(textWidth + size * 2, size * 4)
    const stepY = Math.max(size * 4, 60)
    for (let y = -stepY; y < height + stepY; y += stepY) {
      for (let x = -stepX; x < width + stepX; x += stepX) mark(x, y)
    }
  }
}

watch([text, fontSize, color, opacity, rotation, layout], drawPreview)
watch(previewPage, () => void renderPreviewPage())
onUnmounted(() => {
  previewSeq++
})

/** Convert a #rrggbb string to pdf-lib rgb (0-1 components). */
function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return rgb(0, 0, 0)
  const int = parseInt(m[1], 16)
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255)
}

/** Rasterize text the standard PDF fonts can't encode (e.g. CJK) to a
 *  transparent PNG, returning the bytes plus its size in PDF points. */
function textToPng(txt: string, sizePt: number, colorHex: string) {
  const scale = 2 // 2x raster for crispness at typical zoom levels
  const canvas = document.createElement('canvas')
  const fontSpec = `${sizePt * scale}px sans-serif`
  let ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.font = fontSpec
  const m = ctx.measureText(txt)
  const ascent = m.actualBoundingBoxAscent || sizePt * scale
  const descent = m.actualBoundingBoxDescent || sizePt * scale * 0.25
  canvas.width = Math.max(1, Math.ceil(m.width) + 4)
  canvas.height = Math.max(1, Math.ceil(ascent + descent) + 4)
  ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.font = fontSpec
  ctx.fillStyle = /^#[0-9a-f]{6}$/i.test(colorHex.trim()) ? colorHex.trim() : '#000000'
  ctx.fillText(txt, 2, ascent + 2)
  const b64 = canvas.toDataURL('image/png').split(',')[1] ?? ''
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return { bytes, w: canvas.width / scale, h: canvas.height / scale }
}

async function onFiles(files: File[]) {
  const file = files[0]
  if (!file) return
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
    error.value = T('notPdf')
    return
  }
  error.value = ''
  success.value = ''
  fileName.value = stripExtension(file.name)
  pdfBytes.value = new Uint8Array(await file.arrayBuffer())
  try {
    const doc = await PDFDocument.load(pdfBytes.value.slice())
    pageCount.value = doc.getPageCount()
    previewPage.value = 1
    pageImage = null
    void renderPreviewPage()
  } catch (e) {
    error.value = T('loadError', { msg: (e as Error).message })
    pdfBytes.value = null
  }
}

async function apply() {
  if (!pdfBytes.value || !text.value) return
  busy.value = true
  error.value = ''
  success.value = ''
  try {
    const doc = await PDFDocument.load(pdfBytes.value.slice())
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const col = hexToRgb(color.value)
    const angle = degrees(rotation.value)

    // Helvetica only encodes WinAnsi; for anything else (e.g. CJK watermark
    // text) fall back to a rasterized image of the text.
    let textWidth: number
    let image: Awaited<ReturnType<typeof doc.embedPng>> | null = null
    let imageH = 0
    try {
      textWidth = font.widthOfTextAtSize(text.value, fontSize.value)
    } catch {
      const png = textToPng(text.value, fontSize.value, color.value)
      image = await doc.embedPng(png.bytes)
      textWidth = png.w
      imageH = png.h
    }

    const drawMark = (page: PDFPage, x: number, y: number) => {
      if (image) {
        page.drawImage(image, {
          x,
          y,
          width: textWidth,
          height: imageH,
          opacity: opacity.value,
          rotate: angle,
        })
      } else {
        page.drawText(text.value, {
          x,
          y,
          size: fontSize.value,
          font,
          color: col,
          opacity: opacity.value,
          rotate: angle,
        })
      }
    }

    for (const page of doc.getPages()) {
      const { width, height } = page.getSize()

      if (layout.value === 'center') {
        // Center the rotated baseline roughly on the page midpoint.
        const rad = (rotation.value * Math.PI) / 180
        drawMark(
          page,
          width / 2 - (textWidth / 2) * Math.cos(rad),
          height / 2 - (textWidth / 2) * Math.sin(rad),
        )
      } else {
        // Tile across the page on a regular grid.
        const stepX = Math.max(textWidth + fontSize.value * 2, fontSize.value * 4)
        const stepY = Math.max(fontSize.value * 4, 60)
        for (let y = -stepY; y < height + stepY; y += stepY) {
          for (let x = -stepX; x < width + stepX; x += stepX) {
            drawMark(page, x, y)
          }
        }
      }
    }

    const bytes = await doc.save()
    const name = `${fileName.value || 'watermarked'}-watermarked.pdf`
    downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), name)
    success.value = T('applied', { name })
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <ToolShell>
    <FileDrop accept="application/pdf,.pdf" :hint="t('tools.pdf-watermark.dropHint')" @files="onFiles" />

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-4">
      {{ error }}
    </v-alert>
    <v-alert v-if="success" type="success" variant="tonal" density="compact" class="mt-4">
      {{ success }}
    </v-alert>

    <p v-if="!pdfBytes" class="text-medium-emphasis text-body-2 mt-4">
      {{ t('tools.pdf-watermark.noPdf') }}
    </p>

    <template v-else>
      <p class="text-medium-emphasis text-body-2 mt-4">
        {{ t('tools.pdf-watermark.pageCount', { count: pageCount }) }}
      </p>

      <div class="d-flex flex-wrap ga-6 mt-2">
        <div class="controls-col">
          <v-text-field
            v-model="text"
            :label="t('tools.pdf-watermark.text')"
            class="mt-2"
            density="comfortable"
            hide-details
          />

          <v-row class="mt-2" density="comfortable">
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="fontSize"
                :label="t('tools.pdf-watermark.fontSize')"
                type="number"
                min="1"
                density="comfortable"
                hide-details
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="color"
                :label="t('tools.pdf-watermark.color')"
                type="color"
                density="comfortable"
                hide-details
              />
            </v-col>
          </v-row>

          <div class="mt-4">
            <label class="text-body-2 text-medium-emphasis">
              {{ t('tools.pdf-watermark.opacity') }}: {{ opacity.toFixed(2) }}
            </label>
            <v-slider v-model="opacity" :min="0" :max="1" :step="0.05" hide-details density="compact" />
          </div>

          <div class="mt-2">
            <label class="text-body-2 text-medium-emphasis">
              {{ t('tools.pdf-watermark.rotation') }}: {{ rotation }}°
            </label>
            <v-slider v-model="rotation" :min="-180" :max="180" :step="1" hide-details density="compact" />
          </div>

          <div class="mt-4">
            <label class="text-body-2 text-medium-emphasis d-block mb-2">
              {{ t('tools.pdf-watermark.layout') }}
            </label>
            <v-btn-toggle v-model="layout" mandatory color="primary" density="comfortable" variant="outlined">
              <v-btn v-for="l in LAYOUTS" :key="l" :value="l">{{ t(`tools.pdf-watermark.${l}`) }}</v-btn>
            </v-btn-toggle>
          </div>
        </div>

        <div class="preview-col">
          <div class="d-flex align-center ga-1 mb-2">
            <span class="text-caption text-medium-emphasis">{{ T('preview', { n: previewPage }) }}</span>
            <v-spacer />
            <template v-if="pageCount > 1">
              <v-btn icon="mdi-chevron-left" size="x-small" variant="text" :disabled="previewPage <= 1" @click="previewPage--" />
              <span class="text-caption tabular-nums">{{ previewPage }} / {{ pageCount }}</span>
              <v-btn icon="mdi-chevron-right" size="x-small" variant="text" :disabled="previewPage >= pageCount" @click="previewPage++" />
            </template>
          </div>
          <div class="preview-wrap" :class="{ 'preview-wrap--busy': previewBusy }">
            <canvas ref="previewCanvas" class="preview-canvas" />
            <canvas ref="overlayCanvas" class="preview-overlay" />
            <v-progress-circular v-if="previewBusy" indeterminate size="28" class="preview-spinner" />
          </div>
          <div class="text-caption text-medium-emphasis mt-1">{{ T('previewHint') }}</div>
        </div>
      </div>

      <v-btn
        class="mt-6"
        color="primary"
        :loading="busy"
        :disabled="!text"
        prepend-icon="mdi-watermark"
        @click="apply"
      >
        {{ busy ? t('tools.pdf-watermark.applying') : t('tools.pdf-watermark.apply') }}
      </v-btn>
    </template>
  </ToolShell>
</template>

<style scoped>
.controls-col {
  flex: 1 1 300px;
  min-width: 260px;
}
.preview-col {
  flex: 1 1 320px;
  min-width: 260px;
  max-width: 560px;
}
.preview-wrap {
  position: relative;
  display: inline-block;
  max-width: 100%;
  line-height: 0;
  border: 1px solid rgba(var(--v-border-color), 0.3);
  border-radius: 4px;
  overflow: hidden;
  background: rgba(var(--v-border-color), 0.06);
  min-height: 120px;
}
.preview-canvas {
  display: block;
  max-width: 100%;
  height: auto;
}
.preview-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.preview-wrap--busy .preview-canvas {
  opacity: 0.4;
}
.preview-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
