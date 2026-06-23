<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'

const { t } = useI18n()

type Format = 'image/png' | 'image/jpeg' | 'image/webp'

const sourceFile = ref<File | null>(null)
const sourceUrl = ref('')
const sourceDims = ref<{ w: number; h: number } | null>(null)

const targetFormat = ref<Format>('image/jpeg')
const quality = ref(0.85)
const useCompress = ref(false)
const maxSizeMB = ref(1)

const busy = ref(false)
const error = ref('')

const resultUrl = ref('')
const resultBlob = ref<Blob | null>(null)
const resultDims = ref<{ w: number; h: number } | null>(null)

const formats = [
  { title: 'PNG', value: 'image/png' as Format },
  { title: 'JPEG', value: 'image/jpeg' as Format },
  { title: 'WEBP', value: 'image/webp' as Format },
]

const hasQuality = computed(() => targetFormat.value !== 'image/png')
const ext = computed(() => targetFormat.value.split('/')[1].replace('jpeg', 'jpg'))

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function revoke() {
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
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
  resultUrl.value && URL.revokeObjectURL(resultUrl.value)
  resultUrl.value = ''
  resultBlob.value = null
  resultDims.value = null
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
  sourceFile.value = file
  sourceUrl.value = URL.createObjectURL(file)
  try {
    const img = await loadImage(sourceUrl.value)
    sourceDims.value = { w: img.naturalWidth, h: img.naturalHeight }
  } catch {
    error.value = t('tools.image-convert.errLoad')
    sourceDims.value = null
  }
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

function drawScaled(img: HTMLImageElement, scale: number): HTMLCanvasElement {
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('ctx')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  return canvas
}

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
    const canvas = drawScaled(img, scale)
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
    let blob = await canvasToBlob(canvas, targetFormat.value, quality.value)

    if (useCompress.value) {
      blob = await compressToTarget(
        img,
        targetFormat.value,
        quality.value,
        maxSizeMB.value * 1024 * 1024,
      )
    }

    if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
    resultBlob.value = blob
    resultUrl.value = URL.createObjectURL(blob)
    const out = await loadImage(resultUrl.value)
    resultDims.value = { w: out.naturalWidth, h: out.naturalHeight }
  } catch {
    error.value = t('tools.image-convert.errConvert')
  } finally {
    busy.value = false
  }
}

function download() {
  if (!resultUrl.value) return
  const a = document.createElement('a')
  a.href = resultUrl.value
  a.download = `converted.${ext.value}`
  a.click()
}

onUnmounted(revoke)
</script>

<template>
  <ToolShell>
    <FileDrop accept="image/*" :hint="t('tools.image-convert.uploadHint')" @files="onFiles" />

    <v-alert v-if="error" type="error" variant="tonal" class="mt-3">{{ error }}</v-alert>

    <template v-if="sourceUrl">
      <v-row class="mt-2" dense>
        <v-col cols="12" sm="6">
          <v-select
            v-model="targetFormat"
            :items="formats"
            :label="t('tools.image-convert.targetFormat')"
            hide-details
            density="comfortable"
          />
        </v-col>
        <v-col cols="12" sm="6" class="d-flex align-center">
          <v-checkbox
            v-model="useCompress"
            :label="t('tools.image-convert.compress')"
            hide-details
            density="compact"
          />
        </v-col>
      </v-row>

      <div v-if="hasQuality" class="mt-2">
        <div class="text-body-2 mb-1">
          {{ t('tools.image-convert.quality') }}: {{ quality.toFixed(2) }}
        </div>
        <v-slider v-model="quality" :min="0.1" :max="1" :step="0.05" hide-details />
      </div>

      <div v-if="useCompress" class="mt-2" style="max-width: 280px">
        <v-text-field
          v-model.number="maxSizeMB"
          type="number"
          :min="0.1"
          :step="0.1"
          :label="t('tools.image-convert.maxSize')"
          hide-details
          density="comfortable"
        />
      </div>

      <div class="d-flex ga-2 mt-3">
        <v-btn color="primary" :loading="busy" prepend-icon="mdi-image-sync" @click="convert">
          {{ t('tools.image-convert.convert') }}
        </v-btn>
      </div>

      <v-row class="mt-2" dense>
        <v-col cols="12" sm="6">
          <v-card variant="tonal" class="h-100">
            <v-card-title class="text-subtitle-2">{{ t('tools.image-convert.original') }}</v-card-title>
            <v-card-text>
              <img :src="sourceUrl" class="preview rounded mb-2" alt="" />
              <div v-if="sourceDims" class="text-body-2">
                {{ t('tools.image-convert.dimensions') }}: {{ sourceDims.w }} × {{ sourceDims.h }}
              </div>
              <div v-if="sourceFile" class="text-body-2">
                {{ t('tools.image-convert.fileSize') }}: {{ formatBytes(sourceFile.size) }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6">
          <v-card v-if="resultUrl" variant="tonal" class="h-100">
            <v-card-title class="text-subtitle-2">{{ t('tools.image-convert.result') }}</v-card-title>
            <v-card-text>
              <img :src="resultUrl" class="preview rounded mb-2" alt="" />
              <div v-if="resultDims" class="text-body-2">
                {{ t('tools.image-convert.dimensions') }}: {{ resultDims.w }} × {{ resultDims.h }}
              </div>
              <div v-if="resultBlob" class="text-body-2 mb-2">
                {{ t('tools.image-convert.fileSize') }}: {{ formatBytes(resultBlob.size) }}
              </div>
              <v-btn color="primary" prepend-icon="mdi-download" @click="download">
                {{ t('tools.image-convert.download') }}
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
  max-height: 240px;
  display: block;
}
</style>
