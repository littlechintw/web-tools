<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { load as yamlLoad, dump as yamlDump } from 'js-yaml'
import { parse as tomlParse, stringify as tomlStringify } from 'smol-toml'
import Papa from 'papaparse'
import ToolShell from '@/components/ToolShell.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import OutputPanel from '@/components/OutputPanel.vue'
import { useHistory } from '@/composables/useHistory'
import { oneOf, useStoredRef } from '@/composables/useStoredRef'

const TOOL_ID = 'json-convert'
const { t } = useI18n()
const T = (key: string) => t(`tools.${TOOL_ID}.${key}`)

const FORMATS = ['json', 'yaml', 'toml', 'csv'] as const
type Format = (typeof FORMATS)[number]
const FORMAT_ITEMS = FORMATS.map((f) => ({ title: f.toUpperCase(), value: f }))
const MIME: Record<Format, string> = {
  json: 'application/json;charset=utf-8',
  yaml: 'application/yaml;charset=utf-8',
  toml: 'application/toml;charset=utf-8',
  csv: 'text/csv;charset=utf-8',
}

const history = useHistory<{ source: Format; target: Format; input: string }>(TOOL_ID)

const source = useStoredRef<Format>('json-convert.source', 'json', oneOf(FORMATS))
const target = useStoredRef<Format>('json-convert.target', 'yaml', oneOf(FORMATS))
const input = ref('')
const error = ref('')

function parseInput(text: string, fmt: Format): unknown {
  switch (fmt) {
    case 'json':
      return JSON.parse(text)
    case 'yaml':
      return yamlLoad(text)
    case 'toml':
      return tomlParse(text)
    case 'csv': {
      const res = Papa.parse(text.trim(), {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      })
      if (res.errors.length) throw new Error(res.errors[0].message)
      return res.data
    }
  }
}

function emit(obj: unknown, fmt: Format): string {
  switch (fmt) {
    case 'json':
      return JSON.stringify(obj, null, 2)
    case 'yaml':
      return yamlDump(obj)
    case 'toml':
      return tomlStringify(obj as Record<string, unknown>)
    case 'csv': {
      const rows = Array.isArray(obj) ? obj : [obj]
      // CSV cells are scalar; serialize nested objects/arrays as JSON instead
      // of letting them stringify to "[object Object]".
      const flat = (rows as Record<string, unknown>[]).map((row) => {
        if (typeof row !== 'object' || row === null) return row
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(row)) {
          out[k] = typeof v === 'object' && v !== null ? JSON.stringify(v) : v
        }
        return out
      })
      return Papa.unparse(flat as object[])
    }
  }
}

const output = computed(() => {
  error.value = ''
  if (!input.value.trim()) return ''
  let obj: unknown
  try {
    obj = parseInput(input.value, source.value)
  } catch (e) {
    error.value = `${T('parseError')}: ${(e as Error).message}`
    return ''
  }
  try {
    return emit(obj, target.value)
  } catch (e) {
    error.value = `${T('convertError')}: ${(e as Error).message}`
    return ''
  }
})

const filename = computed(() => `data.${target.value}`)

/** Flip the direction; a valid result becomes the new input. */
function swap() {
  const next = output.value
  const s = source.value
  source.value = target.value
  target.value = s
  if (next) input.value = next
}

function loadExample() {
  source.value = 'json'
  input.value = JSON.stringify(
    { name: 'Widget', price: 9.99, inStock: true, tags: ['red', 'small'], dimensions: { width: 10, height: 4 } },
    null,
    2,
  )
}

function save() {
  if (!input.value.trim()) return
  const label = `${source.value} → ${target.value}: ${input.value.slice(0, 30)}`
  history.save(label, { source: source.value, target: target.value, input: input.value })
}

watch([input, source, target], () => save())

history.restoreFromRoute((d) => {
  source.value = d.source
  target.value = d.target
  input.value = d.input
})
</script>

<template>
  <ToolShell>
    <div class="d-flex flex-wrap align-center ga-4 mb-4">
      <v-select
        v-model="source"
        :items="FORMAT_ITEMS"
        :label="T('sourceFormat')"
        density="compact"
        hide-details
        style="max-width: 200px"
      />
      <v-btn
        icon="mdi-swap-horizontal"
        variant="text"
        :title="T('swapHint')"
        :aria-label="t('common.swap')"
        @click="swap"
      />
      <v-select
        v-model="target"
        :items="FORMAT_ITEMS"
        :label="T('targetFormat')"
        density="compact"
        hide-details
        style="max-width: 200px"
      />
    </div>

    <v-textarea
      v-model="input"
      :label="T('inputData')"
      rows="8"
      auto-grow
      clearable
      hide-details
      class="code-area"
    />
    <div class="d-flex flex-wrap align-center ga-2 mt-2">
      <PasteBtn @paste="input = $event" />
      <v-btn variant="text" prepend-icon="mdi-lightbulb-outline" @click="loadExample">
        {{ t('common.loadExample') }}
      </v-btn>
    </div>

    <p v-if="target === 'csv' || source === 'csv'" class="text-caption text-medium-emphasis mt-2 mb-0">
      {{ T('csvNote') }}
    </p>

    <OutputPanel class="mt-4" :value="output" :error="error" :rows="8" :filename="filename" :mime="MIME[target]" />
  </ToolShell>
</template>
