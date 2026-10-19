<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'
import { isNumber, oneOf, useStoredRef } from '@/composables/useStoredRef'
import { downloadBlob, downloadUrl } from '@/utils/download'
import { formatBytes, stripExtension } from '@/utils/format'
import { canvasToBlob, extensionForMime } from '@/utils/image'
import { getDocument } from '@/utils/pdfjs'
import { createZip } from '@/utils/zip'

const { t } = useI18n()
const T = (key: string, args?: Record<string, unknown>) => t(`tools.pdf-to-image.${key}`, args ?? {})

interface RenderedPage {
  index: number
  url: string
  blob: Blob
  size: number
}

const SCALES = [1, 2, 3] as const
type Scale = (typeof SCALES)[number]
const FORMATS = ['png', 'jpeg'] as const
type Format = (typeof FORMATS)[number]

const fileName = ref('')
// Output options are remembered between visits.
const scale = useStoredRef<Scale>('pdf-to-image.scale', 2, oneOf(SCALES))
const format = useStoredRef<Format>('pdf-to-image.format', 'png', oneOf(FORMATS))
const quality = useStoredRef('pdf-to-image.quality', 0.9, (v): v is number => isNumber(v) && v >= 0.1 && v <= 1)

const busy = ref(false)
const progress = ref({ done: 0, total: 0 })
const error = ref('')
const pages = ref<RenderedPage[]>([])

const mime = computed(() => (format.value === 'jpeg' ? 'image/jpeg' : 'image/png'))
const ext = computed(() => extensionForMime(mime.value))
const totalSize = computed(() => pages.value.reduce((sum, p) => sum + p.size, 0))
const progressPercent = computed(() =>
  progress.value.total ? Math.round((progress.value.done / progress.value.total) * 100) : 0,
)

function pageFilename(p: RenderedPage) {
  return `${fileName.value || 'page'}-${p.index}.${ext.value}`
}

function revokeAll() {
  pages.value.forEach((p) => URL.revokeObjectURL(p.url))
  pages.value = []
}

// Kept so a change of scale/format re-renders the same document.
let lastFile: File | null = null

async function onFiles(files: File[]) {
  const file = files[0]
  if (!file) return
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
    error.value = T('notPdf')
    return
  }
  lastFile = file
  fileName.value = stripExtension(file.name)
  await render(file)
}

// Bumped per render so a second dropped file cancels the first file's loop
// instead of both racing to write `pages`.
let renderSeq = 0

async function render(file: File) {
  const seq = ++renderSeq
  busy.value = true
  error.value = ''
  progress.value = { done: 0, total: 0 }
  revokeAll()
  const out: RenderedPage[] = []
  let committed = false
  let pdf: Awaited<ReturnType<typeof getDocument>['promise']> | null = null
  try {
    const buffer = await file.arrayBuffer()
    // pdf.js may detach the buffer it receives, so hand it a copy.
    pdf = await getDocument({ data: new Uint8Array(buffer).slice() }).promise
    const type = mime.value
    const q = quality.value
    for (let n = 1; n <= pdf.numPages; n++) {
      if (seq !== renderSeq) return
      progress.value = { done: n - 1, total: pdf.numPages }
      const page = await pdf.getPage(n)
      const vp = page.getViewport({ scale: scale.value })
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      canvas.width = vp.width
      canvas.height = vp.height
      await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise
      const blob = await canvasToBlob(canvas, type, q)
      out.push({ index: n, url: URL.createObjectURL(blob), blob, size: blob.size })
    }
    if (seq === renderSeq) {
      progress.value = { done: pdf.numPages, total: pdf.numPages }
      pages.value = out
      committed = true
    }
  } catch (e) {
    if (seq === renderSeq) error.value = T('renderError', { msg: (e as Error).message })
  } finally {
    if (!committed) out.forEach((p) => URL.revokeObjectURL(p.url))
    void pdf?.loadingTask.destroy()
    if (seq === renderSeq) busy.value = false
  }
}

