<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { oneOf, useStoredRef } from '@/composables/useStoredRef'
import { projectSavings, requiredContribution, toNominalAnnual, type RateUnit, type SavingsInput } from '@/lib/interest'

const { t, locale } = useI18n()

const RATE_UNITS = ['year', 'month'] as const
const COMPOUNDS = ['365', '12', '4', '2', '1', '0'] as const
const FREQS = ['12', '52', '4', '2', '1'] as const
const TIMINGS = ['end', 'start'] as const

const rateUnit = useStoredRef<(typeof RATE_UNITS)[number]>('savings-goal.rateUnit', 'year', oneOf(RATE_UNITS))
const compounds = useStoredRef<(typeof COMPOUNDS)[number]>('savings-goal.compounds', '12', oneOf(COMPOUNDS))
const freq = useStoredRef<(typeof FREQS)[number]>('savings-goal.freq', '12', oneOf(FREQS))
const timing = useStoredRef<(typeof TIMINGS)[number]>('savings-goal.timing', 'end', oneOf(TIMINGS))

const target = ref('1000000')
const current = ref('0')
const rate = ref('2')
const years = ref('10')
const extraMonths = ref('0')

const rateUnitItems = computed(() => RATE_UNITS.map((u) => ({ title: t(`tools.compound-interest.rate_${u}`), value: u })))
const compoundItems = computed(() => COMPOUNDS.map((c) => ({ title: t(`tools.compound-interest.comp_${c}`), value: c })))
const freqItems = computed(() => FREQS.map((c) => ({ title: t(`tools.compound-interest.contrib_${c}`), value: c })))
const timingItems = computed(() => TIMINGS.map((x) => ({ title: t(`tools.compound-interest.timing_${x}`), value: x })))

function num(s: string): number {
  return s.trim() === '' ? NaN : Number(s)
}

const calc = computed(() => {
  const tg = num(target.value)
  const cur = num(current.value || '0')
  const r = num(rate.value)
  const y = num(years.value)
  const m = num(extraMonths.value || '0')
  if (![tg, cur, r, y, m].every(Number.isFinite) || tg <= 0 || cur < 0 || r < 0 || y < 0 || m < 0) return null
  const months = Math.round(y * 12 + m)
  if (months < 1 || months > 1200) return null
  const input: Omit<SavingsInput, 'contribution'> = {
    principal: cur,
    nominalAnnual: toNominalAnnual(r / 100, rateUnit.value as RateUnit),
    compoundsPerYear: Number(compounds.value),
    months,
    contributionsPerYear: Number(freq.value),
    contributeAtStart: timing.value === 'start',
    simple: false,
  }
  const need = requiredContribution(input, tg)
  if (need === null) return null
  const plan = projectSavings({ ...input, contribution: need })
  return { need, plan, reached: need === 0 }
})

const fmtter = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2, minimumFractionDigits: 2 }))
const fmt = (n: number) => fmtter.value.format(n)
// Round up to the cent so the plan really reaches the target.
const needText = computed(() => (calc.value ? fmt(Math.ceil(calc.value.need * 100) / 100) : ''))
</script>

