<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import OutputPanel from '@/components/OutputPanel.vue'
import { oneOf, useStoredRef } from '@/composables/useStoredRef'
import { convert, FORMATS, type Format } from '@/lib/yamlToml'

const TOOL_ID = 'yaml-toml'
const { t } = useI18n()
const T = (key: string, named?: Record<string, unknown>) => t(`tools.${TOOL_ID}.${key}`, named ?? {})

const source = useStoredRef<Format>('yaml-toml.source', 'yaml', oneOf(FORMATS))
const target = useStoredRef<Format>('yaml-toml.target', 'json', oneOf(FORMATS))
const indent = useStoredRef<2 | 4>('yaml-toml.indent', 2, oneOf([2, 4] as const))
const input = ref('')

const formatItems = FORMATS.map((f) => ({ title: f.toUpperCase(), value: f }))
const indentItems = [
  { title: '2', value: 2 },
  { title: '4', value: 4 },
]
const MIME: Record<Format, string> = {
  yaml: 'application/yaml;charset=utf-8',
  toml: 'application/toml;charset=utf-8',
  json: 'application/json;charset=utf-8',
}

const result = computed(() => convert(input.value, source.value, target.value, indent.value))

const error = computed(() => {
  const r = result.value
  if (r.ok) return ''
  if (r.parseError) {
    const { line, column, message } = r.parseError
    const where = line ? ` (${T('lineCol', { line, col: column ?? '?' })})` : ''
    return `${T('parseError')}: ${message}${where}`
  }
  if (r.message === 'TOML_TOP_LEVEL') return T('tomlTopLevel')
  if (r.message === 'TOML_NULL_IN_ARRAY') return T('tomlNullInArray')
  return `${T('convertError')}: ${r.message}`
})

const status = computed(() => (input.value.trim() && result.value.ok ? (source.value === target.value ? 'formatted' : 'converted') : ''))
const nullWarn = computed(() => result.value.droppedNulls.join(', '))
const showTomlNote = computed(() => target.value === 'toml' && source.value !== 'toml')

function swap() {
  const out = result.value.ok ? result.value.text : ''
  const s = source.value
  source.value = target.value
  target.value = s
  if (out) input.value = out
}

function loadExample() {
  source.value = 'yaml'
  input.value = 'name: web-tools\nversion: 1.2\nenabled: true\ntags:\n  - alpha\n  - beta\nserver:\n  host: localhost\n  port: 8080\n'
}
</script>

<template>
  <ToolShell>
    <div class="d-flex flex-wrap align-center ga-3 mb-4">
      <v-select v-model="source" :items="formatItems" :label="T('from')" density="compact" hide-details style="max-width: 140px" />
      <v-btn icon="mdi-swap-horizontal" variant="text" :title="t('common.swap')" :aria-label="t('common.swap')" @click="swap" />
      <v-select v-model="target" :items="formatItems" :label="T('to')" density="compact" hide-details style="max-width: 140px" />
      <v-select v-model="indent" :items="indentItems" :label="T('indent')" density="compact" hide-details style="max-width: 110px" />
    </div>

    <v-textarea v-model="input" :label="t('common.input')" rows="10" auto-grow max-rows="24" clearable hide-details class="code-area" spellcheck="false" />
    <div class="d-flex flex-wrap align-center ga-2 mt-2">
      <PasteBtn @paste="input = $event" />
      <v-btn variant="text" prepend-icon="mdi-lightbulb-outline" @click="loadExample">{{ t('common.loadExample') }}</v-btn>
      <v-chip v-if="status" size="small" color="success" variant="tonal" prepend-icon="mdi-check-circle-outline">
        {{ status === 'formatted' ? T('validFormatted') : T('validConverted') }}
      </v-chip>
    </div>

    <v-alert v-if="showTomlNote" type="info" variant="tonal" density="compact" class="mt-3">{{ T('tomlNote') }}</v-alert>
    <v-alert v-if="nullWarn" type="warning" variant="tonal" density="compact" class="mt-3">
      {{ T('nullsDropped') }} <span class="font-mono break-all">{{ nullWarn }}</span>
    </v-alert>

    <OutputPanel class="mt-4" :value="result.ok ? result.text : ''" :error="error" :rows="10" :filename="`data.${target === 'yaml' ? 'yaml' : target}`" :mime="MIME[target]" />
  </ToolShell>
</template>
