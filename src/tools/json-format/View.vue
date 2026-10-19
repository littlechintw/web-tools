<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import OutputPanel from '@/components/OutputPanel.vue'
import { useHistory } from '@/composables/useHistory'
import { oneOf, useStoredRef } from '@/composables/useStoredRef'

const TOOL_ID = 'json-format'
const { t } = useI18n()
const T = (key: string, args?: Record<string, unknown>) => t(`tools.${TOOL_ID}.${key}`, args ?? {})

type IndentKey = '2' | '4' | 'tab'
const history = useHistory<{ input: string; indent: IndentKey }>(TOOL_ID)

const input = ref('')
const indent = useStoredRef<IndentKey>('json-format.indent', '2', oneOf(['2', '4', 'tab']))
const output = ref('')
const error = ref('')
/** "Line x, column y" of the parse error, when the engine's message says where it happened. */
const errorPos = ref('')
const valid = ref(false)

// Minify / Sort keys produce a result that auto-format must not overwrite
// until the input itself changes again.
type Manual = 'minify' | 'sort' | null
let manual: Manual = null

const AUTO_FORMAT_DELAY = 250
let timer: ReturnType<typeof setTimeout> | undefined

function indentStr(): string | number {
  return indent.value === 'tab' ? '\t' : Number(indent.value)
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

function locateError(message: string, text: string): string {
  // Firefox and recent V8 spell out the line/column; older V8 only gives an offset.
  const lc = /line (\d+),? column (\d+)/i.exec(message)
  if (lc) return T('errorAt', { line: Number(lc[1]), column: Number(lc[2]) })
  const pos = /position (\d+)/i.exec(message)
  if (!pos) return ''
  const lines = text.slice(0, Number(pos[1])).split('\n')
  return T('errorAt', { line: lines.length, column: lines[lines.length - 1].length + 1 })
}

function parse(): { ok: true; data: unknown } | { ok: false } {
  error.value = ''
  errorPos.value = ''
  valid.value = false
  if (!input.value.trim()) {
    output.value = ''
    return { ok: false }
  }
  try {
    const data: unknown = JSON.parse(input.value)
    valid.value = true
    return { ok: true, data }
  } catch (e) {
    const msg = (e as Error).message
    error.value = T('parseError', { msg })
    errorPos.value = locateError(msg, input.value)
    return { ok: false }
  }
}

function format() {
  manual = null
  const r = parse()
  if (r.ok) output.value = JSON.stringify(r.data, null, indentStr())
}

function minify() {
  const r = parse()
  if (!r.ok) return
  manual = 'minify'
  output.value = JSON.stringify(r.data)
}

function sortKeys() {
  const r = parse()
  if (!r.ok) return
  manual = 'sort'
  output.value = JSON.stringify(sortRecursive(r.data), null, indentStr())
}

function scheduleAutoFormat() {
  clearTimeout(timer)
  timer = setTimeout(format, AUTO_FORMAT_DELAY)
}

function loadExample() {
  input.value = '{"name":"Widget","tags":["red","small"],"price":9.99,"stock":{"warehouse":12,"retail":3},"active":true}'
}

function save() {
  if (!input.value.trim()) return
  history.save(input.value.slice(0, 40), { input: input.value, indent: indent.value })
}

watch(input, () => {
  manual = null
  scheduleAutoFormat()
  save()
})

watch(indent, () => {
  if (manual === 'minify') return // no whitespace to re-indent
  if (manual === 'sort') sortKeys()
  else format()
})

onBeforeUnmount(() => clearTimeout(timer))

history.restoreFromRoute((d) => {
  input.value = d.input
  indent.value = d.indent
})
</script>

<template>
  <ToolShell>
    <v-textarea
      v-model="input"
      :label="T('inputJson')"
      :error="!!error"
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

    <div class="d-flex flex-wrap align-center ga-3 mt-3">
      <v-select
        v-model="indent"
        :label="T('indent')"
        :items="[
          { title: T('indent2'), value: '2' },
          { title: T('indent4'), value: '4' },
          { title: T('indentTab'), value: 'tab' },
        ]"
        density="compact"
        hide-details
        style="max-width: 160px"
      />
      <v-btn color="primary" variant="flat" :disabled="!input.trim()" @click="format">{{ T('format') }}</v-btn>
      <v-btn color="primary" variant="tonal" :disabled="!input.trim()" @click="minify">{{ T('minify') }}</v-btn>
      <v-btn color="primary" variant="tonal" :disabled="!input.trim()" @click="sortKeys">{{ T('sortKeys') }}</v-btn>
      <v-chip v-if="valid" color="success" variant="tonal" size="small" prepend-icon="mdi-check-circle-outline">
        {{ T('valid') }}
      </v-chip>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-3">
      <div>{{ error }}</div>
      <div v-if="errorPos" class="text-caption mt-1">{{ errorPos }}</div>
    </v-alert>

    <OutputPanel class="mt-4" :value="output" :rows="8" filename="data.json" mime="application/json;charset=utf-8" />
  </ToolShell>
</template>
