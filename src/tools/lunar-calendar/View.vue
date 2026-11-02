<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { oneOf, useStoredRef } from '@/composables/useStoredRef'
import {
  currentSolarTerm, formatLunar, gregorianToLunar, lunarDayName, lunarMonthName, lunarMonths, lunarSupported,
  lunarToGregorian, solarTerms, stemBranchYear, zodiacOf,
} from '@/lib/lunar'

const { t, locale } = useI18n()
const TABS = ['convert', 'terms'] as const
const tab = useStoredRef<(typeof TABS)[number]>('lunar-calendar.tab', 'convert', oneOf(TABS))
const supported = lunarSupported()

const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

// --- Gregorian -> lunar
const gDate = ref(todayStr)
const g = computed(() => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(gDate.value)
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null
})
const lunar = computed(() => (g.value ? gregorianToLunar(g.value.y, g.value.m, g.value.d) : null))
const term = computed(() => (g.value ? currentSolarTerm(g.value.y, g.value.m, g.value.d) : null))
const weekday = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(2000, m - 1, d))
  dt.setUTCFullYear(y)
  return new Intl.DateTimeFormat(locale.value, { weekday: 'long', timeZone: 'UTC' }).format(dt)
}
const lunarText = computed(() => (lunar.value ? formatLunar(lunar.value) : ''))

// --- lunar -> Gregorian
const lYear = ref(String(now.getFullYear()))
const lMonthKey = ref('1')
const lDay = ref(1)
const lYearNum = computed(() => Number(lYear.value))
const months = computed(() => (Number.isInteger(lYearNum.value) ? lunarMonths(lYearNum.value) : []))
const monthItems = computed(() => months.value.map((m) => ({ title: lunarMonthName(m.month, m.leap), value: `${m.month}${m.leap ? 'b' : ''}`, days: m.days })))
const maxDay = computed(() => monthItems.value.find((m) => m.value === lMonthKey.value)?.days ?? 30)
const dayItems = computed(() => Array.from({ length: maxDay.value }, (_, i) => ({ title: lunarDayName(i + 1), value: i + 1 })))
watch(months, (ms) => {
  if (!ms.some((m) => `${m.month}${m.leap ? 'b' : ''}` === lMonthKey.value)) lMonthKey.value = '1'
})
watch(maxDay, (n) => {
  if (lDay.value > n) lDay.value = n
})
const converted = computed(() => {
  const key = lMonthKey.value
  const gr = lunarToGregorian({ year: lYearNum.value, month: parseInt(key, 10), leap: key.endsWith('b'), day: lDay.value })
  return gr ? { ...gr, text: `${gr.y}-${pad(gr.m)}-${pad(gr.d)}`, week: weekday(gr.y, gr.m, gr.d) } : null
})
const lYearName = computed(() => (months.value.length ? `${stemBranchYear(lYearNum.value)}年（${zodiacOf(lYearNum.value)}）` : ''))

// --- solar terms
const termYear = ref(String(now.getFullYear()))
const terms = computed(() => solarTerms(Number(termYear.value)))
const highlight = computed(() => {
  const d = new Date()
  const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
  return terms.value.find((x) => `${x.y}-${x.m}-${x.d}` === key)?.name ?? ''
})
const termsText = computed(() =>
  terms.value.map((x) => `${x.name}\t${x.y}-${pad(x.m)}-${pad(x.d)} ${pad(x.hh)}:${pad(x.mm)}`).join('\n'),
)
</script>

