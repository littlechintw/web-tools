<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { useHistory } from '@/composables/useHistory'

const TOOL_ID = 'date-calc'
const { t } = useI18n()
const route = useRoute()

type Mode = 'add' | 'diff'
interface SavedData {
  mode: Mode
  baseDate: string
  op: 'add' | 'subtract'
  amounts: Record<string, number>
  startDate: string
  endDate: string
}

const history = useHistory<SavedData>(TOOL_ID)

/** Format a Date to the `YYYY-MM-DDTHH:mm` string a datetime-local input expects, in local time. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

const now = new Date()
now.setSeconds(0, 0)

const mode = ref<Mode>('add')

// --- Mode A: add / subtract ---
const baseDate = ref(toLocalInput(now))
const op = ref<'add' | 'subtract'>('add')
const years = ref(0)
const months = ref(0)
const weeks = ref(0)
const days = ref(0)
const hours = ref(0)
const minutes = ref(0)

function num(v: number): number {
  return Number.isFinite(v) ? Math.trunc(v) : 0
}

const resultDate = computed<Date | null>(() => {
  if (!baseDate.value) return null
  const base = new Date(baseDate.value)
  if (Number.isNaN(base.getTime())) return null
  const sign = op.value === 'add' ? 1 : -1
  const d = new Date(base.getTime())
  // Apply calendar-aware fields first (months/years), then absolute durations.
  d.setFullYear(d.getFullYear() + sign * num(years.value))
  d.setMonth(d.getMonth() + sign * num(months.value))
  d.setDate(d.getDate() + sign * (num(weeks.value) * 7 + num(days.value)))
  d.setHours(d.getHours() + sign * num(hours.value))
  d.setMinutes(d.getMinutes() + sign * num(minutes.value))
  return d
})

const resultText = computed(() => {
  const d = resultDate.value
  if (!d) return ''
  return d.toLocaleString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
})

// --- Mode B: interval ---
const startDate = ref(toLocalInput(now))
const laterDefault = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
const endDate = ref(toLocalInput(laterDefault))

const diffError = ref('')

interface Diff {
  totalMs: number
  totalMinutes: number
  totalHours: number
  totalDays: number
  weeks: number
  fullMonths: number
  years: number
  humanized: string
}

const diff = computed<Diff | null>(() => {
  diffError.value = ''
  if (!startDate.value || !endDate.value) return null
  const a = new Date(startDate.value)
  const b = new Date(endDate.value)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  if (b.getTime() < a.getTime()) {
    diffError.value = t('tools.date-calc.invalidRange')
    return null
  }
  const totalMs = b.getTime() - a.getTime()
  const totalMinutes = Math.floor(totalMs / 60000)
  const totalHours = Math.floor(totalMs / 3600000)
  const totalDays = Math.floor(totalMs / 86400000)
  const weeks = Math.floor(totalDays / 7)

  // Calendar full months between the two dates.
  let fullMonths =
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  const anchor = new Date(a.getTime())
  anchor.setMonth(a.getMonth() + fullMonths)
  if (anchor.getTime() > b.getTime()) fullMonths--
  const years = Math.floor(fullMonths / 12)
  const monthsRemainder = fullMonths - years * 12

  // Humanized: years, months, days remainder (calendar-aware).
  const afterMonths = new Date(a.getTime())
  afterMonths.setMonth(a.getMonth() + fullMonths)
  const remDays = Math.floor((b.getTime() - afterMonths.getTime()) / 86400000)
  const parts: string[] = []
  if (years > 0) parts.push(`${years} ${t('tools.date-calc.years')}`)
  if (monthsRemainder > 0) parts.push(`${monthsRemainder} ${t('tools.date-calc.months')}`)
  if (remDays > 0 || parts.length === 0) parts.push(`${remDays} ${t('tools.date-calc.days')}`)

  return {
    totalMs,
    totalMinutes,
    totalHours,
    totalDays,
    weeks,
    fullMonths,
    years,
    humanized: parts.join(' '),
  }
})

const diffSummaryText = computed(() => {
  const d = diff.value
  if (!d) return ''
  return [
    `${t('tools.date-calc.diffDays')}: ${d.totalDays}`,
    `${t('tools.date-calc.diffWeeks')}: ${d.weeks}`,
    `${t('tools.date-calc.diffFullMonths')}: ${d.fullMonths}`,
    `${t('tools.date-calc.diffYears')}: ${d.years}`,
    `${t('tools.date-calc.totalHours')}: ${d.totalHours}`,
    `${t('tools.date-calc.totalMinutes')}: ${d.totalMinutes}`,
    `${t('tools.date-calc.humanized')}: ${d.humanized}`,
  ].join('\n')
})

const diffStats = computed(() => {
  const d = diff.value
  if (!d) return []
  return [
    { label: t('tools.date-calc.diffDays'), value: d.totalDays.toLocaleString() },
    { label: t('tools.date-calc.diffWeeks'), value: d.weeks.toLocaleString() },
    { label: t('tools.date-calc.diffFullMonths'), value: d.fullMonths.toLocaleString() },
    { label: t('tools.date-calc.diffYears'), value: d.years.toLocaleString() },
    { label: t('tools.date-calc.totalHours'), value: d.totalHours.toLocaleString() },
    { label: t('tools.date-calc.totalMinutes'), value: d.totalMinutes.toLocaleString() },
  ]
})

function save() {
  history.save(mode.value === 'add' ? t('tools.date-calc.modeAdd') : t('tools.date-calc.modeDiff'), {
    mode: mode.value,
    baseDate: baseDate.value,
    op: op.value,
    amounts: {
      years: years.value,
      months: months.value,
      weeks: weeks.value,
      days: days.value,
      hours: hours.value,
      minutes: minutes.value,
    },
    startDate: startDate.value,
    endDate: endDate.value,
  })
}

watch(
  [mode, baseDate, op, years, months, weeks, days, hours, minutes, startDate, endDate],
  () => save(),
)

onMounted(() => {
  const h = route.query.h as string | undefined
  if (!h) return
  const e = history.entries.value.find((x) => x.id === h)
  if (!e) return
  const d = e.data
  mode.value = d.mode
  baseDate.value = d.baseDate
  op.value = d.op
  years.value = d.amounts.years
  months.value = d.amounts.months
  weeks.value = d.amounts.weeks
  days.value = d.amounts.days
  hours.value = d.amounts.hours
  minutes.value = d.amounts.minutes
  startDate.value = d.startDate
  endDate.value = d.endDate
})
</script>

<template>
  <ToolShell>
    <div class="mb-4">
      <v-btn-toggle v-model="mode" mandatory color="primary" density="comfortable" variant="outlined">
        <v-btn value="add">{{ t('tools.date-calc.modeAdd') }}</v-btn>
        <v-btn value="diff">{{ t('tools.date-calc.modeDiff') }}</v-btn>
      </v-btn-toggle>
    </div>

    <!-- Mode A: Add / Subtract -->
    <template v-if="mode === 'add'">
      <v-text-field
        v-model="baseDate"
        type="datetime-local"
        :label="t('tools.date-calc.baseDate')"
        density="comfortable"
      />

      <v-btn-toggle v-model="op" mandatory color="primary" density="comfortable" variant="outlined" class="mb-4">
        <v-btn value="add">{{ t('tools.date-calc.add') }}</v-btn>
        <v-btn value="subtract">{{ t('tools.date-calc.subtract') }}</v-btn>
      </v-btn-toggle>

      <v-row dense>
        <v-col cols="6" sm="4" md="2">
          <v-text-field v-model.number="years" type="number" :label="t('tools.date-calc.years')" density="comfortable" />
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <v-text-field v-model.number="months" type="number" :label="t('tools.date-calc.months')" density="comfortable" />
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <v-text-field v-model.number="weeks" type="number" :label="t('tools.date-calc.weeks')" density="comfortable" />
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <v-text-field v-model.number="days" type="number" :label="t('tools.date-calc.days')" density="comfortable" />
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <v-text-field v-model.number="hours" type="number" :label="t('tools.date-calc.hours')" density="comfortable" />
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <v-text-field v-model.number="minutes" type="number" :label="t('tools.date-calc.minutes')" density="comfortable" />
        </v-col>
      </v-row>

      <v-card variant="tonal" color="primary" class="mt-2">
        <v-card-text>
          <div class="text-caption text-medium-emphasis">{{ t('tools.date-calc.resultDate') }}</div>
          <div class="text-h6 mt-1">{{ resultText || '—' }}</div>
        </v-card-text>
      </v-card>

      <div class="d-flex ga-2 mt-3">
        <CopyBtn :text="resultText" />
      </div>
    </template>

    <!-- Mode B: Interval -->
    <template v-else>
      <v-row dense>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="startDate"
            type="datetime-local"
            :label="t('tools.date-calc.startDate')"
            density="comfortable"
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="endDate"
            type="datetime-local"
            :label="t('tools.date-calc.endDate')"
            :error-messages="diffError"
            density="comfortable"
          />
        </v-col>
      </v-row>

      <template v-if="diff">
        <v-row dense class="mt-1">
          <v-col v-for="s in diffStats" :key="s.label" cols="6" sm="4">
            <v-card variant="tonal" color="primary">
              <v-card-text class="py-3">
                <div class="text-caption text-medium-emphasis">{{ s.label }}</div>
                <div class="text-h6">{{ s.value }}</div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-card variant="outlined" class="mt-3">
          <v-card-text>
            <div class="text-caption text-medium-emphasis">{{ t('tools.date-calc.humanized') }}</div>
            <div class="text-h6 mt-1">{{ diff.humanized }}</div>
          </v-card-text>
        </v-card>

        <div class="d-flex ga-2 mt-3">
          <CopyBtn :text="diffSummaryText" :label="true" />
        </div>
      </template>
    </template>
  </ToolShell>
</template>
