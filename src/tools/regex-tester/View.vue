<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import { useStoredRef } from '@/composables/useStoredRef'

const TOOL_ID = 'regex-tester'
const { t } = useI18n()
const T = (key: string, args?: Record<string, unknown>) => t(`tools.${TOOL_ID}.${key}`, args ?? {})

const FLAG_KEYS = ['g', 'i', 'm', 's', 'u', 'y'] as const
type Flag = (typeof FLAG_KEYS)[number]
type FlagState = Record<Flag, boolean>
const DEFAULT_FLAGS: FlagState = { g: true, i: false, m: false, s: false, u: false, y: false }
const isFlagState = (v: unknown): v is FlagState =>
  typeof v === 'object' && v !== null && FLAG_KEYS.every((k) => typeof (v as Record<string, unknown>)[k] === 'boolean')

const pattern = ref('')
const testString = ref('')
const flagState = useStoredRef<FlagState>('regex-tester.flags', { ...DEFAULT_FLAGS }, isFlagState)

/** Ready-made patterns; `key` is the i18n key of the label. */
interface Preset {
  key: string
  pattern: string
  sample: string
}
const PRESETS: Preset[] = [
  {
    key: 'presetEmail',
    pattern: String.raw`[\w.+-]+@[\w-]+(?:\.[\w-]+)+`,
    sample: 'Contact alice@example.com or bob.smith+news@mail.co.uk (not: foo@bar)',
  },
  {
    key: 'presetUrl',
    pattern: String.raw`https?://[^\s/$.?#][^\s]*`,
    sample: 'Docs: https://example.com/path?q=1#top and http://test.org (but not ftp://files.example.com)',
  },
  {
    key: 'presetIpv4',
    pattern: String.raw`\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b`,
    sample: 'Hosts: 192.168.1.1, 10.0.0.255 and 8.8.8.8 (256.1.1.1 is invalid)',
  },
  {
    key: 'presetDate',
    pattern: String.raw`\b\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b`,
    sample: 'Released 2024-03-15, due 2025-12-31; 2024-13-01 is not a date',
  },
  {
    key: 'presetNumber',
    pattern: String.raw`-?\d+(?:\.\d+)?`,
    sample: 'Total: 42 items at 3.99 each, delta -0.5, SKU A1B2',
  },
  {
    key: 'presetHexColor',
    pattern: String.raw`#(?:[0-9a-fA-F]{3}){1,2}\b`,
    sample: 'Palette: #fff, #1E90FF, #00ff00 and #abcd (invalid)',
  },
  {
    key: 'presetCjk',
    pattern: String.raw`[一-鿿]+`,
    sample: 'Hello 世界! Taipei 台北 101, コーヒー 커피, 繁體中文',
  },
]

function applyPreset(p: Preset) {
  pattern.value = p.pattern
  testString.value = p.sample
}

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
    error.value = T('invalidRegex', { msg: (e as Error).message })
    return empty
  }

  const matches: MatchInfo[] = []
  const segments: Segment[] = []
  const str = testString.value
  let last = 0
  let count = 0
  let m: RegExpExecArray | null

  while ((m = re.exec(str)) !== null) {
    if (count++ >= MAX_MATCHES) break
    const idx = m.index
    if (idx > last) segments.push({ text: str.slice(last, idx), match: false })
    segments.push({ text: m[0], match: true })
    last = idx + m[0].length

    const groups: { label: string; value: string }[] = []
    for (let i = 1; i < m.length; i++) {
      groups.push({ label: T('group', { n: i }), value: m[i] ?? '' })
    }
    if (m.groups) {
      for (const [name, value] of Object.entries(m.groups)) {
        groups.push({ label: T('namedGroup', { name }), value: value ?? '' })
      }
    }
    matches.push({ index: idx, full: m[0], groups })

    // guard against zero-length-match infinite loops; advance a full code
    // point, since with the 'u' flag exec() snaps a mid-surrogate lastIndex
    // back to the pair's start and would loop forever
    if (m[0] === '') {
      const cp = str.codePointAt(re.lastIndex)
      re.lastIndex += cp !== undefined && cp > 0xffff ? 2 : 1
    }
  }
  if (last < str.length) segments.push({ text: str.slice(last), match: false })

  return { matches, segments }
})
</script>

<template>
  <ToolShell>
    <v-text-field
      v-model="pattern"
      :label="T('pattern')"
      prepend-inner-icon="mdi-slash-forward"
      clearable
      hide-details
      class="code-area"
    />

    <div class="d-flex flex-wrap align-center ga-1 mt-2 mb-2">
      <span class="text-medium-emphasis mr-2">{{ T('flags') }}:</span>
      <v-checkbox
        v-for="f in FLAG_KEYS"
        :key="f"
        v-model="flagState[f]"
        :label="f"
        hide-details
        density="compact"
        class="mr-1"
      />
      <v-spacer />
      <v-menu>
        <template #activator="{ props: menuProps }">
          <v-btn v-bind="menuProps" variant="text" prepend-icon="mdi-regex" append-icon="mdi-menu-down">
            {{ T('presets') }}
          </v-btn>
        </template>
        <v-list density="compact">
          <v-list-item v-for="p in PRESETS" :key="p.key" :title="T(p.key)" @click="applyPreset(p)">
            <template #subtitle>
              <span class="font-mono text-caption break-all">{{ p.pattern }}</span>
            </template>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

    <v-textarea
      v-model="testString"
      :label="T('testString')"
      rows="6"
      auto-grow
      clearable
      hide-details
      class="code-area"
    />
    <div class="d-flex flex-wrap align-center ga-2 mt-2">
      <PasteBtn @paste="testString = $event" />
    </div>

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
        <v-chip :color="result.matches.length ? 'primary' : undefined" variant="tonal" size="small">
          {{ T('matchCount', { n: result.matches.length }) }}
        </v-chip>
      </div>

      <v-sheet v-if="result.segments.length" class="hl font-mono pa-3 rounded-lg mb-3" border>
        <span
          v-for="(seg, i) in result.segments"
          :key="i"
          :class="{ 'hl-match': seg.match }"
        >{{ seg.text }}</span>
      </v-sheet>

      <div v-if="!result.matches.length && pattern && testString" class="text-medium-emphasis">
        {{ T('noMatch') }}
      </div>

      <v-expansion-panels v-if="result.matches.length" multiple variant="accordion">
        <v-expansion-panel v-for="(mm, i) in result.matches" :key="i">
          <v-expansion-panel-title>
            <span class="font-mono">{{ T('match', { n: i + 1 }) }}</span>
            <span class="text-medium-emphasis ml-2 break-all">
              {{ T('indexAt', { i: mm.index }) }} · {{ mm.full }}
            </span>
          </v-expansion-panel-title>
          <v-expansion-panel-text v-if="mm.groups.length">
            <div class="text-caption text-medium-emphasis mb-1">{{ T('groups') }}</div>
            <div v-for="(g, gi) in mm.groups" :key="gi" class="font-mono break-all">
              {{ g.label }}: {{ g.value }}
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>
  </ToolShell>
</template>

<style scoped>
.hl {
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}
.hl-match {
  background-color: rgba(var(--v-theme-warning), 0.35);
  border-radius: 3px;
}
</style>
