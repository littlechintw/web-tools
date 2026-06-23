<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PDFDocument } from '@cantoo/pdf-lib'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'

const { t } = useI18n()

interface ImageItem {
  file: File
  url: string
}

type PageSize = 'a4' | 'letter' | 'fit'
type Orientation = 'portrait' | 'landscape'

const items = ref<ImageItem[]>([])
const pageSize = ref<PageSize>('a4')
const orientation = ref<Orientation>('portrait')
const margin = ref(24)
const busy = ref(false)
const error = ref('')

// Page dimensions in PostScript points (1pt = 1/72 inch).
const SIZES: Record<Exclude<PageSize, 'fit'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
}

function addFiles(files: File[]) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    items.value.push({ file, url: URL.createObjectURL(file) })
  }
}

function revoke(item: ImageItem) {
  URL.revokeObjectURL(item.url)
}

function removeAt(i: number) {
  const [removed] = items.value.splice(i, 1)
  if (removed) revoke(removed)
}

function clearAll() {
  items.value.forEach(revoke)
  items.value = []
}

function moveUp(i: number) {
  if (i <= 0) return
  const arr = items.value
  ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
}

function moveDown(i: number) {
  const arr = items.value
  if (i >= arr.length - 1) return
  ;[arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]
}

/** Read a File into bytes. */
async function readBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer())
}

/** Decode any image File and re-encode it as PNG bytes via a canvas. */
async function toPngBytes(file: File): Promise<Uint8Array> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('decode failed'))
      el.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.drawImage(img, 0, 0)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
    if (!blob) throw new Error('encode failed')
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function generate() {
  if (!items.value.length) return
  busy.value = true
  error.value = ''
  try {
    const doc = await PDFDocument.create()

    for (const item of items.value) {
      const type = item.file.type
      let embedded
      if (type === 'image/jpeg' || type === 'image/jpg') {
        embedded = await doc.embedJpg(await readBytes(item.file))
      } else if (type === 'image/png') {
        embedded = await doc.embedPng(await readBytes(item.file))
      } else {
        // gif / webp / svg / etc. — rasterize to PNG first.
        embedded = await doc.embedPng(await toPngBytes(item.file))
      }

      const iw = embedded.width
      const ih = embedded.height

      if (pageSize.value === 'fit') {
        const page = doc.addPage([iw, ih])
        page.drawImage(embedded, { x: 0, y: 0, width: iw, height: ih })
        continue
      }

      let [pw, ph] = SIZES[pageSize.value]
      if (orientation.value === 'landscape') [pw, ph] = [ph, pw]
      const page = doc.addPage([pw, ph])

      const m = Math.max(0, margin.value)
      const availW = Math.max(1, pw - m * 2)
      const availH = Math.max(1, ph - m * 2)
      const scale = Math.min(availW / iw, availH / ih, 1)
      const drawW = iw * scale
      const drawH = ih * scale
      page.drawImage(embedded, {
        x: (pw - drawW) / 2,
        y: (ph - drawH) / 2,
        width: drawW,
        height: drawH,
      })
    }

    const bytes = await doc.save()
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'images.pdf'
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

onUnmounted(() => {
  items.value.forEach(revoke)
})
</script>

<template>
  <ToolShell>
    <FileDrop accept="image/*" multiple :hint="t('tools.image-to-pdf.dropHint')" @files="addFiles" />

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-4">
      {{ error }}
    </v-alert>

    <div class="d-flex align-center justify-space-between mt-6 mb-2">
      <div class="text-subtitle-1 font-weight-medium">
        {{ t('tools.image-to-pdf.images') }}
        <span v-if="items.length" class="text-medium-emphasis text-body-2">
          ({{ t('tools.image-to-pdf.imageCount', { count: items.length }) }})
        </span>
      </div>
      <v-btn
        v-if="items.length"
        size="small"
        variant="text"
        color="error"
        prepend-icon="mdi-delete-sweep"
        @click="clearAll"
      >
        {{ t('tools.image-to-pdf.clearAll') }}
      </v-btn>
    </div>

    <p v-if="!items.length" class="text-medium-emphasis text-body-2">
      {{ t('tools.image-to-pdf.noImages') }}
    </p>

    <v-list v-else lines="two" class="rounded-lg border">
      <v-list-item v-for="(item, i) in items" :key="item.url" :title="item.file.name">
        <template #prepend>
          <v-avatar rounded="lg" size="56" class="mr-2">
            <v-img :src="item.url" cover />
          </v-avatar>
        </template>
        <template #append>
          <v-btn
            icon="mdi-arrow-up"
            size="small"
            variant="text"
            :disabled="i === 0"
            :title="t('tools.image-to-pdf.moveUp')"
            @click="moveUp(i)"
          />
          <v-btn
            icon="mdi-arrow-down"
            size="small"
            variant="text"
            :disabled="i === items.length - 1"
            :title="t('tools.image-to-pdf.moveDown')"
            @click="moveDown(i)"
          />
          <v-btn
            icon="mdi-close"
            size="small"
            variant="text"
            color="error"
            :title="t('tools.image-to-pdf.remove')"
            @click="removeAt(i)"
          />
        </template>
      </v-list-item>
    </v-list>

    <v-row class="mt-4" dense>
      <v-col cols="12" sm="4">
        <v-select
          v-model="pageSize"
          :label="t('tools.image-to-pdf.pageSize')"
          :items="[
            { title: 'A4', value: 'a4' },
            { title: 'Letter', value: 'letter' },
            { title: t('tools.image-to-pdf.fit'), value: 'fit' },
          ]"
          hide-details
          density="comfortable"
        />
      </v-col>
      <v-col cols="12" sm="4">
        <v-select
          v-model="orientation"
          :label="t('tools.image-to-pdf.orientation')"
          :disabled="pageSize === 'fit'"
          :items="[
            { title: t('tools.image-to-pdf.portrait'), value: 'portrait' },
            { title: t('tools.image-to-pdf.landscape'), value: 'landscape' },
          ]"
          hide-details
          density="comfortable"
        />
      </v-col>
      <v-col cols="12" sm="4">
        <v-text-field
          v-model.number="margin"
          :label="t('tools.image-to-pdf.margin')"
          :disabled="pageSize === 'fit'"
          type="number"
          min="0"
          hide-details
          density="comfortable"
        />
      </v-col>
    </v-row>

    <v-btn
      class="mt-4"
      color="primary"
      :loading="busy"
      :disabled="!items.length"
      prepend-icon="mdi-file-pdf-box"
      @click="generate"
    >
      {{ busy ? t('tools.image-to-pdf.generating') : t('tools.image-to-pdf.generate') }}
    </v-btn>
  </ToolShell>
</template>