<template>
  <ToolShell>
    <v-alert v-if="!supported" type="warning" variant="tonal" density="compact" class="mb-4">{{ t('tools.lunar-calendar.unsupported') }}</v-alert>

    <v-tabs v-model="tab" class="mb-4" density="comfortable">
      <v-tab value="convert">{{ t('tools.lunar-calendar.tab_convert') }}</v-tab>
      <v-tab value="terms">{{ t('tools.lunar-calendar.tab_terms') }}</v-tab>
    </v-tabs>

    <template v-if="tab === 'convert'">
      <div class="text-subtitle-2 mb-2">{{ t('tools.lunar-calendar.toLunar') }}</div>
      <v-text-field v-model="gDate" type="date" min="1900-01-01" max="2100-12-31" :label="t('tools.lunar-calendar.gregorian')" hide-details style="max-width: 260px" />
      <v-card v-if="lunar && g" variant="tonal" class="mt-3 pa-4">
        <div class="d-flex align-center justify-space-between ga-3">
          <div class="text-h5 break-all">{{ lunarText }}</div>
          <CopyBtn :text="lunarText" icon />
        </div>
        <div class="d-flex flex-wrap ga-4 mt-2 text-body-2">
          <span>{{ t('tools.lunar-calendar.zodiac') }}：{{ zodiacOf(lunar.year) }}</span>
          <span v-if="lunar.leap" class="text-warning">{{ t('tools.lunar-calendar.isLeap') }}</span>
          <span>{{ weekday(g.y, g.m, g.d) }}</span>
          <span v-if="term">
            {{ t('tools.lunar-calendar.term') }}：{{ term.name }}
            <template v-if="term.isTermDay">（{{ t('tools.lunar-calendar.today') }}）</template>
          </span>
        </div>
      </v-card>
      <v-alert v-else type="info" variant="tonal" density="compact" class="mt-3">{{ t('tools.lunar-calendar.invalidDate') }}</v-alert>

      <div class="text-subtitle-2 mt-6 mb-2">{{ t('tools.lunar-calendar.toGregorian') }}</div>
      <v-row density="comfortable">
        <v-col cols="12" sm="4">
          <v-text-field v-model="lYear" type="number" min="1900" max="2100" :label="t('tools.lunar-calendar.lunarYear')" :hint="lYearName" persistent-hint class="tabular-nums" />
        </v-col>
        <v-col cols="6" sm="4">
          <v-select v-model="lMonthKey" :items="monthItems" :label="t('tools.lunar-calendar.lunarMonth')" hide-details />
        </v-col>
        <v-col cols="6" sm="4">
          <v-select v-model="lDay" :items="dayItems" :label="t('tools.lunar-calendar.lunarDay')" hide-details />
        </v-col>
      </v-row>
      <v-card v-if="converted" variant="tonal" class="mt-3 pa-4">
        <div class="d-flex align-center justify-space-between ga-3">
          <div>
            <div class="text-h5 font-mono tabular-nums">{{ converted.text }}</div>
            <div class="text-body-2">{{ converted.week }}</div>
          </div>
          <CopyBtn :text="converted.text" icon />
        </div>
      </v-card>
      <v-alert v-else type="info" variant="tonal" density="compact" class="mt-3">{{ t('tools.lunar-calendar.invalidLunar') }}</v-alert>
    </template>

    <template v-else>
      <v-text-field v-model="termYear" type="number" min="1900" max="2100" :label="t('tools.lunar-calendar.year')" hide-details style="max-width: 200px" class="tabular-nums" />
      <v-alert v-if="terms.length === 0" type="info" variant="tonal" density="compact" class="mt-3">{{ t('tools.lunar-calendar.invalidYear') }}</v-alert>
      <template v-else>
        <div class="d-flex align-center justify-space-between mt-4 mb-1">
          <div class="text-subtitle-2">{{ t('tools.lunar-calendar.termsOf', { year: termYear }) }}</div>
          <CopyBtn :text="termsText" />
        </div>
        <div class="overflow-x-auto">
          <v-table density="compact" class="border rounded">
            <thead>
              <tr>
                <th>{{ t('tools.lunar-calendar.term') }}</th>
                <th>{{ t('tools.lunar-calendar.date') }}</th>
                <th>{{ t('tools.lunar-calendar.time') }}</th>
                <th class="text-end">{{ t('tools.lunar-calendar.longitude') }}</th>
              </tr>
            </thead>
            <tbody class="tabular-nums">
              <tr v-for="x in terms" :key="x.name" :class="x.name === highlight ? 'text-primary font-weight-bold' : ''">
                <td>{{ x.name }}</td>
                <td>{{ x.y }}-{{ pad(x.m) }}-{{ pad(x.d) }}</td>
                <td>{{ pad(x.hh) }}:{{ pad(x.mm) }}</td>
                <td class="text-end">{{ x.lon }}°</td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </template>
    </template>
    <div class="text-caption text-medium-emphasis mt-3">{{ t('tools.lunar-calendar.note') }}</div>
  </ToolShell>
</template>
