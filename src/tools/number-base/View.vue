<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import { useHistory } from '@/composables/useHistory'
import { isNumber, useStoredRef } from '@/composables/useStoredRef'
import { parseToBigInt, bigIntToBase } from '@/lib/numberBase'

const TOOL_ID = 'number-base'
const { t } = useI18n()

const history = useHistory<{ input: string; sourceBase: number; customBase: number }>(TOOL_ID)

const isBase = (v: unknown): v is number => isNumber(v) && Number.isInteger(v) && v >= 2 && v <= 36

const input = ref('')
const sourceBase = ref(10)
// The custom base is a preference, remembered between visits.
const customBase = useStoredRef('number-base.customBase', 36, isBase)
const error = ref('')

const baseItems = computed(() => [
  { title: t('tools.number-base.binary'), value: 2 },
  { title: t('tools.number-base.octal'), value: 8 },
  { title: t('tools.number-base.decimal'), value: 10 },
  { title: t('tools.number-base.hex'), value: 16 },
  { title: `${t('tools.number-base.custom')} (${customBase.value})`, value: -1 },
])

const customBaseItems = Array.from({ length: 35 }, (_, i) => i + 2)

function effectiveSourceBase(): number {
  return sourceBase.value === -1 ? customBase.value : sourceBase.value
}

const parsed = computed<bigint | null>(() => {
  error.value = ''
  if (!input.value.trim()) return null
  try {
    return parseToBigInt(input.value, effectiveSourceBase())
  } catch {
    error.value = t('tools.number-base.invalid')
    return null
  }
})

interface Row {
  label: string
  value: string
}

const rows = computed<Row[]>(() => {
  const p = parsed.value
  if (p === null) return []
  const list: Row[] = [
    { label: t('tools.number-base.binary'), value: bigIntToBase(p, 2) },
    { label: t('tools.number-base.octal'), value: bigIntToBase(p, 8) },
    { label: t('tools.number-base.decimal'), value: bigIntToBase(p, 10) },
    { label: t('tools.number-base.hex'), value: bigIntToBase(p, 16) },
  ]
  if (![2, 8, 10, 16].includes(customBase.value)) {
    list.push({
      label: `${t('tools.number-base.base')} ${customBase.value}`,
      value: bigIntToBase(p, customBase.value),
    })
  }
  return list
})

function save() {
  if (!input.value.trim() || parsed.value === null) return
  const label = `${input.value.slice(0, 24)} (base ${effectiveSourceBase()})`
  history.save(label, {
    input: input.value,
    sourceBase: sourceBase.value,
    customBase: customBase.value,
  })
}

watch([input, sourceBase, customBase], () => save())

history.restoreFromRoute((d) => {
  input.value = d.input
  sourceBase.value = d.sourceBase
  customBase.value = d.customBase
})
</script>

<template>
  <ToolShell>
    <div class="d-flex flex-wrap align-center ga-4 mb-4">
      <v-select
        v-model="sourceBase"
        :items="baseItems"
        :label="t('tools.number-base.sourceBase')"
        density="compact"
        hide-details
        style="max-width: 220px"
      />
      <v-select
        v-model="customBase"
        :items="customBaseItems"
        :label="t('tools.number-base.customBase')"
        density="compact"
        hide-details
        style="max-width: 160px"
      />
    </div>

    <v-text-field
      v-model="input"
      :label="t('tools.number-base.value')"
      :error-messages="error"
      clearable
      hide-details="auto"
      class="code-area"
    />
    <div class="d-flex flex-wrap align-center ga-2 mt-2">
      <PasteBtn @paste="input = $event" />
    </div>

    <v-list v-if="rows.length" class="mt-2" bg-color="transparent">
      <v-list-item v-for="row in rows" :key="row.label" class="px-0">
        <template #title>
          <span class="text-caption text-medium-emphasis">{{ row.label }}</span>
        </template>
        <template #subtitle>
          <span class="font-mono break-all text-body-1">{{ row.value }}</span>
        </template>
        <template #append>
          <CopyBtn :text="row.value" icon />
        </template>
      </v-list-item>
    </v-list>
  </ToolShell>
</template>
