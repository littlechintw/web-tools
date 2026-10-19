<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import OutputPanel from '@/components/OutputPanel.vue'
import { useHistory } from '@/composables/useHistory'
import { oneOf, useStoredRef } from '@/composables/useStoredRef'

const TOOL_ID = 'url-encode'
const { t } = useI18n()
const T = (key: string, args?: Record<string, unknown>) => t(`tools.${TOOL_ID}.${key}`, args ?? {})

type Mode = 'encode' | 'decode'
type Scope = 'component' | 'full'
const history = useHistory<{ mode: Mode; scope: Scope; input: string }>(TOOL_ID)

const mode = ref<Mode>('encode')
// Remembered between visits: which encoder to use is a preference, not data.
const scope = useStoredRef<Scope>('url-encode.scope', 'component', oneOf(['component', 'full']))
const input = ref('')
const error = ref('')

const output = computed(() => {
  error.value = ''
  if (!input.value) return ''
  try {
    if (mode.value === 'encode') {
      return scope.value === 'component' ? encodeURIComponent(input.value) : encodeURI(input.value)
    }
    return scope.value === 'component' ? decodeURIComponent(input.value) : decodeURI(input.value)
  } catch {
    error.value = T('decodeError')
    return ''
  }
})

function swap() {
  const next = output.value
  mode.value = mode.value === 'encode' ? 'decode' : 'encode'
  input.value = next
}

function loadExample() {
  mode.value = 'encode'
  input.value = 'https://example.com/search results?q=咖啡 拿鐵&lang=zh-TW'
}

function save() {
  if (!input.value) return
  const label = `${T(mode.value)}: ${input.value.slice(0, 40)}`
  history.save(label, { mode: mode.value, scope: scope.value, input: input.value })
}

watch([input, mode, scope], () => save())

history.restoreFromRoute((d) => {
  mode.value = d.mode
  scope.value = d.scope
  input.value = d.input
})
</script>

<template>
  <ToolShell>
    <div class="d-flex flex-wrap align-center ga-4 mb-4">
      <v-btn-toggle v-model="mode" mandatory color="primary" density="comfortable" variant="outlined" divided>
        <v-btn value="encode" prepend-icon="mdi-lock-outline">{{ T('encode') }}</v-btn>
        <v-btn value="decode" prepend-icon="mdi-lock-open-variant-outline">{{ T('decode') }}</v-btn>
      </v-btn-toggle>
      <v-btn-toggle v-model="scope" mandatory color="primary" density="comfortable" variant="outlined" divided>
        <v-btn value="component">{{ T('component') }}</v-btn>
        <v-btn value="full">{{ T('full') }}</v-btn>
      </v-btn-toggle>
    </div>

    <v-textarea
      v-model="input"
      :label="mode === 'encode' ? T('inputText') : T('inputEncoded')"
      rows="5"
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
      <v-spacer />
      <v-btn
        variant="text"
        prepend-icon="mdi-swap-vertical"
        :disabled="!output"
        :title="T('swapHint')"
        @click="swap"
      >
        {{ t('common.swap') }}
      </v-btn>
    </div>

    <OutputPanel
      class="mt-4"
      :value="output"
      :error="error"
      :filename="mode === 'encode' ? 'encoded.txt' : 'decoded.txt'"
    />
  </ToolShell>
</template>
