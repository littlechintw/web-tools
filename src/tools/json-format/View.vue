<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { useHistory } from '@/composables/useHistory'

const TOOL_ID = 'json-format'
const { t } = useI18n()
const route = useRoute()
const history = useHistory<{ input: string; indent: IndentKey }>(TOOL_ID)

type IndentKey = '2' | '4' | 'tab'
const input = ref('')
const indent = ref<IndentKey>('2')
const output = ref('')
const error = ref('')
const valid = ref(false)

function indentStr(): string | number {
  if (indent.value === 'tab') return '\t'
  return Number(indent.value)
}

function sortRecursive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortRecursive)
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(obj).sort()) out[k] = sortRecursive(obj[k])
    return out
  }
  return value
}

function parse(): unknown | undefined {
  error.value = ''
  valid.value = false
  if (!input.value.trim()) {
    output.value = ''
    return undefined
  }
  try {
    const data = JSON.parse(input.value)
    valid.value = true
    return data
  } catch (e) {
    error.value = t('tools.json-format.parseError', { msg: (e as Error).message })
    return undefined
  }
}

function format() {
  const data = parse()
  if (data === undefined && !valid.value) return
  output.value = JSON.stringify(data, null, indentStr())
}

function minify() {
  const data = parse()
  if (data === undefined && !valid.value) return
  output.value = JSON.stringify(data)
}

function sortKeys() {
  const data = parse()
  if (data === undefined && !valid.value) return
  output.value = JSON.stringify(sortRecursive(data), null, indentStr())
}

function download() {
  if (!output.value) return
  const blob = new Blob([output.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'data.json'
  a.click()
  URL.revokeObjectURL(url)
}

function save() {
  if (!input.value.trim()) return
  history.save(input.value.slice(0, 40), { input: input.value, indent: indent.value })
}

// live validation only (no output mutation)
watch(input, () => {
  parse()
})

watch(input, () => save())

onMounted(() => {
  const h = route.query.h as string | undefined
  if (h) {
    const e = history.entries.value.find((x) => x.id === h)
    if (e) {
      input.value = e.data.input
      indent.value = e.data.indent
    }
  }
})
</script>

<template>
  <ToolShell>
    <v-textarea
      v-model="input"
      :label="t('tools.json-format.inputJson')"
      rows="8"
      auto-grow
      clearable
      class="code-area"
    />

    <div class="d-flex flex-wrap align-center ga-3 mt-2">
      <v-select
        v-model="indent"
        :label="t('tools.json-format.indent')"
        :items="[
          { title: t('tools.json-format.indent2'), value: '2' },
          { title: t('tools.json-format.indent4'), value: '4' },
          { title: t('tools.json-format.indentTab'), value: 'tab' },
        ]"
        density="compact"
        hide-details
        style="max-width: 160px"
      />
      <v-btn color="primary" variant="flat" @click="format">{{ t('tools.json-format.format') }}</v-btn>
      <v-btn color="primary" variant="tonal" @click="minify">{{ t('tools.json-format.minify') }}</v-btn>
      <v-btn color="primary" variant="tonal" @click="sortKeys">{{ t('tools.json-format.sortKeys') }}</v-btn>
    </div>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mt-3"
      :text="error"
    />
    <v-alert
      v-else-if="valid"
      type="success"
      variant="tonal"
      density="compact"
      class="mt-3"
      :text="t('tools.json-format.valid')"
    />

    <v-textarea
      :model-value="output"
      :label="t('common.output')"
      rows="8"
      auto-grow
      readonly
      class="code-area mt-3"
    />

    <div class="d-flex ga-2 mt-2">
      <CopyBtn :text="output" />
      <v-btn variant="tonal" prepend-icon="mdi-download" :disabled="!output" @click="download">
        {{ t('tools.json-format.download') }}
      </v-btn>
    </div>
  </ToolShell>
</template>

<style scoped>
.code-area :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
}
</style>
