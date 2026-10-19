<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PDFDocument } from '@cantoo/pdf-lib'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'
import { downloadBlob } from '@/utils/download'
import { createZip } from '@/utils/zip'
import { formatBytes, stripExtension } from '@/utils/format'

type Mode = 'range' | 'every'
type RangeResult = { ok: true; indices: number[] } | { ok: false; error: string }

const { t } = useI18n()
const T = (key: string, args?: Record<string, unknown>) => t(`tools.pdf-split.${key}`, args ?? {})

const fileName = ref('')
const fileSize = ref(0)
const buffer = ref<ArrayBuffer | null>(null)
const pageCount = ref(0)

const mode = ref<Mode>('range')
// `clearable` text fields emit null when cleared, so read this through
// `rangeText` rather than trusting the declared type.
const rangeInput = ref<string | null>('')
const everyInput = ref(1)

const error = ref('')
const result = ref('')
const busy = ref(false)

const baseName = computed(() => stripExtension(fileName.value))
const rangeText = computed(() => (rangeInput.value ?? '').trim())

/** Parse a "1-3,5,8-10" range string into zero-based page indices, or
 *  explain why it can't be. Pure, so it can run live while typing. */
function parseRange(input: string, total: number): RangeResult {
  const trimmed = input.trim()
  if (!trimmed) return { ok: false, error: T('rangeEmpty') }
  const indices: number[] = []
  for (const raw of trimmed.split(',')) {
    const part = raw.trim()
    if (!part) continue
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part)
    if (!m) return { ok: false, error: T('rangeInvalid', { part }) }
    const start = Number(m[1])
    const end = m[2] !== undefined ? Number(m[2]) : start
    if (start < 1 || end < 1 || start > total || end > total) {
      return { ok: false, error: T('rangeOutOfBounds', { count: total, part }) }
    }
    if (start > end) return { ok: false, error: T('rangeReversed', { part }) }
    for (let p = start; p <= end; p++) indices.push(p - 1)
  }
  if (!indices.length) return { ok: false, error: T('rangeEmpty') }
  return { ok: true, indices }
}

// Live validation: the field shows the problem as the user types, and the
// hint says how many pages the current input selects.
const rangeCheck = computed(() => parseRange(rangeText.value, pageCount.value))
const rangeError = computed(() => (rangeText.value && !rangeCheck.value.ok ? rangeCheck.value.error : ''))
const extractCount = computed(() => (rangeCheck.value.ok ? rangeCheck.value.indices.length : 0))

const everyStep = computed(() => {
  const step = Math.floor(Number(everyInput.value))
  return Number.isFinite(step) && step >= 1 ? step : 0
})
const partCount = computed(() => (everyStep.value ? Math.ceil(pageCount.value / everyStep.value) : 0))

const canRun = computed(() => (mode.value === 'range' ? rangeCheck.value.ok : everyStep.value > 0))

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
    fileSize.value = file.size
    pageCount.value = doc.getPageCount()
  } catch {
    buffer.value = null
    fileName.value = ''
    fileSize.value = 0
    pageCount.value = 0
    error.value = T('loadError', { name: file.name })
  }
}

async function copyPages(src: PDFDocument, indices: number[]): Promise<Blob> {
  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, indices)
  for (const page of copied) out.addPage(page)
  const bytes = await out.save()
  return new Blob([bytes as BlobPart], { type: 'application/pdf' })
}

async function run() {
  if (!buffer.value || busy.value || !canRun.value) return
  error.value = ''
  result.value = ''
  busy.value = true
  try {
    const src = await PDFDocument.load(buffer.value)
    const total = src.getPageCount()

    if (mode.value === 'range') {
      const check = parseRange(rangeText.value, total)
      if (!check.ok) {
        error.value = check.error
        return
      }
      const blob = await copyPages(src, check.indices)
      const label = rangeText.value.replace(/\s+/g, '')
      downloadBlob(blob, `${baseName.value}-p${label}.pdf`)
      result.value = T('resultExtract', { count: check.indices.length })
    } else {
      const step = everyStep.value
      if (!step) {
        error.value = T('everyInvalid')
        return
      }
      const parts: Array<{ blob: Blob; filename: string }> = []
      for (let start = 0; start < total; start += step) {
        const indices: number[] = []
        for (let p = start; p < Math.min(start + step, total); p++) indices.push(p)
        parts.push({
          blob: await copyPages(src, indices),
          filename: `${baseName.value}-part${parts.length + 1}.pdf`,
        })
      }
      // A single archive instead of N staggered downloads.
      const zip = await createZip(parts.map((p) => ({ name: p.filename, data: p.blob })))
      downloadBlob(zip, `${baseName.value}-split.zip`)
      result.value = T('resultSplit', { count: parts.length })
    }
  } catch {
    error.value = T('processError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <ToolShell>
    <FileDrop
      accept="application/pdf,.pdf"
      :multiple="false"
      :show-selected="false"
      :hint="buffer ? T('replaceHint') : T('dropHint')"
      @files="onFiles"
    />

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-4">
      {{ error }}
    </v-alert>

    <template v-if="buffer">
      <v-card variant="tonal" rounded="lg" class="mt-4 pa-3">
        <div class="d-flex align-center ga-3 flex-wrap">
          <v-icon icon="mdi-file-pdf-box" size="28" color="primary" />
          <div class="flex-grow-1 text-truncate">
            <div class="text-subtitle-2 font-weight-medium text-truncate">{{ fileName }}</div>
            <div class="text-caption text-medium-emphasis">{{ formatBytes(fileSize) }}</div>
          </div>
          <v-chip size="small" variant="tonal" label>{{ T('pageCount', { count: pageCount }) }}</v-chip>
        </div>
      </v-card>

      <v-btn-toggle v-model="mode" mandatory color="primary" variant="outlined" density="comfortable" class="mt-4">
        <v-btn value="range">{{ T('modeRange') }}</v-btn>
        <v-btn value="every">{{ T('modeEvery') }}</v-btn>
      </v-btn-toggle>

      <v-text-field
        v-if="mode === 'range'"
        v-model="rangeInput"
        :label="T('rangeLabel')"
        :hint="extractCount ? T('willExtract', { count: extractCount }) : T('rangeHint')"
        :error-messages="rangeError || undefined"
        persistent-hint
        class="mt-4"
        clearable
        @keydown.enter="run"
      />
      <v-text-field
        v-else
        v-model.number="everyInput"
        type="number"
        min="1"
        :max="pageCount"
        :label="T('everyLabel')"
        :hint="everyStep ? T('willSplit', { count: partCount }) : undefined"
        :error-messages="everyStep ? undefined : T('everyInvalid')"
        persistent-hint
        class="mt-4"
      />

      <v-btn
        color="primary"
        size="large"
        class="mt-4"
        prepend-icon="mdi-content-cut"
        :loading="busy"
        :disabled="busy || !canRun"
        @click="run"
      >
        {{ busy ? T('processing') : mode === 'range' ? T('extract') : T('split') }}
      </v-btn>

      <v-alert v-if="result" type="success" variant="tonal" density="compact" class="mt-4">
        {{ result }}
      </v-alert>
    </template>
  </ToolShell>
</template>
