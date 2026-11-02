<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { useHistory } from '@/composables/useHistory'
import { oneOf, useStoredRef } from '@/composables/useStoredRef'
import { afterTax, doublingYears, projectSavings, realValue, toNominalAnnual, type RateUnit } from '@/lib/interest'

const TOOL_ID = 'compound-interest'
const { t, locale } = useI18n()

const RATE_UNITS = ['year', 'month', 'week', 'day'] as const
const COMPOUNDS = ['365', '52', '12', '4', '2', '1', '0'] as const
const KINDS = ['compound', 'simple'] as const
const CONTRIB_FREQS = ['12', '52', '4', '2', '1'] as const
const TIMINGS = ['end', 'start'] as const

// Options are remembered; the amounts themselves are not.
const rateUnit = useStoredRef<(typeof RATE_UNITS)[number]>('compound-interest.rateUnit', 'year', oneOf(RATE_UNITS))
const compounds = useStoredRef<(typeof COMPOUNDS)[number]>('compound-interest.compounds', '12', oneOf(COMPOUNDS))
const kind = useStoredRef<(typeof KINDS)[number]>('compound-interest.kind', 'compound', oneOf(KINDS))
const contribFreq = useStoredRef<(typeof CONTRIB_FREQS)[number]>('compound-interest.contribFreq', '12', oneOf(CONTRIB_FREQS))
const timing = useStoredRef<(typeof TIMINGS)[number]>('compound-interest.timing', 'end', oneOf(TIMINGS))

const principal = ref('100000')
const rate = ref('2')
const years = ref('10')
const extraMonths = ref('0')
const contribution = ref('0')
const taxRate = ref('0')
const inflation = ref('0')

const rateUnitItems = computed(() => RATE_UNITS.map((u) => ({ title: t(`tools.compound-interest.rate_${u}`), value: u })))
const compoundItems = computed(() => COMPOUNDS.map((c) => ({ title: t(`tools.compound-interest.comp_${c}`), value: c })))
const kindItems = computed(() => KINDS.map((k) => ({ title: t(`tools.compound-interest.kind_${k}`), value: k })))
const contribItems = computed(() => CONTRIB_FREQS.map((c) => ({ title: t(`tools.compound-interest.contrib_${c}`), value: c })))
const timingItems = computed(() => TIMINGS.map((x) => ({ title: t(`tools.compound-interest.timing_${x}`), value: x })))

function num(s: string): number {
  return s.trim() === '' ? NaN : Number(s)
}

const result = computed(() => {
  const p = num(principal.value)
  const r = num(rate.value)
  const y = num(years.value)
  const m = num(extraMonths.value || '0')
  const c = num(contribution.value || '0')
  if (![p, r, y, m, c].every(Number.isFinite) || p < 0 || r < 0 || y < 0 || m < 0 || c < 0) return null
  const months = Math.round(y * 12 + m)
  if (months < 1 || months > 1200) return null
  return projectSavings({
    principal: p,
    nominalAnnual: toNominalAnnual(r / 100, rateUnit.value as RateUnit),
    compoundsPerYear: Number(compounds.value),
    months,
    contribution: c,
    contributionsPerYear: Number(contribFreq.value),
    contributeAtStart: timing.value === 'start',
    simple: kind.value === 'simple',
  })
})

const hasContribution = computed(() => num(contribution.value || '0') > 0)
const termYears = computed(() => {
  const y = num(years.value)
  const m = num(extraMonths.value || '0')
  return (y * 12 + m) / 12
})
const taxPct = computed(() => {
  const v = num(taxRate.value || '0')
  return Number.isFinite(v) ? Math.min(Math.max(v, 0), 100) : 0
})
const inflationPct = computed(() => {
  const v = num(inflation.value || '0')
  return Number.isFinite(v) ? Math.max(v, -50) : 0
})
const taxed = computed(() => (result.value && taxPct.value > 0 ? afterTax(result.value.deposited, result.value.interest, taxPct.value / 100) : null))
// Inflation applies to whatever the user would actually receive (after tax when set).
const finalNet = computed(() => (taxed.value ? taxed.value.balance : (result.value?.balance ?? 0)))
const real = computed(() => (result.value && inflationPct.value !== 0 ? realValue(finalNet.value, inflationPct.value / 100, termYears.value) : null))
const realRows = computed(() => (result.value && inflationPct.value !== 0
  ? result.value.rows.map((r) => {
      const yrs = Math.min(r.year, termYears.value)
      const net = taxPct.value > 0 ? afterTax(r.deposited, r.interest, taxPct.value / 100).balance : r.balance
      return realValue(net, inflationPct.value / 100, yrs)
    })
  : null))
const doubling = computed(() => (result.value && kind.value === 'compound' ? doublingYears(result.value.ear) : null))

