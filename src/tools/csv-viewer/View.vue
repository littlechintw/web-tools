<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import FileDrop from '@/components/FileDrop.vue'
import { useClipboard } from '@/composables/useClipboard'
import { isBoolean, oneOf, useStoredRef } from '@/composables/useStoredRef'
import { downloadText } from '@/utils/download'
import { formatBytes, stripExtension } from '@/utils/format'
import {
  DELIMITER_OPTIONS,
  parseCsv,
  sortRows,
  splitHeader,
  toJson,
  toMarkdown,
  toTsv,
  type DelimiterOption,
} from '@/lib/csvTable'

const TOOL_ID = 'csv-viewer'
const { t } = useI18n()
const T = (key: string, named?: Record<string, unknown>) => t(`tools.${TOOL_ID}.${key}`, named ?? {})
const { copy, copied } = useClipboard()

const MAX_RENDER = 1000
const LARGE_BYTES = 5 * 1024 * 1024

const delimiterOpt = useStoredRef<DelimiterOption>('csv-viewer.delimiter', 'auto', oneOf(DELIMITER_OPTIONS))
const hasHeader = useStoredRef('csv-viewer.header', true, isBoolean)
const exportFormat = useStoredRef<'json' | 'tsv' | 'markdown'>('csv-viewer.export', 'json', oneOf(['json', 'tsv', 'markdown'] as const))

const text = shallowRef('')
const fileName = ref('')
const forceLarge = ref(false)
const sortCol = ref(-1)
const sortDir = ref<'asc' | 'desc'>('asc')

const delimiterItems = computed(() =>
  DELIMITER_OPTIONS.map((o) => ({ title: T(`delim.${o}`), value: o })),
)
const exportItems = [
  { title: 'JSON', value: 'json' },
  { title: 'TSV', value: 'tsv' },
  { title: 'Markdown', value: 'markdown' },
]

const tooLarge = computed(() => text.value.length > LARGE_BYTES && !forceLarge.value)

const parsed = computed(() => (tooLarge.value ? null : parseCsv(text.value, delimiterOpt.value)))
const split = computed(() => splitHeader(parsed.value?.rows ?? [], hasHeader.value))
const body = computed(() => (sortCol.value >= 0 ? sortRows(split.value.body, sortCol.value, sortDir.value) : split.value.body))
const shown = computed(() => body.value.slice(0, MAX_RENDER))

const delimLabel = computed(() => {
  const d = parsed.value?.delimiter
  return d === '\t' ? 'Tab' : d === ' ' ? 'Space' : (d ?? '')
})

function onText(v: string | null) {
  text.value = v ?? ''
  fileName.value = ''
  forceLarge.value = false
  sortCol.value = -1
}

async function onFiles(files: File[]) {
  const f = files[0]
  if (!f) return
  onText(await f.text())
  fileName.value = f.name
}

function clearAll() {
  onText('')
}

function loadExample() {
  onText('name,city,score,note\n"Lee, Ann",Taipei,92.5,"likes ""tea"""\nBob,Tokyo,8,"two\nlines"\nCara,Seoul,101,\n')
}

function sortBy(i: number) {
  if (sortCol.value !== i) {
    sortCol.value = i
    sortDir.value = 'asc'
  } else if (sortDir.value === 'asc') sortDir.value = 'desc'
  else sortCol.value = -1
}

function sortIcon(i: number) {
  if (sortCol.value !== i) return 'mdi-unfold-more-horizontal'
  return sortDir.value === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down'
}

function ariaSort(i: number) {
  return sortCol.value !== i ? 'none' : sortDir.value === 'asc' ? 'ascending' : 'descending'
}

function exportText(): string {
  const { header } = split.value
  switch (exportFormat.value) {
    case 'json':
      return toJson(header, body.value, hasHeader.value)
    case 'tsv':
      return toTsv(hasHeader.value ? [header, ...body.value] : body.value)
    default:
      return toMarkdown(header, body.value)
  }
}

const EXT = { json: 'json', tsv: 'tsv', markdown: 'md' } as const
const MIME = { json: 'application/json;charset=utf-8', tsv: 'text/tab-separated-values;charset=utf-8', markdown: 'text/markdown;charset=utf-8' } as const

function download() {
  const base = fileName.value ? stripExtension(fileName.value) : 'table'
  downloadText(exportText(), `${base}.${EXT[exportFormat.value]}`, MIME[exportFormat.value])
}
</script>

