<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { useHistory } from '@/composables/useHistory'

const TOOL_ID = 'base64'
const { t } = useI18n()
const route = useRoute()
const history = useHistory<{ mode: Mode; urlSafe: boolean; input: string }>(TOOL_ID)

type Mode = 'encode' | 'decode'
const mode = ref<Mode>('encode')
const urlSafe = ref(false)
const input = ref('')
const error = ref('')

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const output = computed(() => {
  error.value = ''
  if (!input.value) return ''
  try {
    if (mode.value === 'encode') {
      let b64 = bytesToBase64(new TextEncoder().encode(input.value))
      if (urlSafe.value) b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      return b64
    } else {
      let b64 = input.value.trim()
      if (urlSafe.value) b64 = b64.replace(/-/g, '+').replace(/_/g, '/')
      // restore padding
      while (b64.length % 4) b64 += '='
      return new TextDecoder().decode(base64ToBytes(b64))
    }
  } catch {
    error.value = t('tools.base64.decodeError')
    return ''
  }
})

function save() {
  if (!input.value) return
  const label = `${t('tools.base64.' + mode.value)}: ${input.value.slice(0, 40)}`
  history.save(label, { mode: mode.value, urlSafe: urlSafe.value, input: input.value })
}

watch([input, mode], () => save())

onMounted(() => {
  const h = route.query.h as string | undefined
  if (h) {
    const e = history.entries.value.find((x) => x.id === h)
    if (e) {
      mode.value = e.data.mode
      urlSafe.value = e.data.urlSafe
      input.value = e.data.input
    }
  }
})
</script>

<template>
  <ToolShell>
    <div class="d-flex flex-wrap align-center ga-4 mb-4">
      <v-btn-toggle v-model="mode" mandatory color="primary" density="comfortable" variant="outlined">
        <v-btn value="encode">{{ t('tools.base64.encode') }}</v-btn>
        <v-btn value="decode">{{ t('tools.base64.decode') }}</v-btn>
      </v-btn-toggle>
      <v-checkbox v-model="urlSafe" :label="t('tools.base64.urlSafe')" hide-details density="compact" />
    </div>

    <v-textarea
      v-model="input"
      :label="mode === 'encode' ? t('tools.base64.inputText') : t('tools.base64.inputBase64')"
      rows="5"
      auto-grow
      clearable
      class="code-area"
    />

    <v-textarea
      :model-value="output"
      :label="t('common.output')"
      :error-messages="error"
      rows="5"
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
