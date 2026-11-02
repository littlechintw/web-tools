<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { useHistory } from '@/composables/useHistory'
import { oneOf, useStoredRef } from '@/composables/useStoredRef'
import { buildLoan, toNominalAnnual, type LoanMethod, type PrepayMode, type RateUnit } from '@/lib/interest'
import { downloadText } from '@/utils/download'

const TOOL_ID = 'loan-calculator'
const { t, locale } = useI18n()

const METHODS = ['annuity', 'principal', 'interestOnly'] as const
const RATE_UNITS = ['year', 'month'] as const
const PREPAY_MODES = ['shortenTerm', 'reducePayment'] as const

const method = useStoredRef<(typeof METHODS)[number]>('loan-calculator.method', 'annuity', oneOf(METHODS))
const rateUnit = useStoredRef<(typeof RATE_UNITS)[number]>('loan-calculator.rateUnit', 'year', oneOf(RATE_UNITS))

const prepayMode = useStoredRef<PrepayMode>('loan-calculator.prepayMode', 'shortenTerm', oneOf(PREPAY_MODES))
const principal = ref('1000000')
const rate = ref('2.5')
const years = ref('20')
const extraMonths = ref('0')
const grace = ref('0')
const extraMonthly = ref('0')
const lumpSum = ref('0')
const lumpMonth = ref('12')

const methodItems = computed(() => METHODS.map((m) => ({ title: t(`tools.loan-calculator.method_${m}`), value: m })))
const prepayItems = computed(() => PREPAY_MODES.map((m) => ({ title: t(`tools.loan-calculator.mode_${m}`), value: m })))
const rateUnitItems = computed(() => RATE_UNITS.map((u) => ({ title: t(`tools.loan-calculator.rate_${u}`), value: u })))

function num(s: string): number {
  return s.trim() === '' ? NaN : Number(s)
}

const totalMonths = computed(() => {
  const y = num(years.value)
  const m = num(extraMonths.value || '0')
  return Number.isFinite(y) && Number.isFinite(m) && y >= 0 && m >= 0 ? Math.round(y * 12 + m) : NaN
})

function params(withExtra: boolean) {
  const p = num(principal.value)
  const r = num(rate.value)
  const g = num(grace.value || '0')
  const months = totalMonths.value
  if (![p, r, g, months].every(Number.isFinite) || p <= 0 || r < 0 || g < 0) return null
  if (months < 1 || months > 1200) return null
  const ex = num(extraMonthly.value || '0')
  const ls = num(lumpSum.value || '0')
  const lm = num(lumpMonth.value || '0')
  if (withExtra && (![ex, ls, lm].every(Number.isFinite) || ex < 0 || ls < 0 || lm < 0)) return null
  return {
    principal: p,
    nominalAnnual: toNominalAnnual(r / 100, rateUnit.value as RateUnit),
    months,
    method: method.value as LoanMethod,
    graceMonths: g,
    ...(withExtra ? { extraMonthly: ex, lumpSum: ls, lumpMonth: lm, prepayMode: prepayMode.value } : {}),
  }
}

const result = computed(() => {
  const input = params(true)
  return input ? buildLoan(input) : null
})
const hasPrepay = computed(() => num(extraMonthly.value || '0') > 0 || num(lumpSum.value || '0') > 0)
// Same loan with no prepayments, to show what the extra payments save.
const baseline = computed(() => {
  const input = params(false)
  return input && hasPrepay.value ? buildLoan(input) : null
})
const savedInterest = computed(() => (result.value && baseline.value ? baseline.value.totalInterest - result.value.totalInterest : 0))
const savedMonths = computed(() => (result.value && baseline.value ? baseline.value.rows.length - result.value.rows.length : 0))
const showExtraCol = computed(() => hasPrepay.value && !!result.value?.rows.some((r) => r.extra > 0))

const graceTooLong = computed(() => method.value !== 'interestOnly' && num(grace.value || '0') >= totalMonths.value)

const money = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2, minimumFractionDigits: 2 }))
const fmt = (n: number) => money.value.format(n)

const paymentText = computed(() => {
  const r = result.value
  if (!r) return ''
  const same = Math.abs(r.firstPayment - r.lastPayment) < 0.005
  if (same) return fmt(r.firstPayment)
  return `${fmt(r.firstPayment)} → ${fmt(r.lastPayment)}`
})

const interestRatio = computed(() => {
  const r = result.value
  return r && r.totalPaid > 0 ? (r.totalInterest / r.totalPaid) * 100 : 0
})