<template>
  <ToolShell>
    <FileDrop accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" :hint="T('dropHint')" :show-selected="false" compact @files="onFiles" />

    <div v-if="fileName" class="d-flex align-center ga-2 mt-2">
      <v-chip size="small" prepend-icon="mdi-file-delimited-outline" closable @click:close="clearAll">{{ fileName }} ({{ formatBytes(text.length) }})</v-chip>
    </div>
    <template v-else>
      <v-textarea
        :model-value="text"
        :label="T('input')"
        rows="5"
        auto-grow
        max-rows="12"
        clearable
        hide-details
        class="code-area mt-3"
        @update:model-value="onText"
      />
      <div class="d-flex flex-wrap align-center ga-2 mt-2">
        <PasteBtn @paste="onText" />
        <v-btn variant="text" prepend-icon="mdi-lightbulb-outline" @click="loadExample">{{ t('common.loadExample') }}</v-btn>
      </div>
    </template>

    <v-row density="comfortable" class="mt-2" align="center">
      <v-col cols="12" sm="5">
        <v-select v-model="delimiterOpt" :items="delimiterItems" :label="T('delimiter')" density="compact" hide-details />
      </v-col>
      <v-col cols="12" sm="7">
        <v-switch v-model="hasHeader" :label="T('hasHeader')" density="compact" hide-details color="primary" />
      </v-col>
    </v-row>

    <v-alert v-if="tooLarge" type="warning" variant="tonal" class="mt-3" density="compact">
      {{ T('tooLarge', { size: formatBytes(text.length) }) }}
      <template #append>
        <v-btn size="small" variant="text" @click="forceLarge = true">{{ T('parseAnyway') }}</v-btn>
      </template>
    </v-alert>
    <v-alert v-else-if="parsed?.error" type="warning" variant="tonal" class="mt-3" density="compact">
      {{ T('parseWarning') }}: {{ parsed.error }}
    </v-alert>

    <template v-if="parsed && parsed.rows.length">
      <div class="d-flex flex-wrap align-center ga-2 mt-4">
        <v-chip size="small" label variant="tonal" class="tabular-nums">{{ T('rowCount', { n: split.body.length.toLocaleString() }) }}</v-chip>
        <v-chip size="small" label variant="tonal" class="tabular-nums">{{ T('colCount', { n: split.header.length.toLocaleString() }) }}</v-chip>
        <v-chip size="small" label variant="tonal">{{ T('detected') }}: {{ delimLabel }}</v-chip>
      </div>
      <v-alert v-if="body.length > MAX_RENDER" type="info" variant="tonal" density="compact" class="mt-2">
        {{ T('capped', { shown: MAX_RENDER.toLocaleString(), total: body.length.toLocaleString() }) }}
      </v-alert>

      <div class="csv-wrap mt-2">
        <table class="csv-table">
          <thead>
            <tr>
              <th class="text-right text-medium-emphasis">#</th>
              <th v-for="(h, i) in split.header" :key="i" :aria-sort="ariaSort(i)">
                <button type="button" class="sort-btn" :title="T('sortHint')" @click="sortBy(i)">
                  <span>{{ h }}</span>
                  <v-icon :icon="sortIcon(i)" size="14" :class="{ 'text-medium-emphasis': sortCol !== i }" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, ri) in shown" :key="ri">
              <td class="text-right text-medium-emphasis tabular-nums">{{ ri + 1 }}</td>
              <td v-for="(c, ci) in r" :key="ci">{{ c }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="d-flex flex-wrap align-center ga-2 mt-4">
        <v-select v-model="exportFormat" :items="exportItems" :label="T('exportAs')" density="compact" hide-details style="max-width: 180px" />
        <v-btn color="primary" prepend-icon="mdi-download" @click="download">{{ t('common.download') }}</v-btn>
        <v-btn variant="tonal" :prepend-icon="copied ? 'mdi-check' : 'mdi-content-copy'" @click="copy(exportText())">
          {{ copied ? t('common.copied') : t('common.copy') }}
        </v-btn>
      </div>
    </template>
    <p v-else-if="!tooLarge" class="text-body-2 text-medium-emphasis mt-4">{{ T('empty') }}</p>
  </ToolShell>
</template>

<style scoped>
.csv-wrap {
  max-height: 60vh;
  overflow: auto;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 8px;
}
.csv-table {
  border-collapse: collapse;
  font-size: 0.85rem;
  width: max-content;
  min-width: 100%;
}
.csv-table th,
.csv-table td {
  padding: 4px 10px;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.12);
  text-align: left;
  white-space: pre-wrap;
  max-width: 360px;
  vertical-align: top;
}
.csv-table th {
  position: sticky;
  top: 0;
  background: rgb(var(--v-theme-surface));
  z-index: 1;
}
.sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  cursor: pointer;
  color: inherit;
}
</style>
