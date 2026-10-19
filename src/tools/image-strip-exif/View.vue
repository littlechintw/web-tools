<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'
import { isNumber, oneOf, useStoredRef } from '@/composables/useStoredRef'
import { canvasToBlob, extensionForMime, loadImage } from '@/utils/image'
import { downloadBlob } from '@/utils/download'
import { formatBytes, stripExtension } from '@/utils/format'

const TOOL_ID = 'image-strip-exif'
const { t } = useI18n()
const T = (key: string, args?: Record<string, unknown>) => t(`tools.${TOOL_ID}.${key}`, args ?? {})

type OutFormat = 'image/jpeg' | 'image/png'
type ExifState = 'found' | 'notFound' | 'na'

const sourceFile = ref<File | null>(null)
const sourceUrl = ref('')
const sourceDims = ref<{ w: number; h: number } | null>(null)
// Decoded once per file and reused by every re-encode.
let sourceImg: HTMLImageElement | null = null

// Options are remembered between visits.
const outputFormat = useStoredRef<OutFormat>('image-strip-exif.outputFormat', 'image/jpeg', oneOf(['image/jpeg', 'image/png']))
const quality = useStoredRef('image-strip-exif.quality', 0.92, isNumber)

const cleanedUrl = ref('')
const cleanedBlob = ref<Blob | null>(null)
const cleanedDims = ref<{ w: number; h: number } | null>(null)

const exifState = ref<ExifState>('na')
const busy = ref(false)
const error = ref('')

const formats = [
  { title: 'JPEG', value: 'image/jpeg' },
  { title: 'PNG', value: 'image/png' },
]

const hasQuality = computed(() => outputFormat.value === 'image/jpeg')
const downloadName = computed(() => {
  const ext = extensionForMime(outputFormat.value)
  return sourceFile.value ? `${stripExtension(sourceFile.value.name)}-clean.${ext}` : `cleaned.${ext}`
})
const reduction = computed(() =>
  sourceFile.value && cleanedBlob.value && sourceFile.value.size > 0
    ? Math.round((1 - cleanedBlob.value.size / sourceFile.value.size) * 100)
    : 0,
)

const exifMessage = computed(() => {
  if (exifState.value === 'found') return T('exifFound')
  if (exifState.value === 'notFound') return T('exifNotFound')
  return T('exifNA')
})
const exifAlertType = computed(() => (exifState.value === 'found' ? 'warning' : 'info'))

// Runs can overlap (drop, then change the format): only the latest publishes.
let runId = 0
let timer: ReturnType<typeof setTimeout> | undefined

function revokeSource() {
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
  sourceUrl.value = ''
  sourceImg = null
}

function revokeCleaned() {
  if (cleanedUrl.value) URL.revokeObjectURL(cleanedUrl.value)
  cleanedUrl.value = ''
  cleanedBlob.value = null
  cleanedDims.value = null
}

// Light scan of JPEG bytes for an APP1 segment whose payload begins with "Exif".
// JPEG markers: 0xFFD8 (SOI), then segments 0xFFxx with a 2-byte big-endian
// length. We walk the markers until SOS (0xFFDA) / EOI, checking APP1 (0xFFE1).
function scanJpegForExif(buf: ArrayBuffer): boolean {
  const view = new DataView(buf)
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return false
  let offset = 2
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break
    const marker = view.getUint8(offset + 1)
    // Standalone markers without a length payload.
    if (marker === 0xd9 || marker === 0xda) break
    const len = view.getUint16(offset + 2)
    if (len < 2) break
    if (marker === 0xe1) {
      // APP1: check for the "Exif\0\0" identifier.
      const start = offset + 4
      if (
        start + 4 <= view.byteLength &&
        view.getUint8(start) === 0x45 && // E
        view.getUint8(start + 1) === 0x78 && // x
        view.getUint8(start + 2) === 0x69 && // i
        view.getUint8(start + 3) === 0x66 // f
      ) {
        return true
      }
    }
    offset += 2 + len
  }
  return false
}