function exportCsv() {
  const r = result.value
  if (!r) return
  const head = ['period', 'payment', 'principal', 'interest', 'prepayment', 'balance'].join(',')
  const lines = r.rows.map((x) =>
    [x.period, x.payment, x.principal, x.interest, x.extra, x.balance].map((v) => (typeof v === 'number' ? v.toFixed(2) : v)).join(','),
  )
  downloadText([head, ...lines].join('\n'), 'loan-schedule.csv', 'text/csv;charset=utf-8')
}

const history = useHistory<{
  principal: string; rate: string; years: string; extraMonths: string; grace: string; method: string; rateUnit: string
  extraMonthly?: string; lumpSum?: string; lumpMonth?: string; prepayMode?: string
}>(TOOL_ID)

let saveTimer: ReturnType<typeof setTimeout> | undefined
watch(result, (r) => {
  clearTimeout(saveTimer)
  if (!r) return
  saveTimer = setTimeout(() => {
    history.save(`${principal.value} @ ${rate.value}% / ${rateUnit.value} × ${totalMonths.value}m → ${paymentText.value}`, {
      principal: principal.value, rate: rate.value, years: years.value, extraMonths: extraMonths.value,
      grace: grace.value, method: method.value, rateUnit: rateUnit.value,
      extraMonthly: extraMonthly.value, lumpSum: lumpSum.value, lumpMonth: lumpMonth.value, prepayMode: prepayMode.value,
    })
  }, 1200)
})

history.restoreFromRoute((d) => {
  principal.value = d.principal
  rate.value = d.rate
  years.value = d.years
  extraMonths.value = d.extraMonths
  grace.value = d.grace
  extraMonthly.value = d.extraMonthly ?? '0'
  lumpSum.value = d.lumpSum ?? '0'
  lumpMonth.value = d.lumpMonth ?? '12'
  if (d.prepayMode && (PREPAY_MODES as readonly string[]).includes(d.prepayMode)) prepayMode.value = d.prepayMode as PrepayMode
  if ((METHODS as readonly string[]).includes(d.method)) method.value = d.method as (typeof METHODS)[number]
  if ((RATE_UNITS as readonly string[]).includes(d.rateUnit)) rateUnit.value = d.rateUnit as (typeof RATE_UNITS)[number]
})
</script>

