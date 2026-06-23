<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import bcrypt from 'bcryptjs'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'

const { t } = useI18n()

type Tab = 'hash' | 'verify'
const tab = ref<Tab>('hash')

// Hash tab
const text = ref('')
const rounds = ref(10)
const hashResult = ref('')
const hashing = ref(false)

function doHash() {
  if (!text.value) {
    hashResult.value = ''
    return
  }
  hashing.value = true
  try {
    hashResult.value = bcrypt.hashSync(text.value, rounds.value)
  } finally {
    hashing.value = false
  }
}

// Verify tab
const plaintext = ref('')
const hashToVerify = ref('')
const verifyResult = ref<boolean | null>(null)

function doVerify() {
  if (!plaintext.value || !hashToVerify.value) {
    verifyResult.value = null
    return
  }
  try {
    verifyResult.value = bcrypt.compareSync(plaintext.value, hashToVerify.value)
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
        />

        <div class="d-flex justify-space-between">
          <span class="text-body-2">{{ t('tools.bcrypt.rounds') }}</span>
          <span class="text-body-2 font-weight-bold">{{ rounds }}</span>
        </div>
        <v-slider v-model="rounds" :min="4" :max="15" :step="1" hide-details class="mb-2" />

        <v-btn color="primary" prepend-icon="mdi-lock" :loading="hashing" @click="doHash">
          {{ t('tools.bcrypt.generate') }}
        </v-btn>

        <template v-if="hashResult">
          <div class="text-caption text-medium-emphasis mt-4">{{ t('tools.bcrypt.hashResult') }}</div>
          <div class="d-flex align-center ga-2">
            <v-text-field :model-value="hashResult" readonly hide-details density="compact" class="code-field flex-grow-1" />
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
        />
        <v-text-field
          v-model="hashToVerify"
          :label="t('tools.bcrypt.hashToVerify')"
          clearable
          hide-details
          class="code-field mb-4"
          @update:model-value="verifyResult = null"
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

<style scoped>
.code-field :deep(input) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
}
</style>
