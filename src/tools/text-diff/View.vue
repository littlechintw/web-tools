<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { diffLines, diffWords } from 'diff'
import ToolShell from '@/components/ToolShell.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import { isBoolean, oneOf, useStoredRef } from '@/composables/useStoredRef'

const TOOL_ID = 'text-diff'
const { t } = useI18n()
const T = (key: string, args?: Record<string, unknown>) => t(`tools.${TOOL_ID}.${key}`, args ?? {})

type Mode = 'line' | 'word'
const mode = useStoredRef<Mode>('text-diff.mode', 'line', oneOf(['line', 'word']))
const ignoreCase = useStoredRef('text-diff.ignoreCase', false, isBoolean)
const ignoreWhitespace = useStoredRef('text-diff.ignoreWhitespace', false, isBoolean)
const original = ref('')
const changed = ref('')

// jsdiff honours `ignoreCase` for every diff kind (Diff#equals) but only
// declares it in the word/char option types, hence the widened type.
type LineOptions = NonNullable<Parameters<typeof diffLines>[2]> & { ignoreCase?: boolean }

const parts = computed(() => {
  if (!original.value && !changed.value) return []
  if (mode.value === 'line') {
    const opts: LineOptions = { ignoreCase: ignoreCase.value, ignoreWhitespace: ignoreWhitespace.value }
    return diffLines(original.value, changed.value, opts)
  }
  // Word diff already treats whitespace as insignificant.
  return diffWords(original.value, changed.value, { ignoreCase: ignoreCase.value })
})

const additions = computed(() =>
  parts.value.filter((p) => p.added).reduce((n, p) => n + (p.count ?? 0), 0),
)
const deletions = computed(() =>
  parts.value.filter((p) => p.removed).reduce((n, p) => n + (p.count ?? 0), 0),
)
const hasDiff = computed(() => parts.value.some((p) => p.added || p.removed))

function swap() {
  const o = original.value
  original.value = changed.value
  changed.value = o
}
</script>

<template>
  <ToolShell>
    <div class="d-flex flex-wrap align-center ga-4 mb-4">
      <v-btn-toggle v-model="mode" mandatory color="primary" density="comfortable" variant="outlined" divided>
        <v-btn value="line">{{ T('lineMode') }}</v-btn>
        <v-btn value="word">{{ T('wordMode') }}</v-btn>
      </v-btn-toggle>
      <v-checkbox v-model="ignoreCase" :label="T('ignoreCase')" hide-details density="compact" />
      <v-checkbox
        v-model="ignoreWhitespace"
        :label="T('ignoreWhitespace')"
        :disabled="mode === 'word'"
        hide-details
        density="compact"
      />
      <v-spacer />
      <v-btn
        variant="text"
        prepend-icon="mdi-swap-horizontal"
        :disabled="!original && !changed"
        :title="T('swapHint')"
        @click="swap"
      >
        {{ t('common.swap') }}
      </v-btn>
    </div>

    <div class="d-flex flex-wrap ga-4">
      <div class="flex-1-1" style="min-width: 280px">
        <v-textarea
          v-model="original"
          :label="T('original')"
          rows="8"
          auto-grow
          clearable
          hide-details
          class="code-area"
        />
        <div class="d-flex mt-1">
          <PasteBtn size="small" @paste="original = $event" />
        </div>
      </div>
      <div class="flex-1-1" style="min-width: 280px">
        <v-textarea
          v-model="changed"
          :label="T('changed')"
          rows="8"
          auto-grow
          clearable
          hide-details
          class="code-area"
        />
        <div class="d-flex mt-1">
          <PasteBtn size="small" @paste="changed = $event" />
        </div>
      </div>
    </div>

    <div class="d-flex ga-2 mt-3 mb-2">
      <v-chip color="success" variant="tonal" size="small">
        {{ T('additions', { n: additions }) }}
      </v-chip>
      <v-chip color="error" variant="tonal" size="small">
        {{ T('deletions', { n: deletions }) }}
      </v-chip>
    </div>

    <v-sheet v-if="parts.length" class="diff-out font-mono pa-3 rounded-lg" border>
      <span v-if="!hasDiff" class="text-medium-emphasis">{{ T('noDiff') }}</span>
      <template v-else>
        <span
          v-for="(p, i) in parts"
          :key="i"
          :class="{ 'diff-add': p.added, 'diff-del': p.removed }"
        >{{ p.value }}</span>
      </template>
    </v-sheet>
  </ToolShell>
</template>

<style scoped>
.diff-out {
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
}
.diff-add {
  background-color: rgba(var(--v-theme-success), 0.22);
}
.diff-del {
  background-color: rgba(var(--v-theme-error), 0.18);
  text-decoration: line-through;
}
</style>
