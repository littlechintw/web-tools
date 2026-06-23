<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'

const { t } = useI18n()

const pattern = ref('')
const testString = ref('')
const flagState = ref<Record<string, boolean>>({
  g: true,
  i: false,
  m: false,
  s: false,
  u: false,
  y: false,
})
const FLAG_KEYS = ['g', 'i', 'm', 's', 'u', 'y'] as const

const MAX_MATCHES = 10000

interface MatchInfo {
  index: number
  full: string
  groups: { label: string; value: string }[]
}

interface Segment {
  text: string
  match: boolean
}

const error = ref('')

const result = computed<{ matches: MatchInfo[]; segments: Segment[] }>(() => {
  error.value = ''
  const empty = { matches: [] as MatchInfo[], segments: [] as Segment[] }
  if (!pattern.value || !testString.value) return empty

  let flags = FLAG_KEYS.filter((f) => flagState.value[f]).join('')
  // 'g' is required to enumerate all matches; force a global copy internally.
  if (!flags.includes('g')) flags += 'g'

  let re: RegExp
  try {
    re = new RegExp(pattern.value, flags)
  } catch (e) {
    error.value = t('tools.regex-tester.invalidRegex', { msg: (e as Error).message })
    return empty
  }

  const matches: MatchInfo[] = []
  const segments: Segment[] = []
  const str = testString.value
  let last = 0
  let count = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(str)) !== null) {
    if (count++ > MAX_MATCHES) break
    const idx = m.index
    if (idx > last) segments.push({ text: str.slice(last, idx), match: false })
    segments.push({ text: m[0], match: true })
    last = idx + m[0].length

    const groups: { label: string; value: string }[] = []
    for (let i = 1; i < m.length; i++) {
      groups.push({ label: t('tools.regex-tester.group', { n: i }), value: m[i] ?? '' })
    }
    if (m.groups) {
      for (const [name, value] of Object.entries(m.groups)) {
        groups.push({
          label: t('tools.regex-tester.namedGroup', { name }),
          value: value ?? '',
        })
      }
    }
    matches.push({ index: idx, full: m[0], groups })

    // guard against zero-length-match infinite loops
    if (m[0] === '') re.lastIndex++
  }
  if (last < str.length) segments.push({ text: str.slice(last), match: false })

  return { matches, segments }
})
</script>

<template>
  <ToolShell>
    <v-text-field
      v-model="pattern"
      :label="t('tools.regex-tester.pattern')"
      prepend-inner-icon="mdi-slash-forward"
      clearable
      class="mono-field"
    />

    <div class="d-flex flex-wrap align-center ga-1 mb-2">
      <span class="text-medium-emphasis mr-2">{{ t('tools.regex-tester.flags') }}:</span>
      <v-checkbox
        v-for="f in FLAG_KEYS"
        :key="f"
        v-model="flagState[f]"
        :label="f"
        hide-details
        density="compact"
        class="mr-1"
      />
    </div>

    <v-textarea
      v-model="testString"
      :label="t('tools.regex-tester.testString')"
      rows="6"
      auto-grow
      clearable
      class="mono-field"
    />

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mt-3"
      :text="error"
    />

    <template v-else>
      <div class="d-flex align-center ga-2 mt-3 mb-2">
        <v-chip color="primary" variant="tonal" size="small">
          {{ t('tools.regex-tester.matchCount', { n: result.matches.length }) }}
        </v-chip>
      </div>

      <v-sheet v-if="result.segments.length" class="hl pa-3 rounded-lg mb-3" border>
        <span
          v-for="(seg, i) in result.segments"
          :key="i"
          :class="{ 'hl-match': seg.match }"
        >{{ seg.text }}</span>
      </v-sheet>

      <div v-if="!result.matches.length && pattern && testString" class="text-medium-emphasis">
        {{ t('tools.regex-tester.noMatch') }}
      </div>

      <v-expansion-panels v-if="result.matches.length" multiple variant="accordion">
        <v-expansion-panel v-for="(mm, i) in result.matches" :key="i">
          <v-expansion-panel-title>
            <span class="mono">{{ t('tools.regex-tester.match', { n: i + 1 }) }}</span>
            <span class="text-medium-emphasis ml-2">
              {{ t('tools.regex-tester.indexAt', { i: mm.index }) }} · {{ mm.full }}
            </span>
          </v-expansion-panel-title>
          <v-expansion-panel-text v-if="mm.groups.length">
            <div class="text-caption text-medium-emphasis mb-1">{{ t('tools.regex-tester.groups') }}</div>
            <div v-for="(g, gi) in mm.groups" :key="gi" class="mono">
              {{ g.label }}: {{ g.value }}
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>
  </ToolShell>
</template>

<style scoped>
.mono-field :deep(input),
.mono-field :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
  word-break: break-all;
}
.hl {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}
.hl-match {
  background-color: rgba(var(--v-theme-warning), 0.35);
  border-radius: 3px;
}
</style>
