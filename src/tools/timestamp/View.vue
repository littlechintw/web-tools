<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { useHistory } from '@/composables/useHistory'

const TOOL_ID = 'timestamp'
const { t, locale } = useI18n()
const route = useRoute()

const history = useHistory<{ tsInput: string; dateInput: string }>(TOOL_ID)

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined

const nowSeconds = computed(() => Math.floor(now.value / 1000))
const nowMillis = computed(() => now.value)

const tsInput = ref('')
const dateInput = ref('')

// ---- timestamp -> date ----
interface TsResult {
  ms: number
  isMillis: boolean
}

const tsParsed = computed<TsResult | null>(() => {
  const raw = tsInput.value.trim()
  if (!raw) return null
  if (!/^[-+]?\d+$/.test(raw)) return null
  const num = Number(raw)
  if (!isFinite(num)) return null
  // Heuristic: >= 1e12 (≈ year 2001 in ms) treated as milliseconds.
  const isMillis = Math.abs(num) >= 1e12
  return { ms: isMillis ? num : num * 1000, isMillis }
})

function relativeTime(fromMs: number, toMs: number): string {
  const diffSec = Math.round((fromMs - toMs) / 1000)
  if (Math.abs(diffSec) < 1) return t('tools.timestamp.justNow')
  const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
  const abs = Math.abs(diffSec)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ]
  for (const [unit, secs] of units) {
    if (abs >= secs || unit === 'second') {
      return rtf.format(Math.round(diffSec / secs), unit)
    }
  }
  return ''
}

interface Row {
  label: string
  value: string
}

const tsRows = computed<Row[]>(() => {
  const p = tsParsed.value
  if (!p) return []
  const d = new Date(p.ms)
  if (isNaN(d.getTime())) return []
  return [
    { label: t('tools.timestamp.local'), value: d.toLocaleString(locale.value) },
    { label: t('tools.timestamp.utc'), value: d.toUTCString() },
    { label: t('tools.timestamp.iso'), value: d.toISOString() },
    { label: t('tools.timestamp.relative'), value: relativeTime(p.ms, now.value) },
  ]
})

const tsError = computed(() =>
  tsInput.value.trim() && !tsParsed.value ? t('tools.timestamp.invalidTs') : '',
)
const tsDetected = computed(() => {
  if (!tsParsed.value) return ''
  return tsParsed.value.isMillis
    ? t('tools.timestamp.detectedMillis')
    : t('tools.timestamp.detectedSeconds')
})

// ---- date -> timestamp ----
const dateParsed = computed<Date | null>(() => {
  const raw = dateInput.value.trim()
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
})

const dateRows = computed<Row[]>(() => {
  const d = dateParsed.value
  if (!d) return []
  return [
    { label: t('tools.timestamp.seconds'), value: String(Math.floor(d.getTime() / 1000)) },
    { label: t('tools.timestamp.millis'), value: String(d.getTime()) },
    { label: t('tools.timestamp.iso'), value: d.toISOString() },
  ]
})

const dateError = computed(() =>
  dateInput.value.trim() && !dateParsed.value ? t('tools.timestamp.invalidDate') : '',
)

function save() {
  if (!tsInput.value.trim() && !dateInput.value.trim()) return
  const label = tsInput.value.trim() || dateInput.value.trim()
  history.save(label.slice(0, 40), { tsInput: tsInput.value, dateInput: dateInput.value })
}

watch([tsInput, dateInput], () => save())

onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 1000)
  const h = route.query.h as string | undefined
  if (h) {
    const e = history.entries.value.find((x) => x.id === h)
    if (e) {
      tsInput.value = e.data.tsInput
      dateInput.value = e.data.dateInput
    }
  }
})

onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <ToolShell>
    <div class="d-flex flex-wrap ga-3 mb-6">
      <v-card variant="tonal" class="pa-4 flex-grow-1 d-flex align-center justify-space-between ga-3">
        <div>
          <div class="text-caption text-medium-emphasis">{{ t('tools.timestamp.nowSeconds') }}</div>
          <div class="text-h6 code-text">{{ nowSeconds }}</div>
        </div>
        <CopyBtn :text="String(nowSeconds)" icon />
      </v-card>
      <v-card variant="tonal" class="pa-4 flex-grow-1 d-flex align-center justify-space-between ga-3">
        <div>
          <div class="text-caption text-medium-emphasis">{{ t('tools.timestamp.nowMillis') }}</div>
          <div class="text-h6 code-text">{{ nowMillis }}</div>
        </div>
        <CopyBtn :text="String(nowMillis)" icon />
      </v-card>
    </div>

    <h2 class="text-subtitle-1 font-weight-medium mb-2">{{ t('tools.timestamp.tsToDate') }}</h2>
    <v-text-field
      v-model="tsInput"
      :label="t('tools.timestamp.tsInput')"
      :error-messages="tsError"
      :hint="tsDetected"
      persistent-hint
      clearable
      class="code-area"
    />
    <v-list v-if="tsRows.length" bg-color="transparent">
      <v-list-item v-for="row in tsRows" :key="row.label" class="px-0">
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

    <v-divider class="my-6" />

    <h2 class="text-subtitle-1 font-weight-medium mb-2">{{ t('tools.timestamp.dateToTs') }}</h2>
    <v-text-field
      v-model="dateInput"
      :label="t('tools.timestamp.dateInput')"
      :error-messages="dateError"
      placeholder="2026-06-23 12:00:00"
      clearable
      class="code-area"
    />
    <v-list v-if="dateRows.length" bg-color="transparent">
      <v-list-item v-for="row in dateRows" :key="row.label" class="px-0">
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