const money = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2, minimumFractionDigits: 2 }))
const fmt = (n: number) => money.value.format(n)
const pct = (n: number) => `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: 4 }).format(n * 100)}%`

const summaryText = computed(() => (result.value ? fmt(result.value.balance) : ''))
const interestShare = computed(() => {
  const r = result.value
  return r && r.balance > 0 ? Math.max(0, Math.min(100, (r.interest / r.balance) * 100)) : 0
})

const history = useHistory<{
  principal: string; rate: string; years: string; extraMonths: string; contribution: string
  rateUnit: string; compounds: string; kind: string; contribFreq: string; timing: string
  taxRate?: string; inflation?: string
}>(TOOL_ID)

let saveTimer: ReturnType<typeof setTimeout> | undefined
watch(result, (r) => {
  clearTimeout(saveTimer)
  if (!r) return
  // Debounced so typing a number doesn't write an entry per keystroke.
  saveTimer = setTimeout(() => {
    history.save(`${principal.value} @ ${rate.value}% / ${rateUnit.value} × ${years.value}y → ${fmt(r.balance)}`, {
      principal: principal.value, rate: rate.value, years: years.value, extraMonths: extraMonths.value,
      contribution: contribution.value, rateUnit: rateUnit.value, compounds: compounds.value,
      kind: kind.value, contribFreq: contribFreq.value, timing: timing.value,
      taxRate: taxRate.value, inflation: inflation.value,
    })
  }, 1200)
})

history.restoreFromRoute((d) => {
  principal.value = d.principal
  rate.value = d.rate
  years.value = d.years
  extraMonths.value = d.extraMonths
  contribution.value = d.contribution
  taxRate.value = d.taxRate ?? '0'
  inflation.value = d.inflation ?? '0'
  if ((RATE_UNITS as readonly string[]).includes(d.rateUnit)) rateUnit.value = d.rateUnit as (typeof RATE_UNITS)[number]
  if ((COMPOUNDS as readonly string[]).includes(d.compounds)) compounds.value = d.compounds as (typeof COMPOUNDS)[number]
  if ((KINDS as readonly string[]).includes(d.kind)) kind.value = d.kind as (typeof KINDS)[number]
  if ((CONTRIB_FREQS as readonly string[]).includes(d.contribFreq)) contribFreq.value = d.contribFreq as (typeof CONTRIB_FREQS)[number]
  if ((TIMINGS as readonly string[]).includes(d.timing)) timing.value = d.timing as (typeof TIMINGS)[number]
})
</script>

