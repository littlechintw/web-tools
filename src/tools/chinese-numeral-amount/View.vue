<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import OutputPanel from '@/components/OutputPanel.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import { isBoolean, oneOf, useStoredRef } from '@/composables/useStoredRef'
import { parseChinese, toChineseUpper } from '@/lib/chinese-numeral'

const { t } = useI18n()
const MODES = ['toUpper', 'toNumber'] as const
const UNITS = ['元', '圓'] as const

const mode = useStoredRef<(typeof MODES)[number]>('chinese-numeral-amount.mode', 'toUpper', oneOf(MODES))
const twd = useStoredRef('chinese-numeral-amount.twd', true, isBoolean)
const unit = useStoredRef<(typeof UNITS)[number]>('chinese-numeral-amount.unit', '元', oneOf(UNITS))

const input = ref('')

const output = computed(() => {
  if (input.value.trim() === '') return { text: '', error: '' }
  if (mode.value === 'toUpper') {
    const r = toChineseUpper(input.value, { twd: twd.value, unit: unit.value })
    return r ? { text: r, error: '' } : { text: '', error: t('tools.chinese-numeral-amount.errAmount') }
  }
  const r = parseChinese(input.value)
  return r !== null ? { text: r, error: '' } : { text: '', error: t('tools.chinese-numeral-amount.errChinese') }
})

const modeItems = computed(() => MODES.map((m) => ({ title: t(`tools.chinese-numeral-amount.mode_${m}`), value: m })))

function swap() {
  if (output.value.text) input.value = output.value.text
  mode.value = mode.value === 'toUpper' ? 'toNumber' : 'toUpper'
}
function example() {
  input.value = mode.value === 'toUpper' ? '123456.78' : '壹拾貳萬參仟肆佰伍拾陸元整'
}
</script>

<template>
  <ToolShell>
    <v-btn-toggle v-model="mode" mandatory divided density="comfortable" color="primary" class="mb-4">
      <v-btn v-for="m in modeItems" :key="m.value" :value="m.value">{{ m.title }}</v-btn>
    </v-btn-toggle>

    <v-text-field
      v-model="input"
      :label="mode === 'toUpper' ? t('tools.chinese-numeral-amount.amount') : t('tools.chinese-numeral-amount.chinese')"
      :inputmode="mode === 'toUpper' ? 'decimal' : 'text'"
      :class="mode === 'toUpper' ? 'font-mono tabular-nums' : ''"
      clearable
      hide-details
      autocomplete="off"
    />

    <div class="d-flex flex-wrap align-center ga-2 mt-3">
      <template v-if="mode === 'toUpper'">
        <v-checkbox v-model="twd" :label="t('tools.chinese-numeral-amount.twdPrefix')" density="compact" hide-details />
        <v-btn-toggle v-model="unit" mandatory density="compact" divided :aria-label="t('tools.chinese-numeral-amount.unit')">
          <v-btn v-for="u in UNITS" :key="u" :value="u" size="small">{{ u }}</v-btn>
        </v-btn-toggle>
      </template>
      <v-spacer />
      <PasteBtn @paste="(s: string) => (input = s)" />
      <v-btn variant="text" @click="example">{{ t('common.loadExample') }}</v-btn>
      <v-btn variant="tonal" prepend-icon="mdi-swap-vertical" @click="swap">{{ t('common.swap') }}</v-btn>
    </div>

    <OutputPanel
      class="mt-4"
      :label="t('common.result')"
      :value="output.text"
      :error="output.error"
      :filename="mode === 'toUpper' ? 'amount-zh.txt' : 'amount.txt'"
    />
    <div class="text-caption text-medium-emphasis mt-2">{{ t('tools.chinese-numeral-amount.note') }}</div>
  </ToolShell>
</template>