<template>
  <ToolShell>
    <v-row density="comfortable">
      <v-col cols="12" md="6">
        <v-text-field v-model="target" :label="t('tools.savings-goal.target')" type="number" min="0" inputmode="decimal" hide-details class="tabular-nums" />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field v-model="current" :label="t('tools.savings-goal.current')" type="number" min="0" inputmode="decimal" hide-details class="tabular-nums" />
      </v-col>
      <v-col cols="7" md="4">
        <v-text-field v-model="rate" :label="t('tools.compound-interest.rate')" type="number" min="0" step="0.01" suffix="%" inputmode="decimal" hide-details class="tabular-nums" />
      </v-col>
      <v-col cols="5" md="2">
        <v-select v-model="rateUnit" :items="rateUnitItems" :label="t('tools.compound-interest.rateUnit')" hide-details />
      </v-col>
      <v-col cols="12" md="6">
        <v-select v-model="compounds" :items="compoundItems" :label="t('tools.compound-interest.compounding')" hide-details />
      </v-col>
      <v-col cols="6" md="3">
        <v-text-field v-model="years" :label="t('tools.compound-interest.years')" type="number" min="0" hide-details class="tabular-nums" />
      </v-col>
      <v-col cols="6" md="3">
        <v-text-field v-model="extraMonths" :label="t('tools.compound-interest.months')" type="number" min="0" hide-details class="tabular-nums" />
      </v-col>
      <v-col cols="6" md="3">
        <v-select v-model="freq" :items="freqItems" :label="t('tools.compound-interest.contribFreq')" hide-details />
      </v-col>
      <v-col cols="6" md="3">
        <v-select v-model="timing" :items="timingItems" :label="t('tools.compound-interest.timing')" hide-details />
      </v-col>
    </v-row>

    <v-alert v-if="!calc" type="info" variant="tonal" density="compact" class="mt-4">
      {{ t('tools.compound-interest.invalid') }}
    </v-alert>

    <template v-else>
      <v-alert v-if="calc.reached" type="success" variant="tonal" density="compact" class="mt-4">
        {{ t('tools.savings-goal.alreadyReached') }}
      </v-alert>
      <v-card v-else variant="tonal" class="mt-4 pa-4">
        <div class="d-flex align-center justify-space-between ga-3">
          <div class="overflow-hidden">
            <div class="text-caption text-medium-emphasis">{{ t('tools.savings-goal.needed') }}</div>
            <div class="text-h5 font-mono tabular-nums break-all">{{ needText }}</div>
          </div>
          <CopyBtn :text="needText" icon />
        </div>
        <v-row density="comfortable" class="mt-1">
          <v-col cols="6" md="4">
            <div class="text-caption text-medium-emphasis">{{ t('tools.compound-interest.totalDeposited') }}</div>
            <div class="font-mono tabular-nums break-all">{{ fmt(calc.plan.deposited) }}</div>
          </v-col>
          <v-col cols="6" md="4">
            <div class="text-caption text-medium-emphasis">{{ t('tools.compound-interest.totalInterest') }}</div>
            <div class="font-mono tabular-nums break-all">{{ fmt(calc.plan.interest) }}</div>
          </v-col>
          <v-col cols="12" md="4">
            <div class="text-caption text-medium-emphasis">{{ t('tools.compound-interest.finalBalance') }}</div>
            <div class="font-mono tabular-nums break-all">{{ fmt(calc.plan.balance) }}</div>
          </v-col>
        </v-row>
      </v-card>

      <template v-if="!calc.reached">
        <div class="text-subtitle-2 mt-5 mb-1">{{ t('tools.compound-interest.schedule') }}</div>
        <v-table density="compact" fixed-header height="320" class="border rounded">
          <thead>
            <tr>
              <th>{{ t('tools.compound-interest.colYear') }}</th>
              <th class="text-end">{{ t('tools.compound-interest.colDeposited') }}</th>
              <th class="text-end">{{ t('tools.compound-interest.colInterest') }}</th>
              <th class="text-end">{{ t('tools.compound-interest.colBalance') }}</th>
            </tr>
          </thead>
          <tbody class="tabular-nums">
            <tr v-for="row in calc.plan.rows" :key="row.year">
              <td>{{ row.year }}</td>
              <td class="text-end">{{ fmt(row.deposited) }}</td>
              <td class="text-end">{{ fmt(row.interest) }}</td>
              <td class="text-end">{{ fmt(row.balance) }}</td>
            </tr>
          </tbody>
        </v-table>
      </template>
      <div class="text-caption text-medium-emphasis mt-2">{{ t('tools.compound-interest.note') }}</div>
    </template>
  </ToolShell>
</template>
