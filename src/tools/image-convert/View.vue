<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'
import { isBoolean, isNumber, oneOf, useStoredRef } from '@/composables/useStoredRef'
import { canvasToBlob, extensionForMime, loadImage } from '@/utils/image'
import { downloadBlob } from '@/utils/download'
import { formatBytes, stripExtension } from '@/utils/format'

const TOOL_ID = 'image-convert'
const { t } = useI18n()
const T = (key: string, args?: Record<string, unknown>) => t(`tools.${TOOL_ID}.${key}`, args ?? {})

type Format = 'image/png' | 'image/jpeg' | 'image/webp'
const FORMATS = ['image/png', 'image/jpeg', 'image/webp'] as const

const sourceFile = ref<File | null>(null)
const sourceUrl = ref('')
const sourceDims = ref<{ w: number; h: number } | null>(null)
// Decoded once per file; every conversion draws from it instead of
// re-decoding. Kept out of Vue's reactivity on purpose.
let sourceImg: HTMLImageElement | null = null

// Options are remembered between visits; the file itself never is.
const targetFormat = useStoredRef<Format>('image-convert.targetFormat', 'image/jpeg', oneOf(FORMATS))
const quality = useStoredRef('image-convert.quality', 0.85, isNumber)
const useCompress = useStoredRef('image-convert.useCompress', false, isBoolean)
const maxSizeMB = useStoredRef('image-convert.maxSizeMB', 1, isNumber)

const busy = ref(false)
const error = ref('')

const resultUrl = ref('')
const resultBlob = ref<Blob | null>(null)
const resultDims = ref<{ w: number; h: number } | null>(null)

const formats = [
  { title: 'PNG', value: 'image/png' },
  { title: 'JPEG', value: 'image/jpeg' },
  { title: 'WEBP', value: 'image/webp' },
]

const hasQuality = computed(() => targetFormat.value !== 'image/png')
const ext = computed(() => extensionForMime(targetFormat.value))
const downloadName = computed(() =>
  sourceFile.value ? `${stripExtension(sourceFile.value.name)}.${ext.value}` : `converted.${ext.value}`,
)
const reduction = computed(() =>
  sourceFile.value && resultBlob.value && sourceFile.value.size > 0
    ? Math.round((1 - resultBlob.value.size / sourceFile.value.size) * 100)
    : 0,
)

// Conversions are async and can overlap (drop a file, then nudge the quality
// slider): each run takes a ticket and only the latest one may publish.
let runId = 0
let timer: ReturnType<typeof setTimeout> | undefined

function revokeResult() {
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  resultUrl.value = ''
  resultBlob.value = null
  resultDims.value = null
}

function revokeSource() {
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
  sourceUrl.value = ''
  sourceImg = null
}

async function onFiles(files: File[]) {
  const file = files[0]
  if (!file) return
  runId++
  clearTimeout(timer)
  error.value = ''
  busy.value = false
  revokeResult()
  revokeSource()
  sourceFile.value = file
  sourceUrl.value = URL.createObjectURL(file)
  const url = sourceUrl.value
  try {
    const img = await loadImage(url)
    if (url !== sourceUrl.value) return // another file arrived meanwhile
    sourceImg = img
    sourceDims.value = { w: img.naturalWidth, h: img.naturalHeight }
  } catch {
    if (url !== sourceUrl.value) return
    error.value = T('errLoad')
    sourceDims.value = null
    return
  }
  // Show a result straight away; the button stays as a manual re-run.
  await convert()
}

function drawScaled(img: HTMLImageElement, scale: number, background?: string): HTMLCanvasElement {
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('ctx')
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, w, h)
  }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  return canvas
}

// JPEG has no alpha channel; composite transparency over white instead of the
// encoder's default black.
const jpegBg = (type: string) => (type === 'image/jpeg' ? '#ffffff' : undefined)

// Native, dependency-free "compress to target size": lower the quality first,
// then progressively downscale until the encoded blob fits under maxBytes.
async function compressToTarget(
  img: HTMLImageElement,
  type: Format,
  initialQuality: number,
  maxBytes: number,
): Promise<Blob> {
  let scale = 1
  let smallest: Blob | null = null
  for (let attempt = 0; attempt < 12; attempt++) {
    const canvas = drawScaled(img, scale, jpegBg(type))
    let q = initialQuality
    do {
      const blob = await canvasToBlob(canvas, type, q)
      if (!smallest || blob.size < smallest.size) smallest = blob
      if (blob.size <= maxBytes) return blob
      q -= 0.1
    } while (type !== 'image/png' && q >= 0.3)
    scale *= 0.8
    if (scale < 0.08) break
  }
  return smallest as Blob
}

