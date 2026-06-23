<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { useHistory } from '@/composables/useHistory'

const TOOL_ID = 'number-base'
const { t } = useI18n()
const route = useRoute()

const history = useHistory<{ input: string; sourceBase: number; customBase: number }>(TOOL_ID)

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'

const input = ref('')
const sourceBase = ref(10)
const customBase = ref(36)
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

function parseToBigInt(str: string, base: number): bigint {
  let s = str.trim().toLowerCase()
  if (!s) throw new Error('empty')
  let neg = false
  if (s.startsWith('-')) {
    neg = true
    s = s.slice(1)
  } else if (s.startsWith('+')) {
    s = s.slice(1)
  }
  if (!s) throw new Error('empty')
  const bigBase = BigInt(base)
  let result = 0n
  for (const ch of s) {
    const d = DIGITS.indexOf(ch)
    if (d < 0 || d >= base) throw new Error('invalid digit')
    result = result * bigBase + BigInt(d)
  }
  return neg ? -result : result
}

function bigIntToBase(value: bigint, base: number): string {
  if (value === 0n) return '0'
  const neg = value < 0n
  let v = neg ? -value : value
  const bigBase = BigInt(base)
  let out = ''
  while (v > 0n) {
    const rem = Number(v % bigBase)
    out = DIGITS[rem] + out
    v = v / bigBase
  }
  return (neg ? '-' : '') + out
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

onMounted(() => {
  const h = route.query.h as string | undefined
  if (h) {
    const e = history.entries.value.find((x) => x.id === h)
    if (e) {
      input.value = e.data.input
      sourceBase.value = e.data.sourceBase
      customBase.value = e.data.customBase
    }
  }
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
      class="code-area"
    />

    <v-list v-if="rows.length" class="mt-2" bg-color="transparent">
      <v-list-item v-for="row in rows" :key="row.label" class="px-0">
        <template #title>
          <span class="text-caption text-medium-emphasis">{{ row.label }}</span>
        </template>
        <template #subtitle>
          <span class="code-text text-body-1">{{ row.value }}</span>
        </template>
        <template #append>
          <CopyBtn :text="row.value" icon />
        </template>
      </v-list-item>
    </v-list>
  </ToolShell>
</template>

<style scoped>
.code-area :deep(input) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.code-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  word-break: break-all;
}
</style>
