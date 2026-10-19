<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { PDFDocument } from '@cantoo/pdf-lib'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'
import { arrayMove, useDragReorder } from '@/composables/useDragReorder'
import { isNumber, oneOf, useStoredRef } from '@/composables/useStoredRef'
import { downloadBlob } from '@/utils/download'
import { formatBytes, stripExtension } from '@/utils/format'
import { canvasToBlob, loadImage } from '@/utils/image'

const TOOL_ID = 'image-to-pdf'
const { t } = useI18n()
const T = (key: string, args?: Record<string, unknown>) => t(`tools.${TOOL_ID}.${key}`, args ?? {})

interface ImageItem {
  file: File
  url: string
}

type PageSize = 'a4' | 'letter' | 'fit'
type Orientation = 'portrait' | 'landscape'

const items = ref<ImageItem[]>([])
// Layout options are remembered between visits.
const pageSize = useStoredRef<PageSize>('image-to-pdf.pageSize', 'a4', oneOf(['a4', 'letter', 'fit']))
const orientation = useStoredRef<Orientation>('image-to-pdf.orientation', 'portrait', oneOf(['portrait', 'landscape']))
const margin = useStoredRef('image-to-pdf.margin', 24, isNumber)
const busy = ref(false)
const error = ref('')
const result = shallowRef<{ blob: Blob; pages: number; name: string } | null>(null)

// Page dimensions in PostScript points (1pt = 1/72 inch).
const SIZES: Record<Exclude<PageSize, 'fit'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
}

const outputName = computed(() => {
  const first = items.value[0]
  if (!first) return 'images.pdf'
  const base = stripExtension(first.file.name) || 'images'
  return items.value.length > 1 ? `${base}-${items.value.length}p.pdf` : `${base}.pdf`
})

// Any change to the inputs makes the last PDF stale.
watch([items, pageSize, orientation, margin], () => (result.value = null), { deep: true })

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

function moveTo(from: number, to: number) {
  items.value = arrayMove(items.value, from, to)
}

const { setContainer: setDragContainer, dragging, start: startDrag } = useDragReorder(moveTo)

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

/** Decode an image and re-encode it via a canvas. The browser applies EXIF
 *  orientation when decoding, so this also normalizes rotated phone photos. */
async function reencodeBytes(item: ImageItem, type: 'image/png' | 'image/jpeg'): Promise<Uint8Array> {
  const img = await loadImage(item.url)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.drawImage(img, 0, 0)
  const blob = await canvasToBlob(canvas, type, 0.92)
  return new Uint8Array(await blob.arrayBuffer())
}

/** Read the EXIF orientation tag of a JPEG (1 = upright / none). */
async function jpegOrientation(file: File): Promise<number> {
  try {
    const buf = new DataView(await file.slice(0, 128 * 1024).arrayBuffer())
    if (buf.byteLength < 4 || buf.getUint16(0) !== 0xffd8) return 1
    let offset = 2
    while (offset + 4 <= buf.byteLength) {
      const marker = buf.getUint16(offset)
      if ((marker & 0xff00) !== 0xff00) return 1
      const size = buf.getUint16(offset + 2)
      if (marker === 0xffe1 && offset + 10 <= buf.byteLength && buf.getUint32(offset + 4) === 0x45786966) {
        const tiff = offset + 10
        if (tiff + 8 > buf.byteLength) return 1
        const little = buf.getUint16(tiff) === 0x4949
        const ifd = tiff + buf.getUint32(tiff + 4, little)
        if (ifd + 2 > buf.byteLength) return 1
        const count = buf.getUint16(ifd, little)
        for (let i = 0; i < count; i++) {
          const entry = ifd + 2 + i * 12
          if (entry + 12 > buf.byteLength) return 1
          if (buf.getUint16(entry, little) === 0x0112) return buf.getUint16(entry + 8, little) || 1
        }
        return 1
      }
      offset += 2 + size
    }
    return 1
  } catch {
    return 1
  }
}

