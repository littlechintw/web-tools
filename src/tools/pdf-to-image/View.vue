<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'
import { getDocument } from '@/utils/pdfjs'

const { t } = useI18n()

interface RenderedPage {
  index: number
  url: string
}

const fileName = ref('')
const scale = ref(2)
const busy = ref(false)
const error = ref('')
const pages = ref<RenderedPage[]>([])

function revokeAll() {
  pages.value.forEach((p) => URL.revokeObjectURL(p.url))
  pages.value = []
}

async function onFiles(files: File[]) {
  const file = files[0]
  if (!file || file.type !== 'application/pdf') {
    error.value = 'Not a PDF file'
    return
  }
  fileName.value = file.name.replace(/\.pdf$/i, '')
  await render(file)
}

async function render(file: File) {
  busy.value = true
  error.value = ''
  revokeAll()
  try {
    const buffer = await file.arrayBuffer()
    // pdf.js may detach the buffer it receives, so hand it a copy.
    const pdf = await getDocument({ data: new Uint8Array(buffer).slice() }).promise
    const out: RenderedPage[] = []
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n)
      const vp = page.getViewport({ scale: scale.value })
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no 2d context')
      canvas.width = vp.width
      canvas.height = vp.height
      await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
      if (!blob) throw new Error('encode failed')
      out.push({ index: n, url: URL.createObjectURL(blob) })
    }
    pages.value = out
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

function downloadPage(p: RenderedPage) {
  const a = document.createElement('a')
  a.href = p.url
  a.download = `${fileName.value || 'page'}-${p.index}.png`
  a.click()
}

function downloadAll() {
  pages.value.forEach((p) => downloadPage(p))
}

onUnmounted(revokeAll)
</script>

<template>
  <ToolShell>
    <FileDrop accept="application/pdf" :hint="t('tools.pdf-to-image.dropHint')" @files="onFiles" />

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-4">
      {{ error }}
    </v-alert>

    <v-row class="mt-4" dense align="center">
      <v-col cols="12" sm="4">
        <v-select
          v-model.number="scale"
          :label="t('tools.pdf-to-image.quality')"
          :items="[
            { title: '1x', value: 1 },
            { title: '2x', value: 2 },
            { title: '3x', value: 3 },
          ]"
          hide-details
          density="comfortable"
        />
      </v-col>
    </v-row>

    <div v-if="busy" class="d-flex align-center ga-3 mt-6 text-medium-emphasis">
      <v-progress-circular indeterminate size="20" width="2" />
      {{ t('tools.pdf-to-image.rendering') }}
    </div>

    <p v-else-if="!pages.length" class="text-medium-emphasis text-body-2 mt-6">
      {{ t('tools.pdf-to-image.noPdf') }}
    </p>

    <template v-if="pages.length">
      <div class="d-flex align-center justify-space-between mt-6 mb-2">
        <div class="text-subtitle-1 font-weight-medium">
          {{ t('tools.pdf-to-image.pageCount', { count: pages.length }) }}
        </div>
        <v-btn
          color="primary"
          size="small"
          prepend-icon="mdi-download-multiple"
          @click="downloadAll"
        >
          {{ t('tools.pdf-to-image.downloadAll') }}
        </v-btn>
      </div>

      <v-row dense>
        <v-col v-for="p in pages" :key="p.index" cols="6" sm="4" md="3">
          <v-card variant="outlined" rounded="lg">
            <v-img :src="p.url" :alt="t('tools.pdf-to-image.page', { n: p.index })" />
            <v-card-actions class="d-flex justify-space-between">
              <span class="text-caption text-medium-emphasis">
                {{ t('tools.pdf-to-image.page', { n: p.index }) }}
              </span>
              <v-btn
                icon="mdi-download"
                size="small"
                variant="text"
                :title="t('tools.pdf-to-image.downloadPage')"
                @click="downloadPage(p)"
              />
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </ToolShell>
</template>
