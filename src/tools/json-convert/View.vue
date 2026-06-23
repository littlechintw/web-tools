<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { load as yamlLoad, dump as yamlDump } from 'js-yaml'
import { parse as tomlParse, stringify as tomlStringify } from 'smol-toml'
import Papa from 'papaparse'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { useHistory } from '@/composables/useHistory'

const TOOL_ID = 'json-convert'
const { t } = useI18n()
const route = useRoute()

type Format = 'json' | 'yaml' | 'toml' | 'csv'
const FORMATS: Format[] = ['json', 'yaml', 'toml', 'csv']
const FORMAT_ITEMS = FORMATS.map((f) => ({ title: f.toUpperCase(), value: f }))

const history = useHistory<{ source: Format; target: Format; input: string }>(TOOL_ID)

const source = ref<Format>('json')
const target = ref<Format>('yaml')
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
      const res = Papa.parse(text.trim(), { header: true, skipEmptyLines: true })
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
      return Papa.unparse(rows as object[])
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
    error.value = `${t('tools.json-convert.parseError')}: ${(e as Error).message}`
    return ''
  }
  try {
    return emit(obj, target.value)
  } catch (e) {
    error.value = `${t('tools.json-convert.convertError')}: ${(e as Error).message}`
    return ''
  }
})

function save() {
  if (!input.value.trim()) return
  const label = `${source.value} → ${target.value}: ${input.value.slice(0, 30)}`
  history.save(label, { source: source.value, target: target.value, input: input.value })
}

watch([input, source, target], () => save())

onMounted(() => {
  const h = route.query.h as string | undefined
  if (h) {
    const e = history.entries.value.find((x) => x.id === h)
    if (e) {
      source.value = e.data.source
      target.value = e.data.target
      input.value = e.data.input
    }
  }
})
</script>

<template>
  <ToolShell>
    <div class="d-flex flex-wrap align-center ga-4 mb-4">
      <v-select
        v-model="source"
        :items="FORMAT_ITEMS"
        :label="t('tools.json-convert.sourceFormat')"
        density="compact"
        hide-details
        style="max-width: 200px"
      />
      <v-icon icon="mdi-arrow-right" />
      <v-select
        v-model="target"
        :items="FORMAT_ITEMS"
        :label="t('tools.json-convert.targetFormat')"
        density="compact"
        hide-details
        style="max-width: 200px"
      />
    </div>

    <v-textarea
      v-model="input"
      :label="t('tools.json-convert.inputData')"
      rows="8"
      auto-grow
      clearable
      class="code-area"
    />

    <p v-if="target === 'csv' || source === 'csv'" class="text-caption text-medium-emphasis mt-1">
      {{ t('tools.json-convert.csvNote') }}
    </p>

    <v-textarea
      :model-value="output"
      :label="t('common.output')"
      :error-messages="error"
      rows="8"
      auto-grow
      readonly
      class="code-area mt-2"
    />

    <div class="d-flex ga-2 mt-2">
      <CopyBtn :text="output" />
    </div>
  </ToolShell>
</template>

<style scoped>
.code-area :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
}
</style>
