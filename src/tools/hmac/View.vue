<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import { useHistory } from '@/composables/useHistory'
import { oneOf, useStoredRef } from '@/composables/useStoredRef'
import { bytesToBase64, bytesToHex } from '@/utils/bytes'

const TOOL_ID = 'hmac'
const { t } = useI18n()

type Algo = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'
const ALGOS: Algo[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']

const history = useHistory<{ message: string; algorithm: Algo }>(TOOL_ID)

const message = ref('')
const secret = ref('')
const showSecret = ref(false)
// The algorithm is a preference, remembered between visits.
const algorithm = useStoredRef<Algo>('hmac.algorithm', 'SHA-256', oneOf(ALGOS))
const computing = ref(false)

const hex = ref('')
const base64 = ref('')

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
    hex.value = bytesToHex(sig)
    base64.value = bytesToBase64(sig)
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

history.restoreFromRoute((d) => {
  message.value = d.message
  algorithm.value = d.algorithm
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
      hide-details
      class="code-area"
    />
    <div class="d-flex flex-wrap align-center ga-2 mt-2 mb-3">
      <PasteBtn @paste="message = $event" />
    </div>

    <div class="d-flex flex-wrap ga-4 align-start">
      <v-text-field
        v-model="secret"
        :label="t('tools.hmac.secret')"
        :type="showSecret ? 'text' : 'password'"
        clearable
        hide-details
        class="flex-grow-1"
      >
        <template #append-inner>
          <v-btn
            :icon="showSecret ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            variant="text"
            size="small"
            density="comfortable"
            :title="showSecret ? t('tools.hmac.hideSecret') : t('tools.hmac.showSecret')"
            :aria-label="showSecret ? t('tools.hmac.hideSecret') : t('tools.hmac.showSecret')"
            :aria-pressed="showSecret"
            @click="showSecret = !showSecret"
          />
        </template>
      </v-text-field>
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
        <v-text-field :model-value="hex" readonly hide-details density="compact" class="code-area flex-grow-1" />
        <CopyBtn :text="hex" icon />
      </div>
    </div>

    <div class="mt-3">
      <div class="text-caption text-medium-emphasis">{{ t('tools.hmac.base64') }}</div>
      <div class="d-flex align-center ga-2">
        <v-text-field :model-value="base64" readonly hide-details density="compact" class="code-area flex-grow-1" />
        <CopyBtn :text="base64" icon />
      </div>
    </div>
  </ToolShell>
</template>
