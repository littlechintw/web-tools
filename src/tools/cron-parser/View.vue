<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import cronstrue from 'cronstrue'
import { CronExpressionParser } from 'cron-parser'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'

const { t, locale } = useI18n()

const expr = ref('*/5 * * * *')
const description = ref('')
const nextRuns = ref<string[]>([])
const error = ref('')
const usedFallback = ref(false)

let zhLocaleReady = false
let zhLocaleFailed = false

const presets: { key: string; value: string }[] = [
  { key: 'everyMinute', value: '* * * * *' },
  { key: 'hourly', value: '0 * * * *' },
  { key: 'dailyMidnight', value: '0 0 * * *' },
  { key: 'weekly', value: '0 0 * * 0' },
  { key: 'monthly', value: '0 0 1 * *' },
]

async function ensureZhLocale(): Promise<boolean> {
  if (zhLocaleReady) return true
  if (zhLocaleFailed) return false
  try {
    // Side-effect import registers the zh_TW locale on cronstrue.
    await import('cronstrue/locales/zh_TW')
    zhLocaleReady = true
    return true
  } catch {
    zhLocaleFailed = true
    return false
  }
}

async function parse() {
  error.value = ''
  description.value = ''
  nextRuns.value = []
  usedFallback.value = false
  const value = expr.value.trim()
  if (!value) return

  const wantZh = locale.value === 'zh-TW'
  let useLocale = 'en'
  if (wantZh) {
    const ok = await ensureZhLocale()
    if (ok) useLocale = 'zh_TW'
    else usedFallback.value = true
  }

  try {
    description.value = cronstrue.toString(value, { locale: useLocale, throwExceptionOnParseError: true })
  } catch {
    // Description failed: still try to compute run times, but surface the error.
    error.value = t('tools.cron-parser.errInvalid')
  }

  try {
    const interval = CronExpressionParser.parse(value)
    const dates = interval.take(8)
    nextRuns.value = dates.map((d) => {
      const date = d.toDate()
      return date.toLocaleString(locale.value === 'zh-TW' ? 'zh-TW' : 'en-US')
    })
  } catch {
    if (!error.value) error.value = t('tools.cron-parser.errInvalid')
  }
}

function applyPreset(value: string) {
  expr.value = value
}

watch([expr, locale], parse, { immediate: true })
</script>

<template>
  <ToolShell>
    <div class="mb-2">
      <div class="text-body-2 mb-1">{{ t('tools.cron-parser.presets') }}</div>
      <div class="d-flex flex-wrap ga-2">
        <v-btn
          v-for="p in presets"
          :key="p.key"
          variant="outlined"
          size="small"
          @click="applyPreset(p.value)"
        >
          {{ t('tools.cron-parser.' + p.key) }}
        </v-btn>
      </div>
    </div>

    <v-text-field
      v-model="expr"
      :label="t('tools.cron-parser.expression')"
      class="code-area mt-2"
      clearable
      :error-messages="error"
    />

    <v-card v-if="description" variant="tonal" class="mt-2">
      <v-card-text>
        <div class="text-caption text-medium-emphasis">{{ t('tools.cron-parser.description') }}</div>
        <div class="text-body-1 mt-1">{{ description }}</div>
        <div v-if="usedFallback" class="text-caption text-medium-emphasis mt-1">
          {{ t('tools.cron-parser.englishFallback') }}
        </div>
      </v-card-text>
    </v-card>

    <template v-if="nextRuns.length">
      <h3 class="text-subtitle-1 font-weight-medium mt-4 mb-2">
        {{ t('tools.cron-parser.nextRuns') }}
      </h3>
      <v-list density="compact" class="rounded-lg border">
        <v-list-item v-for="(d, i) in nextRuns" :key="i">
          <template #prepend>
            <span class="text-medium-emphasis mr-3">{{ i + 1 }}.</span>
          </template>
          <v-list-item-title class="mono">{{ d }}</v-list-item-title>
          <template #append>
            <CopyBtn :text="d" icon size="small" />
          </template>
        </v-list-item>
      </v-list>
    </template>
  </ToolShell>
</template>

<style scoped>
.code-area :deep(input) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
}
</style>
