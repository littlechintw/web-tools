<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import {
  chineseZodiac, daysLived, exactAge, isLeapYear, minguoYear, nextBirthday, parseYMD, westernSign, type YMD,
} from '@/lib/age'

const { t, locale } = useI18n()
const K = (k: string) => t(`tools.age-calc.${k}`)

// The birth date is personal data: kept in memory only.
const birthStr = ref('')
const now = new Date()
const todayStr = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)

const birth = computed(() => parseYMD(birthStr.value))
const today = computed(() => parseYMD(todayStr.value) ?? { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() })

const age = computed(() => (birth.value ? exactAge(birth.value, today.value) : null))
const lived = computed(() => (birth.value ? daysLived(birth.value, today.value) : null))
const next = computed(() => (birth.value ? nextBirthday(birth.value, today.value) : null))
const future = computed(() => birth.value !== null && age.value === null)
const isLeapDay = computed(() => birth.value?.m === 2 && birth.value.d === 29)
const minguo = computed(() => (birth.value ? minguoYear(birth.value.y) : null))
const animal = computed(() => (birth.value ? chineseZodiac(birth.value) : null))
const sign = computed(() => (birth.value ? westernSign(birth.value.m, birth.value.d) : null))

const nf = computed(() => new Intl.NumberFormat(locale.value))
const fmtDate = (v: YMD) =>
  new Intl.DateTimeFormat(locale.value, { timeZone: 'UTC', dateStyle: 'long' }).format(new Date(Date.UTC(v.y, v.m - 1, v.d)))
const weekdayName = (wd: number) =>
  new Intl.DateTimeFormat(locale.value, { timeZone: 'UTC', weekday: 'long' }).format(new Date(Date.UTC(2023, 0, 1 + wd))) // 2023-01-01 is a Sunday
const nextLeapNote = computed(() => (next.value && isLeapDay.value && !isLeapYear(next.value.date.y)))
</script>

<template>
  <ToolShell>
    <v-row density="comfortable">
      <v-col cols="12" md="6">
        <v-text-field v-model="birthStr" :label="K('birth')" type="date" min="0001-01-01" hide-details />
      </v-col>
      <v-col cols="12" md="6">
        <v-text-field v-model="todayStr" :label="K('asOf')" type="date" hide-details />
      </v-col>
    </v-row>

    <v-alert v-if="!birth" type="info" variant="tonal" density="compact" class="mt-4">{{ K('enterBirth') }}</v-alert>
    <v-alert v-else-if="future" type="warning" variant="tonal" density="compact" class="mt-4">{{ K('futureBirth') }}</v-alert>

    <template v-else-if="age && next && lived !== null && birth">
      <v-card variant="tonal" class="mt-4 pa-4">
        <div class="text-caption text-medium-emphasis">{{ K('exactAge') }}</div>
        <div class="text-h5 tabular-nums">
          {{ t('tools.age-calc.ageFmt', { y: nf.format(age.years), m: age.months, d: age.days }) }}
        </div>
        <div class="text-body-2 mt-2 tabular-nums">{{ K('daysLived') }}: <b>{{ nf.format(lived) }}</b></div>
      </v-card>

      <v-row density="comfortable" class="mt-1">
        <v-col cols="12" md="6">
          <v-card variant="outlined" class="pa-4 h-100">
            <div class="text-caption text-medium-emphasis">{{ K('nextBirthday') }}</div>
            <div class="text-h6">{{ fmtDate(next.date) }}</div>
            <div class="tabular-nums">
              {{ weekdayName(next.weekday) }} ·
              <template v-if="next.daysUntil === 0">{{ K('today') }}</template>
              <template v-else>{{ t('tools.age-calc.inDays', { n: nf.format(next.daysUntil) }) }}</template>
              · {{ t('tools.age-calc.turning', { n: next.turning }) }}
            </div>
            <div v-if="nextLeapNote" class="text-caption text-medium-emphasis mt-1">{{ K('leapNote') }}</div>
          </v-card>
        </v-col>
        <v-col cols="12" md="6">
          <v-card variant="outlined" class="pa-4 h-100">
            <div class="text-caption text-medium-emphasis">{{ K('facts') }}</div>
            <div v-if="minguo" class="tabular-nums">
              {{ K('minguo') }}: {{ minguo.before ? K('minguoBefore') : K('minguoPrefix') }}{{ minguo.year }}{{ K('yearSuffix') }}
            </div>
            <div v-if="animal">
              {{ K('chineseZodiac') }}: <b>{{ K(`animal_${animal.animal}`) }}</b>
              <span v-if="animal.approximate" class="text-caption text-medium-emphasis"> ({{ K('approx') }})</span>
            </div>
            <div v-if="sign">{{ K('westernZodiac') }}: <b>{{ K(`sign_${sign}`) }}</b></div>
          </v-card>
        </v-col>
      </v-row>

      <div class="text-caption text-medium-emphasis mt-3">{{ K('leapRule') }}</div>
      <div class="text-caption text-medium-emphasis">{{ K('zodiacNote') }}</div>
    </template>
  </ToolShell>
</template>