// Re-render the loaded document when an output option changes. Debounced so
// dragging the quality slider doesn't start a render per step.
let rerenderTimer: ReturnType<typeof setTimeout> | null = null
watch([scale, format, quality], () => {
  if (!lastFile) return
  if (rerenderTimer) clearTimeout(rerenderTimer)
  rerenderTimer = setTimeout(() => {
    rerenderTimer = null
    if (lastFile) void render(lastFile)
  }, 300)
})

function downloadPage(p: RenderedPage) {
  downloadUrl(p.url, pageFilename(p))
}

const zipping = ref(false)

/** One archive beats a dozen staggered downloads the browser may throttle. */
async function downloadAll() {
  if (zipping.value) return
  zipping.value = true
  try {
    const zip = await createZip(pages.value.map((p) => ({ name: pageFilename(p), data: p.blob })))
    downloadBlob(zip, `${fileName.value || 'pages'}.zip`)
  } finally {
    zipping.value = false
  }
}

onUnmounted(() => {
  if (rerenderTimer) clearTimeout(rerenderTimer)
  renderSeq++
  revokeAll()
})
</script>

<template>
  <ToolShell>
    <FileDrop accept="application/pdf,.pdf" :hint="T('dropHint')" @files="onFiles" />

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-4">
      {{ error }}
    </v-alert>

    <v-row class="mt-4" density="comfortable" align="center">
      <v-col cols="12" sm="4">
        <v-select
          v-model="scale"
          :label="T('quality')"
          :items="SCALES.map((s) => ({ title: `${s}x`, value: s }))"
          hide-details
          density="comfortable"
        />
      </v-col>
      <v-col cols="12" sm="4">
        <v-select
          v-model="format"
          :label="T('format')"
          :items="[
            { title: 'PNG', value: 'png' },
            { title: 'JPEG', value: 'jpeg' },
          ]"
          hide-details
          density="comfortable"
        />
      </v-col>
      <v-col v-if="format === 'jpeg'" cols="12" sm="4">
        <div class="text-caption text-medium-emphasis">
          {{ T('jpegQuality') }}: {{ Math.round(quality * 100) }}%
        </div>
        <v-slider v-model="quality" :min="0.1" :max="1" :step="0.05" hide-details density="compact" />
      </v-col>
    </v-row>

    <div v-if="busy" class="mt-6">
      <v-progress-linear
        :model-value="progressPercent"
        :indeterminate="!progress.total"
        color="primary"
        rounded
        height="6"
      />
      <div class="text-caption text-medium-emphasis mt-2">
        {{
          progress.total
            ? T('renderingPage', { n: Math.min(progress.done + 1, progress.total), total: progress.total })
            : T('rendering')
        }}
      </div>
    </div>

    <p v-else-if="!pages.length" class="text-medium-emphasis text-body-2 mt-6">
      {{ T('noPdf') }}
    </p>

    <template v-if="pages.length && !busy">
      <div class="d-flex flex-wrap align-center ga-2 mt-6 mb-2">
        <div class="text-subtitle-1 font-weight-medium">{{ T('pageCount', { count: pages.length }) }}</div>
        <span class="text-body-2 text-medium-emphasis">· {{ formatBytes(totalSize) }}</span>
        <v-spacer />
        <v-btn color="primary" size="small" prepend-icon="mdi-folder-zip-outline" :loading="zipping" @click="downloadAll">
          {{ t('common.downloadZip') }}
        </v-btn>
      </div>

      <v-row density="comfortable">
        <v-col v-for="p in pages" :key="p.index" cols="6" sm="4" md="3">
          <v-card variant="outlined" rounded="lg">
            <v-img :src="p.url" :alt="T('page', { n: p.index })" />
            <v-card-actions class="d-flex justify-space-between">
              <span class="text-caption text-medium-emphasis text-truncate">
                {{ T('page', { n: p.index }) }} · {{ formatBytes(p.size) }}
              </span>
              <v-btn
                icon="mdi-download"
                size="small"
                variant="text"
                :title="T('downloadPage')"
                @click="downloadPage(p)"
              />
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </ToolShell>
</template>
