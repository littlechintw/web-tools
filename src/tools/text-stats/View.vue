<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import PasteBtn from '@/components/PasteBtn.vue'

const TOOL_ID = 'text-stats'
const { t } = useI18n()
const T = (key: string, args?: Record<string, unknown>) => t(`tools.${TOOL_ID}.${key}`, args ?? {})

const input = ref('')

// CJK text has no spaces between words: count each CJK character as a word,
// plus each run of remaining non-space characters.
const CJK_RE = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힣]/g

const stats = computed(() => {
  const s = input.value
  const chars = [...s].length
  const charsNoSpaces = [...s.replace(/\s/g, '')].length
  const cjkCount = (s.match(CJK_RE) ?? []).length
  const nonCjkWords = (s.replace(CJK_RE, ' ').match(/\S+/g) ?? []).length
  const wordCount = cjkCount + nonCjkWords
  const lines = s === '' ? 0 : s.split(/\r\n|\r|\n/).length
  const paragraphs = s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).length
  const bytes = new TextEncoder().encode(s).length
  const minutes = Math.ceil(wordCount / 200)
  return [
    { key: 'chars', value: chars.toLocaleString(), icon: 'mdi-alphabetical' },
    { key: 'charsNoSpaces', value: charsNoSpaces.toLocaleString(), icon: 'mdi-alphabetical-variant' },
    { key: 'words', value: wordCount.toLocaleString(), icon: 'mdi-format-text' },
    { key: 'lines', value: lines.toLocaleString(), icon: 'mdi-format-line-spacing' },
    { key: 'paragraphs', value: paragraphs.toLocaleString(), icon: 'mdi-format-paragraph' },
    { key: 'bytes', value: bytes.toLocaleString(), icon: 'mdi-memory' },
    {
      key: 'readingTime',
      value: T('minutes', { n: wordCount === 0 ? 0 : minutes }),
      icon: 'mdi-clock-outline',
    },
  ]
})

// Word frequencies. Intl.Segmenter knows where CJK words begin and end; the
// regex fallback treats every run of letters/digits as one word.
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null

function tokenize(s: string): string[] {
  if (segmenter) {
    const out: string[] = []
    for (const seg of segmenter.segment(s)) if (seg.isWordLike) out.push(seg.segment)
    return out
  }
  return s.match(/[\p{L}\p{N}]+/gu) ?? []
}

const TOP_N = 10
const topWords = computed(() => {
  const freq = new Map<string, number>()
  for (const raw of tokenize(input.value)) {
    const w = raw.toLowerCase()
    // Single characters (articles, particles, stray digits) are noise.
    if ([...w].length < 2) continue
    freq.set(w, (freq.get(w) ?? 0) + 1)
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const max = sorted[0]?.[1] ?? 1
  return sorted.slice(0, TOP_N).map(([word, count]) => ({ word, count, pct: Math.round((count / max) * 100) }))
})
</script>

<template>
  <ToolShell>
    <v-textarea
      v-model="input"
      :label="T('inputText')"
      rows="8"
      auto-grow
      clearable
      hide-details
    />
    <div class="d-flex flex-wrap align-center ga-2 mt-2">
      <PasteBtn @paste="input = $event" />
    </div>

    <v-empty-state
      v-if="!input"
      icon="mdi-text-box-search-outline"
      :title="T('emptyTitle')"
      :text="T('emptyHint')"
      class="my-6"
    />

    <template v-else>
      <v-row class="mt-2" density="comfortable">
        <v-col v-for="s in stats" :key="s.key" cols="6" sm="4" md="3">
          <v-card variant="tonal" color="primary" class="pa-3 text-center">
            <v-icon :icon="s.icon" class="mb-1" />
            <div class="text-h6 font-weight-bold tabular-nums">{{ s.value }}</div>
            <div class="text-caption text-medium-emphasis">{{ T(s.key) }}</div>
          </v-card>
        </v-col>
      </v-row>

      <div v-if="topWords.length" class="mt-6">
        <div class="text-subtitle-2 mb-2">{{ T('topWords') }}</div>
        <v-table density="compact">
          <tbody>
            <tr v-for="(w, i) in topWords" :key="w.word">
              <td class="text-medium-emphasis tabular-nums" style="width: 40px">{{ i + 1 }}</td>
              <td class="font-mono break-all">{{ w.word }}</td>
              <td style="width: 35%">
                <v-progress-linear :model-value="w.pct" color="primary" rounded height="6" />
              </td>
              <td class="text-right tabular-nums font-weight-medium" style="width: 72px">
                {{ w.count.toLocaleString() }}
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </template>
  </ToolShell>
</template>