<template>
  <ToolShell>
    <v-row density="comfortable">
      <v-col cols="12" md="6">
        <v-text-field
          v-model="principal"
          :label="t('tools.compound-interest.principal')"
          type="number"
          min="0"
          inputmode="decimal"
          hide-details
          class="tabular-nums"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-select v-model="kind" :items="kindItems" :label="t('tools.compound-interest.kind')" hide-details />
      </v-col>

      <v-col cols="7" md="4">
        <v-text-field
          v-model="rate"
          :label="t('tools.compound-interest.rate')"
          type="number"
          min="0"
          step="0.01"
          suffix="%"
          inputmode="decimal"
          hide-details
          class="tabular-nums"
        />
      </v-col>
      <v-col cols="5" md="2">
        <v-select v-model="rateUnit" :items="rateUnitItems" :label="t('tools.compound-interest.rateUnit')" hide-details />
      </v-col>
      <v-col cols="12" md="6">
        <v-select
          v-model="compounds"
          :items="compoundItems"
          :label="t('tools.compound-interest.compounding')"
          :disabled="kind === 'simple'"
          hide-details
        />
      </v-col>

      <v-col cols="6" md="3">
        <v-text-field v-model="years" :label="t('tools.compound-interest.years')" type="number" min="0" hide-details class="tabular-nums" />
      </v-col>
      <v-col cols="6" md="3">
        <v-text-field v-model="extraMonths" :label="t('tools.compound-interest.months')" type="number" min="0" hide-details class="tabular-nums" />
      </v-col>

      <v-col cols="12" md="6">
        <v-text-field
          v-model="contribution"
          :label="t('tools.compound-interest.contribution')"
          type="number"
          min="0"
          inputmode="decimal"
          hide-details
          class="tabular-nums"
        />
      </v-col>
      <v-col cols="6" md="3">
        <v-text-field
          v-model="taxRate"
          :label="t('tools.compound-interest.taxRate')"
          :hint="t('tools.compound-interest.taxHint')"
          persistent-hint
          type="number"
          min="0"
          max="100"
          suffix="%"
          class="tabular-nums"
        />
      </v-col>
      <v-col cols="6" md="3">
        <v-text-field
          v-model="inflation"
          :label="t('tools.compound-interest.inflation')"
          :hint="t('tools.compound-interest.inflationHint')"
          persistent-hint
          type="number"
          step="0.1"
          suffix="%"
          class="tabular-nums"
        />
      </v-col>
      <template v-if="hasContribution">
        <v-col cols="6" md="3">
          <v-select v-model="contribFreq" :items="contribItems" :label="t('tools.compound-interest.contribFreq')" hide-details />
        </v-col>
        <v-col cols="6" md="3">
          <v-select v-model="timing" :items="timingItems" :label="t('tools.compound-interest.timing')" hide-details />
        </v-col>
      </template>
    </v-row>

    <v-alert v-if="!result" type="info" variant="tonal" density="compact" class="mt-4">
      {{ t('tools.compound-interest.invalid') }}
    </v-alert>

    <template v-else>
      <v-card variant="tonal" class="mt-4 pa-4">
        <div class="d-flex align-center justify-space-between ga-3">
          <div class="overflow-hidden">
            <div class="text-caption text-medium-emphasis">{{ t('tools.compound-interest.finalBalance') }}</div>
            <div class="text-h5 font-mono tabular-nums break-all">{{ fmt(result.balance) }}</div>
          </div>
          <CopyBtn :text="summaryText" icon />
        </div>

        <v-progress-linear
          :model-value="interestShare"
          height="8"
          rounded
          color="primary"
          bg-color="secondary"
          class="mt-3"
          :aria-label="t('tools.compound-interest.interestShare')"
        />
        <div class="text-caption text-medium-emphasis mt-1">
          {{ t('tools.compound-interest.interestShare') }}: {{ interestShare.toFixed(1) }}%
        </div>

        <v-row density="comfortable" class="mt-1">
          <v-col cols="6" md="3">
            <div class="text-caption text-medium-emphasis">{{ t('tools.compound-interest.totalDeposited') }}</div>
            <div class="font-mono tabular-nums break-all">{{ fmt(result.deposited) }}</div>
          </v-col>
          <v-col cols="6" md="3">
            <div class="text-caption text-medium-emphasis">{{ t('tools.compound-interest.totalInterest') }}</div>
            <div class="font-mono tabular-nums break-all">{{ fmt(result.interest) }}</div>
          </v-col>
          <v-col cols="6" md="3">
            <div class="text-caption text-medium-emphasis">{{ t('tools.compound-interest.ear') }}</div>
            <div class="font-mono tabular-nums">{{ pct(result.ear) }}</div>
          </v-col>
          <v-col v-if="taxed" cols="6" md="3">
            <div class="text-caption text-medium-emphasis">{{ t('tools.compound-interest.tax') }}</div>
            <div class="font-mono tabular-nums break-all">{{ fmt(taxed.tax) }}</div>
          </v-col>
          <v-col v-if="taxed" cols="6" md="3">
            <div class="text-caption text-medium-emphasis">{{ t('tools.compound-interest.afterTaxBalance') }}</div>
            <div class="font-mono tabular-nums break-all">{{ fmt(taxed.balance) }}</div>
          </v-col>
          <v-col v-if="real !== null" cols="12" md="6">
            <div class="text-caption text-medium-emphasis">{{ t('tools.compound-interest.realValue') }}</div>
            <div class="font-mono tabular-nums break-all">{{ fmt(real) }}</div>
          </v-col>
          <v-col v-if="doubling" cols="6" md="3">
            <div class="text-caption text-medium-emphasis">{{ t('tools.compound-interest.doubling') }}</div>
            <div class="font-mono tabular-nums">{{ doubling.toFixed(1) }} {{ t('tools.compound-interest.yearUnit') }}</div>
          </v-col>
        </v-row>
      </v-card>

      <div class="text-subtitle-2 mt-5 mb-1">{{ t('tools.compound-interest.schedule') }}</div>
      <v-table density="compact" fixed-header height="360" class="border rounded">
        <thead>
          <tr>
            <th>{{ t('tools.compound-interest.colYear') }}</th>
            <th class="text-end">{{ t('tools.compound-interest.colDeposited') }}</th>
            <th class="text-end">{{ t('tools.compound-interest.colInterest') }}</th>
            <th class="text-end">{{ t('tools.compound-interest.colBalance') }}</th>
            <th v-if="realRows" class="text-end">{{ t('tools.compound-interest.colReal') }}</th>
          </tr>
        </thead>
        <tbody class="tabular-nums">
          <tr v-for="(row, idx) in result.rows" :key="row.year">
            <td>{{ row.year }}</td>
            <td class="text-end">{{ fmt(row.deposited) }}</td>
            <td class="text-end">{{ fmt(row.interest) }}</td>
            <td class="text-end">{{ fmt(row.balance) }}</td>
            <td v-if="realRows" class="text-end">{{ fmt(realRows[idx]) }}</td>
          </tr>
        </tbody>
      </v-table>
      <div class="text-caption text-medium-emphasis mt-2">{{ t('tools.compound-interest.note') }}</div>
    </template>
  </ToolShell>
</template>