async function onFiles(files: File[]) {
  const file = files[0]
  if (!file) return
  runId++
  clearTimeout(timer)
  error.value = ''
  busy.value = false
  revokeCleaned()
  revokeSource()
  sourceFile.value = file
  sourceUrl.value = URL.createObjectURL(file)
  const url = sourceUrl.value

  // Detect EXIF for JPEG inputs.
  const isJpeg = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)
  if (isJpeg) {
    try {
      const buf = await file.arrayBuffer()
      exifState.value = scanJpegForExif(buf) ? 'found' : 'notFound'
    } catch {
      exifState.value = 'na'
    }
  } else {
    exifState.value = 'na'
  }

  try {
    const img = await loadImage(url)
    if (url !== sourceUrl.value) return // another file arrived meanwhile
    sourceImg = img
    sourceDims.value = { w: img.naturalWidth, h: img.naturalHeight }
    // Default output format mirrors the input type when possible, so PNG
    // transparency isn't silently flattened.
    if (file.type === 'image/png') outputFormat.value = 'image/png'
  } catch {
    if (url !== sourceUrl.value) return
    error.value = T('errLoad')
    sourceDims.value = null
    return
  }
  // Clean straight away; the button stays as a manual re-run.
  await clean()
}

async function clean() {
  const img = sourceImg
  if (!img) return
  const id = ++runId
  error.value = ''
  busy.value = true
  try {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('ctx')
    if (outputFormat.value === 'image/jpeg') {
      // JPEG has no alpha; composite transparency over white, not black
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    ctx.drawImage(img, 0, 0)
    const blob = await canvasToBlob(canvas, outputFormat.value, quality.value)
    if (id !== runId) return
    revokeCleaned()
    cleanedBlob.value = blob
    cleanedUrl.value = URL.createObjectURL(blob)
    cleanedDims.value = { w: canvas.width, h: canvas.height }
  } catch {
    if (id === runId) error.value = T('errLoad')
  } finally {
    if (id === runId) busy.value = false
  }
}

function scheduleClean() {
  clearTimeout(timer)
  timer = setTimeout(() => void clean(), 300)
}

// Re-encode as the options change so the result always matches them.
watch([outputFormat, quality], () => {
  if (sourceImg) scheduleClean()
})

function download() {
  if (cleanedBlob.value) downloadBlob(cleanedBlob.value, downloadName.value)
}

onUnmounted(() => {
  clearTimeout(timer)
  runId++
  revokeSource()
  revokeCleaned()
})
</script>

<template>
  <ToolShell>
    <v-alert type="info" variant="tonal" class="mb-4" :title="T('explainTitle')">
      {{ T('explainBody') }}
    </v-alert>

    <FileDrop accept="image/*" :hint="T('uploadHint')" @files="onFiles" />

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-4">{{ error }}</v-alert>

    <template v-if="sourceUrl">
      <v-alert :type="exifAlertType" variant="tonal" density="compact" class="mt-4">{{ exifMessage }}</v-alert>

      <v-row density="comfortable" class="mt-2" align="center">
        <v-col cols="12" sm="4">
          <v-select
            v-model="outputFormat"
            :items="formats"
            :label="T('outputFormat')"
            hide-details
            density="comfortable"
          />
        </v-col>
        <v-col v-if="hasQuality" cols="12" sm="8">
          <div class="text-body-2 mb-1">{{ T('quality') }}: {{ quality.toFixed(2) }}</div>
          <v-slider v-model="quality" :min="0.1" :max="1" :step="0.01" hide-details />
        </v-col>
      </v-row>

      <v-btn color="primary" class="mt-4" :loading="busy" prepend-icon="mdi-image-off" @click="clean">
        {{ T('clean') }}
      </v-btn>

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
            <v-card-title class="text-subtitle-2">{{ T('cleaned') }}</v-card-title>
            <v-card-text v-if="cleanedBlob">
              <img :src="cleanedUrl" class="preview rounded mb-2" alt="" />
              <div v-if="cleanedDims" class="text-body-2 text-medium-emphasis tabular-nums">
                {{ T('dimensions') }}: {{ cleanedDims.w }} × {{ cleanedDims.h }}
              </div>
              <div class="d-flex align-center flex-wrap ga-2 mt-1">
                <span v-if="sourceFile" class="text-body-2 text-medium-emphasis text-decoration-line-through">
                  {{ formatBytes(sourceFile.size) }}
                </span>
                <v-icon icon="mdi-arrow-right" size="16" class="text-medium-emphasis" />
                <span class="text-subtitle-1 font-weight-bold">{{ formatBytes(cleanedBlob.size) }}</span>
                <v-chip
                  :color="reduction > 0 ? 'success' : reduction < 0 ? 'error' : undefined"
                  variant="flat"
                  size="small"
                  label
                  :title="T('sizeDelta')"
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
              {{ busy ? t('common.loading') : t('common.noOutput') }}
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
  max-height: 260px;
  display: block;
}
</style>