<template>
  <ToolShell>
    <v-row density="comfortable">
      <v-col cols="12" md="6">
        <v-text-field
          v-model="principal"
          :label="t('tools.loan-calculator.principal')"
          type="number"
          min="0"
          inputmode="decimal"
          hide-details
          class="tabular-nums"
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-select v-model="method" :items="methodItems" :label="t('tools.loan-calculator.method')" hide-details />
      </v-col>

      <v-col cols="7" md="4">
        <v-text-field
          v-model="rate"
          :label="t('tools.loan-calculator.rate')"
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
        <v-select v-model="rateUnit" :items="rateUnitItems" :label="t('tools.loan-calculator.rateUnit')" hide-details />
      </v-col>
      <v-col cols="6" md="3">
        <v-text-field v-model="years" :label="t('tools.loan-calculator.years')" type="number" min="0" hide-details class="tabular-nums" />
      </v-col>
      <v-col cols="6" md="3">
        <v-text-field v-model="extraMonths" :label="t('tools.loan-calculator.months')" type="number" min="0" hide-details class="tabular-nums" />
      </v-col>

      <v-col v-if="method !== 'interestOnly'" cols="12" md="6">
        <v-text-field
          v-model="grace"
          :label="t('tools.loan-calculator.grace')"
          :hint="t('tools.loan-calculator.graceHint')"
          persistent-hint
          type="number"
          min="0"
          class="tabular-nums"
        />
      </v-col>

      <v-col cols="12" class="pb-0">
        <div class="text-subtitle-2">{{ t('tools.loan-calculator.prepay') }}</div>
      </v-col>
      <v-col cols="12">
        <v-select v-model="prepayMode" :items="prepayItems" :label="t('tools.loan-calculator.prepayMode')" hide-details />
      </v-col>
      <v-col cols="12" md="4">
        <v-text-field
          v-model="extraMonthly"
          :label="t('tools.loan-calculator.extraMonthly')"
          type="number"
          min="0"
          inputmode="decimal"
          hide-details
          class="tabular-nums"
        />
      </v-col>
      <v-col cols="7" md="5">
        <v-text-field
          v-model="lumpSum"
          :label="t('tools.loan-calculator.lumpSum')"
          hide-details
          type="number"
          min="0"
          inputmode="decimal"
          class="tabular-nums"
        />
      </v-col>
      <v-col cols="5" md="3">
        <v-text-field
          v-model="lumpMonth"
          :label="t('tools.loan-calculator.lumpMonth')"
          type="number"
          min="1"
          :disabled="!(num(lumpSum || '0') > 0)"
          class="tabular-nums"
        />
      </v-col>
    </v-row>

    <v-alert v-if="graceTooLong && result" type="warning" variant="tonal" density="compact" class="mt-4">
      {{ t('tools.loan-calculator.graceClamped') }}
    </v-alert>

    <v-alert v-if="!result" type="info" variant="tonal" density="compact" class="mt-4">
      {{ t('tools.loan-calculator.invalid') }}
    </v-alert>

    <template v-else>
      <v-card variant="tonal" class="mt-4 pa-4">
        <div class="d-flex align-center justify-space-between ga-3">
          <div class="overflow-hidden">
            <div class="text-caption text-medium-emphasis">
              {{ method === 'annuity' ? t('tools.loan-calculator.monthlyPayment') : t('tools.loan-calculator.monthlyRange') }}
            </div>
            <div class="text-h5 font-mono tabular-nums break-all">{{ paymentText }}</div>
          </div>
          <CopyBtn :text="paymentText" icon />
        </div>

        <v-progress-linear
          :model-value="interestRatio"
          height="8"
          rounded
          color="primary"
          bg-color="secondary"
          class="mt-3"
          :aria-label="t('tools.loan-calculator.interestShare')"
        />
        <div class="text-caption text-medium-emphasis mt-1">
          {{ t('tools.loan-calculator.interestShare') }}: {{ interestRatio.toFixed(1) }}%
        </div>

        <v-row density="comfortable" class="mt-1">
          <v-col cols="6" md="4">
            <div class="text-caption text-medium-emphasis">{{ t('tools.loan-calculator.totalInterest') }}</div>
            <div class="font-mono tabular-nums break-all">{{ fmt(result.totalInterest) }}</div>
          </v-col>
          <v-col cols="6" md="4">
            <div class="text-caption text-medium-emphasis">{{ t('tools.loan-calculator.totalPaid') }}</div>
            <div class="font-mono tabular-nums break-all">{{ fmt(result.totalPaid) }}</div>
          </v-col>
          <v-col cols="12" md="4">
            <div class="text-caption text-medium-emphasis">{{ t('tools.loan-calculator.periods') }}</div>
            <div class="font-mono tabular-nums">{{ result.rows.length }}</div>
          </v-col>
          <template v-if="baseline">
            <v-col cols="6" md="4">
              <div class="text-caption text-medium-emphasis">{{ t('tools.loan-calculator.savedInterest') }}</div>
              <div class="font-mono tabular-nums break-all text-success">{{ fmt(savedInterest) }}</div>
            </v-col>
            <v-col v-if="savedMonths > 0" cols="6" md="4">
              <div class="text-caption text-medium-emphasis">{{ t('tools.loan-calculator.savedMonths') }}</div>
              <div class="font-mono tabular-nums text-success">{{ savedMonths }}</div>
            </v-col>
          </template>
        </v-row>
      </v-card>

      <div class="d-flex align-center justify-space-between mt-5 mb-1">
        <div class="text-subtitle-2">{{ t('tools.loan-calculator.schedule') }}</div>
        <v-btn size="small" variant="text" prepend-icon="mdi-download" @click="exportCsv">CSV</v-btn>
      </div>
      <v-table density="compact" fixed-header height="420" class="border rounded">
        <thead>
          <tr>
            <th>{{ t('tools.loan-calculator.colPeriod') }}</th>
            <th class="text-end">{{ t('tools.loan-calculator.colPayment') }}</th>
            <th class="text-end">{{ t('tools.loan-calculator.colPrincipal') }}</th>
            <th class="text-end">{{ t('tools.loan-calculator.colInterest') }}</th>
            <th v-if="showExtraCol" class="text-end">{{ t('tools.loan-calculator.colExtra') }}</th>
            <th class="text-end">{{ t('tools.loan-calculator.colBalance') }}</th>
          </tr>
        </thead>
        <tbody class="tabular-nums">
          <tr v-for="row in result.rows" :key="row.period">
            <td>{{ row.period }}</td>
            <td class="text-end">{{ fmt(row.payment) }}</td>
            <td class="text-end">{{ fmt(row.principal) }}</td>
            <td class="text-end">{{ fmt(row.interest) }}</td>
            <td v-if="showExtraCol" class="text-end">{{ row.extra > 0 ? fmt(row.extra) : '' }}</td>
            <td class="text-end">{{ fmt(row.balance) }}</td>
          </tr>
        </tbody>
      </v-table>
      <div class="text-caption text-medium-emphasis mt-2">{{ t('tools.loan-calculator.note') }}</div>
    </template>
  </ToolShell>
</template>
