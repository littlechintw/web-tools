<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { useHistory } from '@/composables/useHistory'

const TOOL_ID = 'hmac'
const { t } = useI18n()
const route = useRoute()

type Algo = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'
const ALGOS: Algo[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']

const history = useHistory<{ message: string; algorithm: Algo }>(TOOL_ID)

const message = ref('')
const secret = ref('')
const algorithm = ref<Algo>('SHA-256')
const computing = ref(false)

const hex = ref('')
const base64 = ref('')

function bufToHex(buf: ArrayBuffer): string {
  let out = ''
  for (const b of new Uint8Array(buf)) out += b.toString(16).padStart(2, '0')
  return out
}

function bufToBase64(buf: ArrayBuffer): string {
  let bin = ''
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b)
  return btoa(bin)
}

async function compute() {
  if (!message.value || !secret.value) {
    hex.value = ''
    base64.value = ''
    return
  }
  computing.value = true
  try {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret.value),
      { name: 'HMAC', hash: algorithm.value },
      false,
      ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message.value))
    hex.value = bufToHex(sig)
    base64.value = bufToBase64(sig)
  } finally {
    computing.value = false
  }
}

function save() {
  if (!message.value || !secret.value) return
  history.save(`${algorithm.value}: ${message.value.slice(0, 40)}`, {
    message: message.value,
    algorithm: algorithm.value,
  })
}

watch([message, secret, algorithm], () => {
  void compute()
  save()
})

onMounted(() => {
  const h = route.query.h as string | undefined
  if (h) {
    const e = history.entries.value.find((x) => x.id === h)
    if (e) {
      message.value = e.data.message
      algorithm.value = e.data.algorithm
    }
  }
})
</script>

<template>
  <ToolShell>
    <v-textarea
      v-model="message"
      :label="t('tools.hmac.message')"
      rows="4"
      auto-grow
      clearable
      class="code-area mb-3"
    />

    <div class="d-flex flex-wrap ga-4 align-start">
      <v-text-field
        v-model="secret"
        :label="t('tools.hmac.secret')"
        type="password"
        clearable
        hide-details
        class="flex-grow-1"
      />
      <v-select
        v-model="algorithm"
        :items="ALGOS"
        :label="t('tools.hmac.algorithm')"
        hide-details
        style="max-width: 200px"
      />
    </div>

    <v-progress-linear v-if="computing" indeterminate color="primary" class="mt-3" />

    <div class="mt-4">
      <div class="text-caption text-medium-emphasis">{{ t('tools.hmac.hex') }}</div>
      <div class="d-flex align-center ga-2">
        <v-text-field :model-value="hex" readonly hide-details density="compact" class="code-field flex-grow-1" />
        <CopyBtn :text="hex" icon />
      </div>
    </div>

    <div class="mt-3">
      <div class="text-caption text-medium-emphasis">{{ t('tools.hmac.base64') }}</div>
      <div class="d-flex align-center ga-2">
        <v-text-field :model-value="base64" readonly hide-details density="compact" class="code-field flex-grow-1" />
        <CopyBtn :text="base64" icon />
      </div>
    </div>
  </ToolShell>
</template>

<style scoped>
.code-area :deep(textarea),
.code-field :deep(input) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
}
</style>