async function generate() {
  if (!items.value.length || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const doc = await PDFDocument.create()

    for (const item of items.value) {
      const type = item.file.type
      let embedded
      if (type === 'image/jpeg' || type === 'image/jpg') {
        // embedJpg ignores EXIF orientation; re-encode rotated photos upright
        const orient = await jpegOrientation(item.file)
        embedded =
          orient > 1
            ? await doc.embedJpg(await reencodeBytes(item, 'image/jpeg'))
            : await doc.embedJpg(await readBytes(item.file))
      } else if (type === 'image/png') {
        embedded = await doc.embedPng(await readBytes(item.file))
      } else {
        // gif / webp / svg / etc. — rasterize to PNG first.
        embedded = await doc.embedPng(await reencodeBytes(item, 'image/png'))
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

      const m = Math.max(0, Number(margin.value) || 0)
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
    const name = outputName.value
    result.value = { blob, pages: items.value.length, name }
    downloadBlob(blob, name)
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
    <FileDrop accept="image/*" multiple :hint="T('dropHint')" :show-selected="false" @files="addFiles" />

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-4">
      {{ error }}
    </v-alert>

    <div class="d-flex align-center justify-space-between mt-6 mb-2">
      <div class="text-subtitle-1 font-weight-medium">
        {{ T('images') }}
        <span v-if="items.length" class="text-medium-emphasis text-body-2">
          ({{ T('imageCount', { count: items.length }) }})
        </span>
      </div>
      <v-btn v-if="items.length" size="small" variant="text" color="error" prepend-icon="mdi-delete-sweep" @click="clearAll">
        {{ T('clearAll') }}
      </v-btn>
    </div>

    <p v-if="!items.length" class="text-medium-emphasis text-body-2">
      {{ T('noImages') }}
    </p>

    <div v-else :ref="setDragContainer">
    <div class="text-caption text-medium-emphasis mb-1">{{ t('common.dragToReorder') }}</div>
    <v-list lines="two" class="rounded-lg border">
      <v-list-item
        v-for="(item, i) in items"
        :key="item.url"
        :title="item.file.name"
        :subtitle="formatBytes(item.file.size)"
        :data-index="i"
        :class="{ 'is-dragging': dragging === i }"
      >
        <template #prepend>
          <v-icon
            icon="mdi-drag-vertical"
            class="drag-handle mr-1 text-medium-emphasis"
            :aria-label="t('common.dragToReorder')"
            @pointerdown="startDrag(i, $event)"
          />
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
            :title="T('moveUp')"
            @click="moveUp(i)"
          />
          <v-btn
            icon="mdi-arrow-down"
            size="small"
            variant="text"
            :disabled="i === items.length - 1"
            :title="T('moveDown')"
            @click="moveDown(i)"
          />
          <v-btn icon="mdi-close" size="small" variant="text" color="error" :title="T('remove')" @click="removeAt(i)" />
        </template>
      </v-list-item>
    </v-list>
    </div>

    <v-row density="comfortable" class="mt-4">
      <v-col cols="12" sm="4">
        <v-select
          v-model="pageSize"
          :label="T('pageSize')"
          :items="[
            { title: 'A4', value: 'a4' },
            { title: 'Letter', value: 'letter' },
            { title: T('fit'), value: 'fit' },
          ]"
          hide-details
          density="comfortable"
        />
      </v-col>
      <v-col cols="12" sm="4">
        <v-select
          v-model="orientation"
          :label="T('orientation')"
          :disabled="pageSize === 'fit'"
          :items="[
            { title: T('portrait'), value: 'portrait' },
            { title: T('landscape'), value: 'landscape' },
          ]"
          hide-details
          density="comfortable"
        />
      </v-col>
      <v-col cols="12" sm="4">
        <v-text-field
          v-model.number="margin"
          :label="T('margin')"
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
      size="large"
      :loading="busy"
      :disabled="!items.length"
      prepend-icon="mdi-file-pdf-box"
      @click="generate"
    >
      {{ busy ? T('generating') : T('generate') }}
    </v-btn>

    <!-- Result: the PDF was downloaded already; this lets the user grab it again. -->
    <v-card v-if="result && !busy" variant="outlined" rounded="lg" class="mt-4 pa-4">
      <div class="d-flex align-center flex-wrap ga-3">
        <v-icon icon="mdi-file-pdf-box" size="28" color="primary" />
        <div class="flex-grow-1 min-w-0">
          <div class="text-subtitle-2 font-weight-medium text-truncate">{{ result.name }}</div>
          <div class="text-body-2 text-medium-emphasis">
            {{ T('generated', { count: result.pages, size: formatBytes(result.blob.size) }) }}
          </div>
        </div>
        <v-btn color="primary" variant="tonal" prepend-icon="mdi-download" @click="downloadBlob(result.blob, result.name)">
          {{ T('download') }}
        </v-btn>
      </div>
    </v-card>
  </ToolShell>
</template>
