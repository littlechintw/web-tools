<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import bcrypt from 'bcryptjs'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { isNumber, useStoredRef } from '@/composables/useStoredRef'

const { t } = useI18n()

type Tab = 'hash' | 'verify'
const tab = ref<Tab>('hash')

const MIN_ROUNDS = 4
const MAX_ROUNDS = 15
const isRounds = (v: unknown): v is number =>
  isNumber(v) && Number.isInteger(v) && v >= MIN_ROUNDS && v <= MAX_ROUNDS

// Hash tab
const text = ref('')
// The cost factor is a preference, remembered between visits.
const rounds = useStoredRef('bcrypt.rounds', 10, isRounds)
const hashResult = ref('')
const hashing = ref(false)

async function doHash() {
  if (hashing.value) return
  if (!text.value) {
    hashResult.value = ''
    return
  }
  hashing.value = true
  try {
    // async hash yields periodically, so high rounds show the spinner
    // instead of freezing the UI
    hashResult.value = await bcrypt.hash(text.value, rounds.value)
  } finally {
    hashing.value = false
  }
}

// Verify tab
const plaintext = ref('')
const hashToVerify = ref('')
const verifyResult = ref<boolean | null>(null)

async function doVerify() {
  if (!plaintext.value || !hashToVerify.value) {
    verifyResult.value = null
    return
  }
  try {
    verifyResult.value = await bcrypt.compare(plaintext.value, hashToVerify.value)
  } catch {
    verifyResult.value = false
  }
}
</script>

<template>
  <ToolShell>
    <v-tabs v-model="tab" color="primary" class="mb-4">
      <v-tab value="hash">{{ t('tools.bcrypt.hashTab') }}</v-tab>
      <v-tab value="verify">{{ t('tools.bcrypt.verifyTab') }}</v-tab>
    </v-tabs>

    <v-window v-model="tab">
      <v-window-item value="hash">
        <v-text-field
          v-model="text"
          :label="t('tools.bcrypt.inputText')"
          clearable
          hide-details
          class="mb-4"
          @keydown.enter="doHash"
        />

        <div class="d-flex justify-space-between">
          <span class="text-body-2">{{ t('tools.bcrypt.rounds') }}</span>
          <span class="text-body-2 font-weight-bold tabular-nums">{{ rounds }}</span>
        </div>
        <v-slider v-model="rounds" :min="MIN_ROUNDS" :max="MAX_ROUNDS" :step="1" hide-details />
        <div class="text-caption text-medium-emphasis mb-3">{{ t('tools.bcrypt.roundsHint') }}</div>

        <v-btn color="primary" prepend-icon="mdi-lock" :loading="hashing" @click="doHash">
          {{ t('tools.bcrypt.generate') }}
        </v-btn>

        <template v-if="hashResult">
          <div class="text-caption text-medium-emphasis mt-4">{{ t('tools.bcrypt.hashResult') }}</div>
          <div class="d-flex align-center ga-2">
            <v-text-field :model-value="hashResult" readonly hide-details density="compact" class="code-area flex-grow-1" />
            <CopyBtn :text="hashResult" icon />
          </div>
        </template>
      </v-window-item>

      <v-window-item value="verify">
        <v-text-field
          v-model="plaintext"
          :label="t('tools.bcrypt.plaintext')"
          clearable
          hide-details
          class="mb-4"
          @update:model-value="verifyResult = null"
          @keydown.enter="doVerify"
        />
        <v-text-field
          v-model="hashToVerify"
          :label="t('tools.bcrypt.hashToVerify')"
          clearable
          hide-details
          class="code-area mb-4"
          @update:model-value="verifyResult = null"
          @keydown.enter="doVerify"
        />

        <v-btn color="primary" prepend-icon="mdi-check-decagram" @click="doVerify">
          {{ t('tools.bcrypt.verify') }}
        </v-btn>

        <div v-if="verifyResult !== null" class="mt-4">
          <v-chip v-if="verifyResult" color="success" prepend-icon="mdi-check-circle" size="large">
            {{ t('tools.bcrypt.match') }}
          </v-chip>
          <v-chip v-else color="error" prepend-icon="mdi-close-circle" size="large">
            {{ t('tools.bcrypt.noMatch') }}
          </v-chip>
        </div>
      </v-window-item>
    </v-window>
  </ToolShell>
</template>