async function convert() {
  const img = sourceImg
  if (!img) return
  const id = ++runId
  error.value = ''
  busy.value = true
  try {
    const canvas = drawScaled(img, 1, jpegBg(targetFormat.value))
    let blob = await canvasToBlob(canvas, targetFormat.value, quality.value)

    // Ignore an empty/invalid size target instead of chasing NaN through
    // every downscale pass.
    const maxMB = Number(maxSizeMB.value)
    if (useCompress.value && Number.isFinite(maxMB) && maxMB > 0) {
      blob = await compressToTarget(img, targetFormat.value, quality.value, maxMB * 1024 * 1024)
    }

    const url = URL.createObjectURL(blob)
    let out: HTMLImageElement
    try {
      out = await loadImage(url)
    } catch (e) {
      URL.revokeObjectURL(url)
      throw e
    }
    if (id !== runId) {
      URL.revokeObjectURL(url)
      return
    }
    revokeResult()
    resultBlob.value = blob
    resultUrl.value = url
    resultDims.value = { w: out.naturalWidth, h: out.naturalHeight }
  } catch {
    if (id === runId) error.value = T('errConvert')
  } finally {
    if (id === runId) busy.value = false
  }
}

function scheduleConvert() {
  clearTimeout(timer)
  timer = setTimeout(() => void convert(), 300)
}

// Re-convert as the options change so the preview always matches them.
watch([targetFormat, quality, useCompress, maxSizeMB], () => {
  if (sourceImg) scheduleConvert()
})

function download() {
  if (resultBlob.value) downloadBlob(resultBlob.value, downloadName.value)
}

onUnmounted(() => {
  clearTimeout(timer)
  runId++
  revokeResult()
  revokeSource()
})
</script>

<template>
  <ToolShell>
    <FileDrop accept="image/*" :hint="T('uploadHint')" @files="onFiles" />

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-4">{{ error }}</v-alert>

    <template v-if="sourceUrl">
      <v-row density="comfortable" class="mt-2" align="center">
        <v-col cols="12" sm="6">
          <v-select
            v-model="targetFormat"
            :items="formats"
            :label="T('targetFormat')"
            hide-details
            density="comfortable"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-checkbox v-model="useCompress" :label="T('compress')" hide-details density="compact" />
        </v-col>
      </v-row>

      <div v-if="hasQuality" class="mt-3">
        <div class="text-body-2 mb-1">{{ T('quality') }}: {{ quality.toFixed(2) }}</div>
        <v-slider v-model="quality" :min="0.1" :max="1" :step="0.05" hide-details />
      </div>

      <div v-if="useCompress" class="mt-3" style="max-width: 280px">
        <v-text-field
          v-model.number="maxSizeMB"
          type="number"
          :min="0.1"
          :step="0.1"
          :label="T('maxSize')"
          hide-details
          density="comfortable"
        />
      </div>

      <div class="d-flex ga-2 mt-4">
        <v-btn color="primary" :loading="busy" prepend-icon="mdi-image-sync" @click="convert">
          {{ T('convert') }}
        </v-btn>
      </div>

      <v-row density="comfortable" class="mt-2">
        <v-col cols="12" sm="6">
          <v-card variant="tonal" rounded="lg" class="h-100">
            <v-card-title class="text-subtitle-2">{{ T('original') }}</v-card-title>
            <v-card-text>
              <img :src="sourceUrl" class="preview rounded mb-2" alt="" />
              <div v-if="sourceDims" class="text-body-2 text-medium-emphasis tabular-nums">
                {{ T('dimensions') }}: {{ sourceDims.w }} × {{ sourceDims.h }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6">
          <v-card variant="outlined" rounded="lg" class="h-100">
            <v-card-title class="text-subtitle-2">{{ T('result') }}</v-card-title>
            <v-card-text v-if="resultBlob">
              <img :src="resultUrl" class="preview rounded mb-2" alt="" />
              <div v-if="resultDims" class="text-body-2 text-medium-emphasis tabular-nums">
                {{ T('dimensions') }}: {{ resultDims.w }} × {{ resultDims.h }}
              </div>
              <div class="d-flex align-center flex-wrap ga-2 mt-1">
                <span v-if="sourceFile" class="text-body-2 text-medium-emphasis text-decoration-line-through">
                  {{ formatBytes(sourceFile.size) }}
                </span>
                <v-icon icon="mdi-arrow-right" size="16" class="text-medium-emphasis" />
                <span class="text-subtitle-1 font-weight-bold">{{ formatBytes(resultBlob.size) }}</span>
                <v-chip
                  :color="reduction > 0 ? 'success' : reduction < 0 ? 'error' : undefined"
                  variant="flat"
                  size="small"
                  label
                >
                  {{ reduction >= 0 ? T('smaller', { percent: reduction }) : T('larger', { percent: -reduction }) }}
                </v-chip>
              </div>
              <v-btn class="mt-3" color="primary" prepend-icon="mdi-download" @click="download">
                {{ T('download') }}
              </v-btn>
              <div class="text-caption text-medium-emphasis mt-1 break-all">{{ downloadName }}</div>
            </v-card-text>
            <v-card-text v-else class="d-flex align-center ga-2 text-body-2 text-medium-emphasis">
              <v-progress-circular v-if="busy" indeterminate size="18" width="2" />
              {{ busy ? T('converting') : t('common.noOutput') }}
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </ToolShell>
</template>

<style scoped>
.preview {
  max-width: 100%;
  max-height: 240px;
  display: block;
}
</style>
