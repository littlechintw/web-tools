<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'
import { isBoolean, isNumber, oneOf, useStoredRef } from '@/composables/useStoredRef'
import {
  LAYOUTS,
  OUTPUT_FORMATS,
  POSITIONS,
  outputName,
  pctToPx,
  resolveOutputType,
  type Layout,
  type OutputFormat,
  type Position,
} from '@/lib/watermark'
import { drawWatermark, renderWatermarked, type WatermarkOptions } from '@/lib/watermarkBrowser'
import { downloadBlob } from '@/utils/download'
import { formatBytes } from '@/utils/format'
import { canvasToBlob, loadImage } from '@/utils/image'
import { createZip } from '@/utils/zip'

const TOOL_ID = 'image-watermark'
const { t } = useI18n()
const T = (key: string, args?: Record<string, unknown>) => t(`tools.${TOOL_ID}.${key}`, args ?? {})

interface Item {
  id: number
  file: File
  url: string
  img: HTMLImageElement
  w: number
  h: number
}
interface Logo {
  url: string
  img: HTMLImageElement
  name: string
}

const MODES = ['text', 'image'] as const
type Mode = (typeof MODES)[number]

const between = (min: number, max: number) => (v: unknown): v is number => isNumber(v) && v >= min && v <= max
const isHexColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
const isString = (v: unknown): v is string => typeof v === 'string'

