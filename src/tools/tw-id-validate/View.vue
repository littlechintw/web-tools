<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { oneOf, useStoredRef } from '@/composables/useStoredRef'
import { generateTestBusinessNo, generateTestId, validateBusinessNo, validateId, type IdKind } from '@/lib/tw-id'

const { t } = useI18n()
const TABS = ['id', 'business'] as const
const KINDS = ['national', 'arc-new', 'arc-old'] as const
const tab = useStoredRef<(typeof TABS)[number]>('tw-id-validate.tab', 'id', oneOf(TABS))
const genKind = useStoredRef<IdKind>('tw-id-validate.genKind', 'national', oneOf(KINDS))

const idInput = ref('')
const bizInput = ref('')

const idResult = computed(() => (idInput.value.trim() === '' ? null : validateId(idInput.value)))
const bizResult = computed(() => (bizInput.value.trim() === '' ? null : validateBusinessNo(bizInput.value)))

const kindItems = computed(() => KINDS.map((k) => ({ title: t(`tools.tw-id-validate.kind_${k}`), value: k })))

const samples = ref<string[]>([])
function generate() {
  samples.value = Array.from({ length: 5 }, () => (tab.value === 'id' ? generateTestId(genKind.value) : generateTestBusinessNo()))
}
function useSample(s: string) {
  if (tab.value === 'id') idInput.value = s
  else bizInput.value = s
}
</script>

<template>
  <ToolShell>
    <v-alert type="warning" variant="tonal" density="compact" class="mb-4">{{ t('tools.tw-id-validate.privacy') }}</v-alert>

    <v-tabs v-model="tab" class="mb-4" density="comfortable">
      <v-tab value="id">{{ t('tools.tw-id-validate.tab_id') }}</v-tab>
      <v-tab value="business">{{ t('tools.tw-id-validate.tab_business') }}</v-tab>
    </v-tabs>

    <template v-if="tab === 'id'">
      <v-text-field
        v-model="idInput"
        :label="t('tools.tw-id-validate.idLabel')"
        placeholder="A123456789"
        maxlength="12"
        autocomplete="off"
        clearable
        hide-details
        class="font-mono"
      />
      <v-alert v-if="idResult" :type="idResult.valid ? 'success' : 'error'" variant="tonal" density="compact" class="mt-3">
        <template v-if="idResult.valid">
          {{ t('tools.tw-id-validate.valid') }}
          — {{ t(`tools.tw-id-validate.kind_${idResult.kind}`) }},
          {{ t(`tools.tw-id-validate.gender_${idResult.gender}`) }}
        </template>
        <template v-else>{{ t(`tools.tw-id-validate.invalid_${idResult.reason}`) }}</template>
      </v-alert>
      <div class="text-caption text-medium-emphasis mt-2">{{ t('tools.tw-id-validate.idNote') }}</div>
    </template>

    <template v-else>
      <v-text-field
        v-model="bizInput"
        :label="t('tools.tw-id-validate.bizLabel')"
        placeholder="04595257"
        maxlength="10"
        inputmode="numeric"
        autocomplete="off"
        clearable
        hide-details
        class="font-mono"
      />
      <v-alert v-if="bizResult" :type="bizResult.valid ? 'success' : 'error'" variant="tonal" density="compact" class="mt-3">
        <template v-if="bizResult.valid">
          {{ t('tools.tw-id-validate.valid') }}
          <div v-if="!bizResult.legacyValid" class="text-caption">{{ t('tools.tw-id-validate.newRuleOnly') }}</div>
        </template>
        <template v-else>{{ t(`tools.tw-id-validate.invalid_${bizResult.reason}`) }}</template>
      </v-alert>
      <div class="text-caption text-medium-emphasis mt-2">{{ t('tools.tw-id-validate.bizNote') }}</div>
    </template>

    <v-divider class="my-5" />
    <div class="text-subtitle-2">{{ t('tools.tw-id-validate.generator') }}</div>
    <div class="text-caption text-error mb-2">{{ t('tools.tw-id-validate.testOnly') }}</div>
    <div class="d-flex flex-wrap align-center ga-2">
      <v-select v-if="tab === 'id'" v-model="genKind" :items="kindItems" :label="t('tools.tw-id-validate.type')" hide-details style="max-width: 260px" />
      <v-btn color="primary" prepend-icon="mdi-dice-multiple-outline" @click="generate">{{ t('tools.tw-id-validate.generate') }}</v-btn>
    </div>
    <v-list v-if="samples.length" density="compact" class="border rounded mt-3 py-0">
      <v-list-item v-for="s in samples" :key="s" class="px-3">
        <div class="d-flex align-center ga-2">
          <code class="font-mono">{{ s }}</code>
          <v-spacer />
          <v-btn size="small" variant="text" @click="useSample(s)">{{ t('tools.tw-id-validate.check') }}</v-btn>
          <CopyBtn :text="s" icon size="small" />
        </div>
      </v-list-item>
    </v-list>
  </ToolShell>
</template>
