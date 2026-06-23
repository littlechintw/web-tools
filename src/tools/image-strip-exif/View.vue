<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'

const { t } = useI18n()

type OutFormat = 'image/jpeg' | 'image/png'
type ExifState = 'found' | 'notFound' | 'na'

const sourceFile = ref<File | null>(null)
const sourceUrl = ref('')
const sourceDims = ref<{ w: number; h: number } | null>(null)

const outputFormat = ref<OutFormat>('image/jpeg')
const quality = ref(0.92)

const cleanedUrl = ref('')
const cleanedBlob = ref<Blob | null>(null)
const cleanedDims = ref<{ w: number; h: number } | null>(null)

const exifState = ref<ExifState>('na')
const busy = ref(false)
const error = ref('')

const formats = [
  { title: 'JPEG', value: 'image/jpeg' as OutFormat },
  { title: 'PNG', value: 'image/png' as OutFormat },
]

const hasQuality = computed(() => outputFormat.value === 'image/jpeg')

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

const sizeDelta = computed(() => {
  if (!sourceFile.value || !cleanedBlob.value) return ''
  const diff = cleanedBlob.value.size - sourceFile.value.size
  const sign = diff > 0 ? '+' : ''
  const pct = sourceFile.value.size > 0 ? (diff / sourceFile.value.size) * 100 : 0
  return `${sign}${formatBytes(Math.abs(diff)).replace(/^/, diff < 0 ? '-' : '')} (${sign}${pct.toFixed(1)}%)`
})

function revokeSource() {
  if (sourceUrl.value) {
    URL.revokeObjectURL(sourceUrl.value)
    sourceUrl.value = ''
  }
}

function revokeCleaned() {
  if (cleanedUrl.value) {
    URL.revokeObjectURL(cleanedUrl.value)
    cleanedUrl.value = ''
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

function canvasToBlob(canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob'))),
      type,
      type === 'image/png' ? undefined : q,
    )
  })
}

async function onFiles(files: File[]) {
  const file = files[0]
  if (!file) return
  error.value = ''
  revokeCleaned()
  cleanedBlob.value = null
  cleanedDims.value = null
  revokeSource()
  sourceFile.value = file
  sourceUrl.value = URL.createObjectURL(file)

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
    const img = await loadImage(sourceUrl.value)
    sourceDims.value = { w: img.naturalWidth, h: img.naturalHeight }
    // Default output format mirrors the input type when possible.
    if (file.type === 'image/png') outputFormat.value = 'image/png'
  } catch {
    error.value = t('tools.image-strip-exif.errLoad')
    sourceDims.value = null
  }
}

async function clean() {
  if (!sourceUrl.value) return
  error.value = ''
  busy.value = true
  try {
    const img = await loadImage(sourceUrl.value)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('ctx')
    ctx.drawImage(img, 0, 0)
    const blob = await canvasToBlob(canvas, outputFormat.value, quality.value)
    revokeCleaned()
    cleanedBlob.value = blob
    cleanedUrl.value = URL.createObjectURL(blob)
    cleanedDims.value = { w: canvas.width, h: canvas.height }
  } catch {
    error.value = t('tools.image-strip-exif.errLoad')
  } finally {
    busy.value = false
  }
}

function download() {
  if (!cleanedUrl.value) return
  const ext = outputFormat.value === 'image/png' ? 'png' : 'jpg'
  const a = document.createElement('a')
  a.href = cleanedUrl.value
  a.download = `cleaned.${ext}`
  a.click()
}

const exifMessage = computed(() => {
  if (exifState.value === 'found') return t('tools.image-strip-exif.exifFound')
  if (exifState.value === 'notFound') return t('tools.image-strip-exif.exifNotFound')
  return t('tools.image-strip-exif.exifNA')
})

const exifAlertType = computed(() => (exifState.value === 'found' ? 'warning' : 'info'))

onUnmounted(() => {
  revokeSource()
  revokeCleaned()
})
</script>

<template>
  <ToolShell>
    <v-alert type="info" variant="tonal" class="mb-4" :title="t('tools.image-strip-exif.explainTitle')">
      {{ t('tools.image-strip-exif.explainBody') }}
    </v-alert>

    <FileDrop accept="image/*" :hint="t('tools.image-strip-exif.uploadHint')" @files="onFiles" />

    <v-alert v-if="error" type="error" variant="tonal" class="mt-3">{{ error }}</v-alert>

    <template v-if="sourceUrl">
      <v-alert :type="exifAlertType" variant="tonal" class="mt-3">{{ exifMessage }}</v-alert>

      <v-row class="mt-2" dense align="center">
        <v-col cols="12" sm="4">
          <v-select
            v-model="outputFormat"
            :items="formats"
            :label="t('tools.image-strip-exif.outputFormat')"
            hide-details
            density="comfortable"
          />
        </v-col>
        <v-col v-if="hasQuality" cols="12" sm="8">
          <div class="text-body-2 mb-1">
            {{ t('tools.image-strip-exif.quality') }}: {{ quality.toFixed(2) }}
          </div>
          <v-slider v-model="quality" :min="0.1" :max="1" :step="0.01" hide-details />
        </v-col>
      </v-row>

      <v-btn color="primary" class="mt-2" :loading="busy" prepend-icon="mdi-image-off" @click="clean">
        {{ t('tools.image-strip-exif.clean') }}
      </v-btn>

      <v-row class="mt-2" dense>
        <v-col cols="12" sm="6">
          <v-card variant="tonal" class="h-100">
            <v-card-title class="text-subtitle-2">{{ t('tools.image-strip-exif.original') }}</v-card-title>
            <v-card-text>
              <img :src="sourceUrl" class="preview rounded mb-2" alt="" />
              <div v-if="sourceDims" class="text-body-2">
                {{ t('tools.image-strip-exif.dimensions') }}: {{ sourceDims.w }} × {{ sourceDims.h }}
              </div>
              <div v-if="sourceFile" class="text-body-2">
                {{ t('tools.image-strip-exif.fileSize') }}: {{ formatBytes(sourceFile.size) }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6">
          <v-card v-if="cleanedUrl" variant="tonal" class="h-100">
            <v-card-title class="text-subtitle-2">{{ t('tools.image-strip-exif.cleaned') }}</v-card-title>
            <v-card-text>
              <img :src="cleanedUrl" class="preview rounded mb-2" alt="" />
              <div v-if="cleanedDims" class="text-body-2">
                {{ t('tools.image-strip-exif.dimensions') }}: {{ cleanedDims.w }} × {{ cleanedDims.h }}
              </div>
              <div v-if="cleanedBlob" class="text-body-2">
                {{ t('tools.image-strip-exif.fileSize') }}: {{ formatBytes(cleanedBlob.size) }}
              </div>
              <div v-if="sizeDelta" class="text-body-2 mb-2">
                {{ t('tools.image-strip-exif.sizeDelta') }}: {{ sizeDelta }}
              </div>
              <v-btn color="primary" prepend-icon="mdi-download" @click="download">
                {{ t('tools.image-strip-exif.download') }}
              </v-btn>
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
