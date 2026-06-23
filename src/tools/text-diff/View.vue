<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { diffLines, diffWords } from 'diff'
import ToolShell from '@/components/ToolShell.vue'

const { t } = useI18n()

type Mode = 'line' | 'word'
const mode = ref<Mode>('line')
const original = ref('')
const changed = ref('')

const parts = computed(() => {
  if (!original.value && !changed.value) return []
  return mode.value === 'line'
    ? diffLines(original.value, changed.value)
    : diffWords(original.value, changed.value)
})

const additions = computed(() =>
  parts.value.filter((p) => p.added).reduce((n, p) => n + p.value.length, 0),
)
const deletions = computed(() =>
  parts.value.filter((p) => p.removed).reduce((n, p) => n + p.value.length, 0),
)
const hasDiff = computed(() => parts.value.some((p) => p.added || p.removed))
</script>

<template>
  <ToolShell>
    <div class="d-flex flex-wrap align-center ga-4 mb-4">
      <v-btn-toggle v-model="mode" mandatory color="primary" density="comfortable" variant="outlined">
        <v-btn value="line">{{ t('tools.text-diff.lineMode') }}</v-btn>
        <v-btn value="word">{{ t('tools.text-diff.wordMode') }}</v-btn>
      </v-btn-toggle>
    </div>

    <div class="d-flex flex-wrap ga-4">
      <v-textarea
        v-model="original"
        :label="t('tools.text-diff.original')"
        rows="8"
        auto-grow
        clearable
        class="code-area flex-1-1"
        style="min-width: 280px"
      />
      <v-textarea
        v-model="changed"
        :label="t('tools.text-diff.changed')"
        rows="8"
        auto-grow
        clearable
        class="code-area flex-1-1"
        style="min-width: 280px"
      />
    </div>

    <div class="d-flex ga-2 mt-3 mb-2">
      <v-chip color="success" variant="tonal" size="small">
        {{ t('tools.text-diff.additions', { n: additions }) }}
      </v-chip>
      <v-chip color="error" variant="tonal" size="small">
        {{ t('tools.text-diff.deletions', { n: deletions }) }}
      </v-chip>
    </div>

    <v-sheet v-if="parts.length" class="diff-out pa-3 rounded-lg" border>
      <span v-if="!hasDiff" class="text-medium-emphasis">{{ t('tools.text-diff.noDiff') }}</span>
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
.code-area :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
}
.diff-out {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
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
