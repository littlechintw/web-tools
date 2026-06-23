<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PDFDocument } from '@cantoo/pdf-lib'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'

type Mode = 'range' | 'every'

const { t } = useI18n()

const fileName = ref('')
const buffer = ref<ArrayBuffer | null>(null)
const pageCount = ref(0)

const mode = ref<Mode>('range')
const rangeInput = ref('')
const everyInput = ref(1)

const error = ref('')
const result = ref('')
const busy = ref(false)
const urls: string[] = []

async function onFiles(files: File[]) {
  error.value = ''
  result.value = ''
  const file = files[0]
  if (!file) return
  try {
    const buf = await file.arrayBuffer()
    const doc = await PDFDocument.load(buf)
    buffer.value = buf
    fileName.value = file.name
    pageCount.value = doc.getPageCount()
  } catch {
    buffer.value = null
    fileName.value = ''
    pageCount.value = 0
    error.value = t('tools.pdf-split.loadError', { name: file.name })
  }
}

/** Parse a "1-3,5,8-10" range string into zero-based page indices. Validates
 *  against `total` and sets `error` (returns null) on any problem. */
function parseRange(input: string, total: number): number[] | null {
  const trimmed = input.trim()
  if (!trimmed) {
    error.value = t('tools.pdf-split.rangeEmpty')
    return null
  }
  const indices: number[] = []
  for (const raw of trimmed.split(',')) {
    const part = raw.trim()
    if (!part) continue
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part)
    if (!m) {
      error.value = t('tools.pdf-split.rangeInvalid', { part })
      return null
    }
    const start = Number(m[1])
    const end = m[2] !== undefined ? Number(m[2]) : start
    if (start < 1 || end < 1 || start > total || end > total) {
      error.value = t('tools.pdf-split.rangeOutOfBounds', { count: total, part })
      return null
    }
    if (start > end) {
      error.value = t('tools.pdf-split.rangeReversed', { part })
      return null
    }
    for (let p = start; p <= end; p++) indices.push(p - 1)
  }
  if (!indices.length) {
    error.value = t('tools.pdf-split.rangeEmpty')
    return null
  }
  return indices
}

function download(bytes: Uint8Array, name: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  urls.push(url)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
}

async function run() {
  if (!buffer.value || busy.value) return
  error.value = ''
  result.value = ''
  busy.value = true
  try {
    const src = await PDFDocument.load(buffer.value)
    const total = src.getPageCount()

    if (mode.value === 'range') {
      const indices = parseRange(rangeInput.value, total)
      if (!indices) return
      const out = await PDFDocument.create()
      const copied = await out.copyPages(src, indices)
      for (const page of copied) out.addPage(page)
      const bytes = await out.save()
      download(bytes, t('tools.pdf-split.outputRange'))
      result.value = t('tools.pdf-split.resultExtract', { count: indices.length })
    } else {
      const step = Math.floor(Number(everyInput.value))
      if (!Number.isFinite(step) || step < 1) {
        error.value = t('tools.pdf-split.everyInvalid')
        return
      }
      let part = 0
      for (let start = 0; start < total; start += step) {
        part++
        const indices: number[] = []
        for (let p = start; p < Math.min(start + step, total); p++) indices.push(p)
        const out = await PDFDocument.create()
        const copied = await out.copyPages(src, indices)
        for (const page of copied) out.addPage(page)
        const bytes = await out.save()
        download(bytes, t('tools.pdf-split.outputPart', { n: part }))
      }
      result.value = t('tools.pdf-split.resultSplit', { count: part })
    }
  } catch {
    error.value = t('tools.pdf-split.processError')
  } finally {
    busy.value = false
  }
}

onUnmounted(() => {
  for (const url of urls) URL.revokeObjectURL(url)
})
</script>

<template>
  <ToolShell>
    <FileDrop
      accept="application/pdf"
      :multiple="false"
      :hint="buffer ? t('tools.pdf-split.replaceHint') : t('tools.pdf-split.dropHint')"
      @files="onFiles"
    />

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-4">
      {{ error }}
    </v-alert>

    <template v-if="buffer">
      <div class="d-flex align-center ga-2 mt-4">
        <v-icon icon="mdi-file-pdf-box" color="primary" />
        <span class="text-body-2 font-weight-medium text-truncate">{{ fileName }}</span>
        <v-chip size="small" variant="tonal">{{ t('tools.pdf-split.pageCount', { count: pageCount }) }}</v-chip>
      </div>

      <v-btn-toggle v-model="mode" mandatory color="primary" variant="outlined" density="comfortable" class="mt-4">
        <v-btn value="range">{{ t('tools.pdf-split.modeRange') }}</v-btn>
        <v-btn value="every">{{ t('tools.pdf-split.modeEvery') }}</v-btn>
      </v-btn-toggle>

      <v-text-field
        v-if="mode === 'range'"
        v-model="rangeInput"
        :label="t('tools.pdf-split.rangeLabel')"
        :hint="t('tools.pdf-split.rangeHint')"
        persistent-hint
        class="mt-4"
        clearable
      />
      <v-text-field
        v-else
        v-model.number="everyInput"
        type="number"
        min="1"
        :label="t('tools.pdf-split.everyLabel')"
        class="mt-4"
      />

      <v-btn
        color="primary"
        size="large"
        class="mt-4"
        prepend-icon="mdi-content-cut"
        :loading="busy"
        :disabled="busy"
        @click="run"
      >
        {{ busy ? t('tools.pdf-split.processing') : (mode === 'range' ? t('tools.pdf-split.extract') : t('tools.pdf-split.split')) }}
      </v-btn>

      <v-alert v-if="result" type="success" variant="tonal" density="compact" class="mt-4">
        {{ result }}
      </v-alert>
    </template>
  </ToolShell>
</template>