// Canvas uses whatever is installed; each entry ends in a generic family so
// a missing font degrades gracefully instead of silently changing to Times.
const FONTS: Array<{ value: string; label?: string; key?: string }> = [
  { value: 'sans-serif', key: 'fontSans' },
  { value: 'serif', key: 'fontSerif' },
  { value: 'monospace', key: 'fontMono' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { value: 'Impact, "Arial Black", sans-serif', label: 'Impact' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
  { value: '"Courier New", Courier, monospace', label: 'Courier New' },
  { value: '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif', label: 'Noto Sans TC' },
]
const FONT_VALUES = FONTS.map((f) => f.value)
const fontItems = computed(() => FONTS.map((f) => ({ title: f.key ? T(f.key) : (f.label ?? f.value), value: f.value })))

const POS_ICONS: Record<Position, string> = {
  'top-left': 'mdi-arrow-top-left',
  top: 'mdi-arrow-up',
  'top-right': 'mdi-arrow-top-right',
  left: 'mdi-arrow-left',
  center: 'mdi-circle-medium',
  right: 'mdi-arrow-right',
  'bottom-left': 'mdi-arrow-bottom-left',
  bottom: 'mdi-arrow-down',
  'bottom-right': 'mdi-arrow-bottom-right',
}

// ---------------------------------------------------------------------------
// Sources. Images are decoded once on arrival; the array is swapped rather
// than mutated so the (non-reactive) HTMLImageElements stay untouched.
const items = shallowRef<Item[]>([])
const current = ref(0)
const currentItem = computed(() => items.value[current.value] ?? null)
const logo = shallowRef<Logo | null>(null)
let nextId = 0

// Settings are remembered between visits, including the text: a watermark is
// the same brand or name every time, so it behaves like an option rather
// than input. The images and the logo file never are.
const mode = useStoredRef<Mode>('image-watermark.mode', 'text', oneOf(MODES))
const text = useStoredRef('image-watermark.text', 'CONFIDENTIAL', isString)
const fontFamily = useStoredRef('image-watermark.font', 'sans-serif', oneOf(FONT_VALUES))
const bold = useStoredRef('image-watermark.bold', true, isBoolean)
const color = useStoredRef('image-watermark.color', '#ff0000', isHexColor)
const textSize = useStoredRef('image-watermark.textSize', 6, between(1, 40))
const logoSize = useStoredRef('image-watermark.logoSize', 20, between(2, 80))
const opacity = useStoredRef('image-watermark.opacity', 0.4, between(0, 1))
const angle = useStoredRef('image-watermark.angle', 30, between(-90, 90))
const layout = useStoredRef<Layout>('image-watermark.layout', 'tile', oneOf(LAYOUTS))
const position = useStoredRef<Position>('image-watermark.position', 'bottom-right', oneOf(POSITIONS))
const gap = useStoredRef('image-watermark.gap', 12, between(0, 100))
const margin = useStoredRef('image-watermark.margin', 3, between(0, 25))
const outputFormat = useStoredRef<OutputFormat>('image-watermark.format', 'auto', oneOf(OUTPUT_FORMATS))
const quality = useStoredRef('image-watermark.quality', 0.92, between(0.1, 1))

const error = ref('')
const success = ref('')

const formatItems = computed(() => [
  { title: T('formatAuto'), value: 'auto' },
  { title: 'PNG', value: 'image/png' },
  { title: 'JPEG', value: 'image/jpeg' },
  { title: 'WEBP', value: 'image/webp' },
])
const resolvedType = computed(() =>
  resolveOutputType(currentItem.value?.file.type ?? 'image/png', outputFormat.value),
)
const hasQuality = computed(() => resolvedType.value !== 'image/png')

/** Everything the renderer needs, or null while the mark is empty. */
const markOptions = computed<WatermarkOptions | null>(() => {
  const mark =
    mode.value === 'text'
      ? text.value.trim()
        ? {
            kind: 'text' as const,
            text: text.value,
            fontFamily: fontFamily.value,
            bold: bold.value,
            color: color.value,
            sizePct: textSize.value,
          }
        : null
      : logo.value
        ? { kind: 'image' as const, image: logo.value.img, sizePct: logoSize.value }
        : null
  if (!mark) return null
  return {
    mark,
    opacity: opacity.value,
    angle: angle.value,
    layout: layout.value,
    position: position.value,
    gapPct: gap.value,
    marginPct: margin.value,
  }
})
const markMissing = computed(() => markOptions.value === null)
const sizePct = computed(() => (mode.value === 'text' ? textSize.value : logoSize.value))
const sizePx = computed(() => (currentItem.value ? pctToPx(sizePct.value, currentItem.value.w) : 0))

// ---------------------------------------------------------------------------
// Live preview: the current image downscaled to the canvas, watermarked with
// the exact same code path the export uses (all sizes are relative).
const previewCanvas = ref<HTMLCanvasElement | null>(null)
const PREVIEW_MAX = 1400

function drawPreview() {
  const canvas = previewCanvas.value
  const item = currentItem.value
  const opts = markOptions.value
  if (!canvas || !item) return
  const scale = Math.min(1, PREVIEW_MAX / Math.max(item.w, item.h))
  const w = Math.max(1, Math.round(item.w * scale))
  const h = Math.max(1, Math.round(item.h * scale))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(item.img, 0, 0, w, h)
  if (opts) drawWatermark(ctx, w, h, opts)
}
// Tracks every setting the drawing reads; runs after the DOM has the canvas.
watchEffect(drawPreview, { flush: 'post' })
watch(markOptions, () => (success.value = ''))

// ---------------------------------------------------------------------------
async function addFiles(files: File[]) {
  const added: Item[] = []
  const failed: string[] = []
  for (const file of files) {
    const url = URL.createObjectURL(file)
    try {
      const img = await loadImage(url)
      added.push({ id: nextId++, file, url, img, w: img.naturalWidth, h: img.naturalHeight })
    } catch {
      URL.revokeObjectURL(url)
      failed.push(file.name)
    }
  }
  if (added.length) {
    const firstNew = items.value.length
    items.value = [...items.value, ...added]
    current.value = firstNew
  }
  error.value = failed.length ? T('loadFailed', { names: failed.join(', ') }) : ''
  success.value = ''
}

function removeAt(i: number) {
  const item = items.value[i]
  if (!item) return
  URL.revokeObjectURL(item.url)
  items.value = items.value.filter((_, idx) => idx !== i)
  if (current.value > i || current.value >= items.value.length) current.value = Math.max(0, current.value - 1)
}

function clearAll() {
  items.value.forEach((it) => URL.revokeObjectURL(it.url))
  items.value = []
  current.value = 0
  success.value = ''
}

async function onLogo(files: File[]) {
  const file = files[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    if (logo.value) URL.revokeObjectURL(logo.value.url)
    logo.value = { url, img, name: file.name }
    error.value = ''
  } catch {
    URL.revokeObjectURL(url)
    error.value = T('loadFailed', { names: file.name })
  }
}

function removeLogo() {
  if (logo.value) URL.revokeObjectURL(logo.value.url)
  logo.value = null
}

// ---------------------------------------------------------------------------
// Export at full resolution. Each image is encoded in turn so the progress
// text can paint and a cancel can land between them.
const exporting = ref(false)
const progress = ref({ done: 0, total: 0 })
let exportSeq = 0

async function renderItem(item: Item, opts: WatermarkOptions): Promise<{ blob: Blob; name: string }> {
  const type = resolveOutputType(item.file.type, outputFormat.value)
  // JPEG has no alpha: composite transparent sources over white, not black.
  const canvas = renderWatermarked(item.img, 1, opts, type === 'image/jpeg' ? '#ffffff' : undefined)
  const blob = await canvasToBlob(canvas, type, quality.value)
  canvas.width = canvas.height = 0 // release the full-size bitmap promptly
  return { blob, name: outputName(item.file.name, type) }
}

async function exportItems(list: Item[]): Promise<Array<{ blob: Blob; name: string }> | null> {
  const opts = markOptions.value
  if (!opts || !list.length || exporting.value) return null
  const seq = ++exportSeq
  exporting.value = true
  progress.value = { done: 0, total: list.length }
  error.value = ''
  success.value = ''
  const out: Array<{ blob: Blob; name: string }> = []
  try {
    for (const item of list) {
      await new Promise((r) => setTimeout(r, 0))
      if (seq !== exportSeq) return null
      out.push(await renderItem(item, opts))
      progress.value = { done: out.length, total: list.length }
    }
    return out
  } catch (e) {
    if (seq === exportSeq) error.value = (e as Error).message
    return null
  } finally {
    if (seq === exportSeq) exporting.value = false
  }
}

function cancelExport() {
  exportSeq++
  exporting.value = false
}

async function downloadCurrent() {
  const item = currentItem.value
  if (!item) return
  const out = await exportItems([item])
  const first = out?.[0]
  if (!first) return
  downloadBlob(first.blob, first.name)
  success.value = T('downloaded', { name: first.name })
}

async function downloadAll() {
  const out = await exportItems(items.value)
  if (!out) return
  // Two sources called photo.jpg must not collide inside the archive.
  const seen = new Map<string, number>()
  const entries = out.map(({ blob, name }) => {
    const n = (seen.get(name) ?? 0) + 1
    seen.set(name, n)
    return { name: n === 1 ? name : name.replace(/(\.[^.]+)$/, `-${n}$1`), data: blob }
  })
  const zipName = `watermarked-${entries.length}.zip`
  downloadBlob(await createZip(entries), zipName)
  success.value = T('downloadedZip', { count: entries.length, name: zipName })
}

onUnmounted(() => {
  exportSeq++
  items.value.forEach((it) => URL.revokeObjectURL(it.url))
  if (logo.value) URL.revokeObjectURL(logo.value.url)
})
</script>

<template>
  <ToolShell :max-width="1200">
    <FileDrop
      accept="image/*"
      multiple
      :hint="items.length ? T('addMore') : T('dropHint')"
      :show-selected="false"
      :compact="items.length > 0"
      @files="addFiles"
    />

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-4">
      {{ error }}
    </v-alert>

    <p v-if="!items.length" class="text-medium-emphasis text-body-2 mt-4">{{ T('noImages') }}</p>

    <div v-else class="d-flex flex-wrap ga-6 mt-4">
      <!-- Preview + image strip -->
      <div class="preview-col">
        <div v-if="currentItem" class="d-flex align-center ga-2 mb-2">
          <div class="flex-grow-1 min-w-0">
            <div class="text-subtitle-2 text-truncate">{{ currentItem.file.name }}</div>
            <div class="text-caption text-medium-emphasis tabular-nums">
              {{ currentItem.w }} × {{ currentItem.h }} · {{ formatBytes(currentItem.file.size) }}
              <span v-if="items.length > 1"> · {{ T('imageIndex', { n: current + 1, total: items.length }) }}</span>
            </div>
          </div>
          <v-btn
            v-if="items.length > 1"
            size="small"
            variant="text"
            color="error"
            prepend-icon="mdi-delete-sweep"
            @click="clearAll"
          >
            {{ T('clearAll') }}
          </v-btn>
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            :title="T('removeImage')"
            :aria-label="T('removeImage')"
            @click="removeAt(current)"
          />
        </div>

        <div class="preview-wrap">
          <canvas ref="previewCanvas" class="preview-canvas" />
          <div v-if="markMissing" class="preview-note">
            <v-chip color="warning" variant="elevated" size="small" prepend-icon="mdi-alert-circle-outline">
              {{ mode === 'text' ? T('emptyText') : T('logoMissing') }}
            </v-chip>
          </div>
        </div>
        <div class="text-caption text-medium-emphasis mt-1">{{ T('previewHint') }}</div>

        <div v-if="items.length > 1" class="thumbs mt-3">
          <div v-for="(it, i) in items" :key="it.id" class="thumb" :class="{ 'thumb--active': i === current }">
            <button type="button" class="thumb__pick" :title="it.file.name" :aria-pressed="i === current" @click="current = i">
              <img :src="it.url" alt="" />
            </button>
            <v-btn
              icon="mdi-close"
              size="x-small"
              variant="flat"
              class="thumb__remove"
              :title="T('removeImage')"
              :aria-label="T('removeImage')"
              @click.stop="removeAt(i)"
            />
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="controls-col">
        <v-btn-toggle v-model="mode" mandatory divided color="primary" variant="outlined" density="comfortable" class="mode-toggle">
          <v-btn value="text" prepend-icon="mdi-format-text" class="flex-grow-1">{{ T('modeText') }}</v-btn>
          <v-btn value="image" prepend-icon="mdi-image-outline" class="flex-grow-1">{{ T('modeImage') }}</v-btn>
        </v-btn-toggle>

        <template v-if="mode === 'text'">
          <v-textarea
            v-model="text"
            :label="T('text')"
            :hint="T('textHint')"
            rows="1"
            auto-grow
            density="comfortable"
            persistent-hint
            class="mt-4"
          />
          <v-row density="comfortable" class="mt-3">
            <v-col cols="8">
              <v-select v-model="fontFamily" :items="fontItems" :label="T('font')" density="comfortable" hide-details />
            </v-col>
            <v-col cols="4">
              <v-text-field v-model="color" type="color" :label="T('color')" density="comfortable" hide-details />
            </v-col>
          </v-row>
          <v-checkbox v-model="bold" :label="T('bold')" density="compact" hide-details />
        </template>

        <template v-else>
          <div class="text-body-2 text-medium-emphasis mt-4 mb-1">{{ T('logo') }}</div>
          <FileDrop accept="image/*" compact :paste="false" :hint="T('logoDrop')" :show-selected="false" @files="onLogo" />
          <div v-if="logo" class="d-flex align-center ga-3 mt-2">
            <img :src="logo.url" alt="" class="logo-thumb" />
            <div class="flex-grow-1 min-w-0 text-body-2 text-truncate">{{ logo.name }}</div>
            <v-btn size="small" variant="text" color="error" @click="removeLogo">{{ T('removeLogo') }}</v-btn>
          </div>
        </template>

        <div class="mt-4">
          <div class="d-flex justify-space-between text-body-2">
            <span>{{ T('size') }}</span>
            <span class="tabular-nums">{{ sizePct }}%</span>
          </div>
          <v-slider
            v-if="mode === 'text'"
            v-model="textSize"
            :min="1"
            :max="40"
            :step="0.5"
            hide-details
            density="compact"
          />
          <v-slider v-else v-model="logoSize" :min="2" :max="80" :step="1" hide-details density="compact" />
          <div class="text-caption text-medium-emphasis">{{ T('sizeHint', { px: sizePx, pct: sizePct }) }}</div>
        </div>

        <div class="mt-3">
          <div class="d-flex justify-space-between text-body-2">
            <span>{{ T('opacity') }}</span>
            <span class="tabular-nums">{{ Math.round(opacity * 100) }}%</span>
          </div>
          <v-slider v-model="opacity" :min="0" :max="1" :step="0.05" hide-details density="compact" />
        </div>

        <div class="mt-3">
          <div class="d-flex justify-space-between text-body-2">
            <span>{{ T('angle') }}</span>
            <span class="tabular-nums">{{ angle }}°</span>
          </div>
          <v-slider v-model="angle" :min="-90" :max="90" :step="1" hide-details density="compact" />
        </div>

        <div class="mt-3">
          <div class="text-body-2 mb-2">{{ T('layout') }}</div>
          <v-btn-toggle v-model="layout" mandatory divided color="primary" variant="outlined" density="comfortable">
            <v-btn value="tile" prepend-icon="mdi-view-grid-outline">{{ T('tile') }}</v-btn>
            <v-btn value="single" prepend-icon="mdi-crop-free">{{ T('single') }}</v-btn>
          </v-btn-toggle>
        </div>

        <div v-if="layout === 'tile'" class="mt-3">
          <div class="d-flex justify-space-between text-body-2">
            <span>{{ T('gap') }}</span>
            <span class="tabular-nums">{{ gap }}%</span>
          </div>
          <v-slider v-model="gap" :min="0" :max="100" :step="1" hide-details density="compact" />
        </div>

        <template v-else>
          <div class="mt-3">
            <div class="text-body-2 mb-2">{{ T('position') }}</div>
            <div class="pos-grid">
              <v-btn
                v-for="p in POSITIONS"
                :key="p"
                :icon="POS_ICONS[p]"
                size="small"
                color="primary"
                :variant="position === p ? 'flat' : 'tonal'"
                :title="T(`pos.${p}`)"
                :aria-label="T(`pos.${p}`)"
                :aria-pressed="position === p"
                @click="position = p"
              />
            </div>
          </div>
          <div class="mt-3">
            <div class="d-flex justify-space-between text-body-2">
              <span>{{ T('margin') }}</span>
              <span class="tabular-nums">{{ margin }}%</span>
            </div>
            <v-slider v-model="margin" :min="0" :max="25" :step="0.5" hide-details density="compact" />
          </div>
        </template>

        <v-divider class="my-4" />

        <v-row density="comfortable">
          <v-col cols="12" :sm="hasQuality ? 6 : 12">
            <v-select v-model="outputFormat" :items="formatItems" :label="T('format')" density="comfortable" hide-details />
          </v-col>
          <v-col v-if="hasQuality" cols="12" sm="6">
            <div class="d-flex justify-space-between text-body-2">
              <span>{{ T('quality') }}</span>
              <span class="tabular-nums">{{ Math.round(quality * 100) }}%</span>
            </div>
            <v-slider v-model="quality" :min="0.1" :max="1" :step="0.05" hide-details density="compact" />
          </v-col>
        </v-row>

        <v-btn
          block
          color="primary"
          size="large"
          class="mt-4"
          :loading="exporting"
          :disabled="markMissing"
          prepend-icon="mdi-download"
          @click="downloadCurrent"
        >
          {{ T('download') }}
        </v-btn>
        <v-btn
          v-if="items.length > 1"
          block
          variant="tonal"
          color="primary"
          class="mt-2"
          :disabled="markMissing || exporting"
          prepend-icon="mdi-folder-zip-outline"
          @click="downloadAll"
        >
          {{ T('downloadAll') }}
        </v-btn>

        <div v-if="exporting" class="d-flex align-center ga-2 mt-3">
          <v-progress-linear
            :model-value="progress.total ? (progress.done / progress.total) * 100 : 0"
            rounded
            height="6"
            class="flex-grow-1"
          />
          <span class="text-caption text-medium-emphasis tabular-nums text-no-wrap">
            {{ T('exporting', progress) }}
          </span>
          <v-btn size="x-small" variant="text" @click="cancelExport">{{ t('common.cancel') }}</v-btn>
        </div>

        <v-alert v-if="success" type="success" variant="tonal" density="compact" class="mt-3">
          {{ success }}
        </v-alert>
      </div>
    </div>
  </ToolShell>
</template>

<style scoped>
.preview-col {
  flex: 1 1 420px;
  min-width: 0;
}
.controls-col {
  flex: 1 1 320px;
  max-width: 400px;
}
.min-w-0 {
  min-width: 0;
}
.mode-toggle {
  width: 100%;
}
.mode-toggle :deep(.v-btn) {
  flex: 1 1 0;
}
.preview-wrap {
  position: relative;
  line-height: 0;
  border: 1px solid rgba(var(--v-border-color), 0.3);
  border-radius: 8px;
  overflow: hidden;
  /* Checkerboard so transparent sources read as transparent. */
  background-color: rgba(var(--v-theme-on-surface), 0.04);
  background-image:
    linear-gradient(45deg, rgba(var(--v-theme-on-surface), 0.06) 25%, transparent 25%, transparent 75%, rgba(var(--v-theme-on-surface), 0.06) 75%),
    linear-gradient(45deg, rgba(var(--v-theme-on-surface), 0.06) 25%, transparent 25%, transparent 75%, rgba(var(--v-theme-on-surface), 0.06) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 8px 8px;
}
.preview-canvas {
  display: block;
  max-width: 100%;
  max-height: 70vh;
  width: auto;
  height: auto;
  margin: 0 auto;
}
.preview-note {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  line-height: normal;
}
.thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.thumb {
  position: relative;
  width: 72px;
  height: 72px;
}
.thumb__pick {
  width: 100%;
  height: 100%;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(var(--v-theme-on-surface), 0.06);
  cursor: pointer;
}
.thumb__pick img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.thumb--active .thumb__pick {
  border-color: rgb(var(--v-theme-primary));
}
.thumb__pick:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
.thumb__remove {
  position: absolute;
  top: -8px;
  right: -8px;
}
.logo-thumb {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: 6px;
  background: rgba(var(--v-theme-on-surface), 0.06);
}
.pos-grid {
  display: grid;
  grid-template-columns: repeat(3, 40px);
  gap: 6px;
}
</style>
