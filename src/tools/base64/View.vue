<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import OutputPanel from '@/components/OutputPanel.vue'
import { useHistory } from '@/composables/useHistory'
import { isBoolean, useStoredRef } from '@/composables/useStoredRef'
import { base64ToBytes, bytesToBase64 } from '@/utils/bytes'
import { downloadBytes } from '@/utils/download'
import { formatBytes } from '@/utils/format'

const TOOL_ID = 'base64'
const { t } = useI18n()
const T = (key: string, args?: Record<string, unknown>) => t(`tools.${TOOL_ID}.${key}`, args ?? {})

type Mode = 'encode' | 'decode'
const history = useHistory<{ mode: Mode; urlSafe: boolean; input: string }>(TOOL_ID)

const mode = ref<Mode>('encode')
// Remembered between visits: it's a preference, not part of the data.
const urlSafe = useStoredRef('base64.urlSafe', false, isBoolean)
const input = ref('')
const error = ref('')
// Set when the Base64 is valid but doesn't decode to UTF-8 text (an image,
// a zip…): we can't show it, but we can hand it over as a file.
const binary = ref<Uint8Array | null>(null)

const output = computed(() => {
  error.value = ''
  binary.value = null
  if (!input.value) return ''
  try {
    if (mode.value === 'encode') {
      return bytesToBase64(new TextEncoder().encode(input.value), urlSafe.value)
    }
    const bytes = base64ToBytes(input.value)
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      binary.value = bytes
      return ''
    }
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
  input.value = 'Hello, 世界! 👋'
}

function downloadBinary() {
  if (binary.value) downloadBytes(binary.value, 'decoded.bin')
}

function save() {
  if (!input.value) return
  const label = `${T(mode.value)}: ${input.value.slice(0, 40)}`
  history.save(label, { mode: mode.value, urlSafe: urlSafe.value, input: input.value })
}

watch([input, mode], () => save())

history.restoreFromRoute((d) => {
  mode.value = d.mode
  urlSafe.value = d.urlSafe
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
      <v-checkbox v-model="urlSafe" :label="T('urlSafe')" hide-details density="compact" />
    </div>

    <v-textarea
      v-model="input"
      :label="mode === 'encode' ? T('inputText') : T('inputBase64')"
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

    <v-alert v-if="binary" type="info" variant="tonal" density="compact" class="mt-3">
      <div class="d-flex flex-wrap align-center ga-3">
        <span>{{ T('notText', { size: formatBytes(binary.length) }) }}</span>
        <v-btn size="small" color="primary" variant="flat" prepend-icon="mdi-download" @click="downloadBinary">
          {{ T('downloadBinary') }}
        </v-btn>
      </div>
    </v-alert>
  </ToolShell>
</template>
