<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import OutputPanel from '@/components/OutputPanel.vue'
import { isBoolean, oneOf, useStoredRef } from '@/composables/useStoredRef'

const TOOL_ID = 'text-sort'
const { t } = useI18n()
const T = (key: string, args?: Record<string, unknown>) => t(`tools.${TOOL_ID}.${key}`, args ?? {})

type SortMode = 'none' | 'asc' | 'desc'
const input = ref('')
// Options are remembered between visits; the text itself is not.
const sortMode = useStoredRef<SortMode>('text-sort.sortMode', 'asc', oneOf(['none', 'asc', 'desc']))
const numeric = useStoredRef('text-sort.numeric', false, isBoolean)
const caseInsensitive = useStoredRef('text-sort.caseInsensitive', false, isBoolean)
const removeDuplicates = useStoredRef('text-sort.removeDuplicates', false, isBoolean)
const reverse = useStoredRef('text-sort.reverse', false, isBoolean)
const trim = useStoredRef('text-sort.trim', true, isBoolean)
const removeEmpty = useStoredRef('text-sort.removeEmpty', true, isBoolean)

const linesBefore = computed(() => (input.value === '' ? 0 : input.value.split(/\r\n|\r|\n/).length))

const output = computed(() => {
  if (input.value === '') return ''
  let lines = input.value.split(/\r\n|\r|\n/)

  if (trim.value) lines = lines.map((l) => l.trim())
  if (removeEmpty.value) lines = lines.filter((l) => l !== '')

  if (removeDuplicates.value) {
    const seen = new Set<string>()
    lines = lines.filter((l) => {
      const key = caseInsensitive.value ? l.toLowerCase() : l
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  if (sortMode.value !== 'none') {
    lines.sort((a, b) => {
      if (numeric.value) {
        const na = parseFloat(a)
        const nb = parseFloat(b)
        const aNum = !Number.isNaN(na)
        const bNum = !Number.isNaN(nb)
        if (aNum && bNum && na !== nb) return na - nb
        if (aNum !== bNum) return aNum ? -1 : 1
      }
      const x = caseInsensitive.value ? a.toLowerCase() : a
      const y = caseInsensitive.value ? b.toLowerCase() : b
      return x.localeCompare(y)
    })
    if (sortMode.value === 'desc') lines.reverse()
  }

  if (reverse.value) lines.reverse()

  return lines.join('\n')
})

const linesAfter = computed(() => (output.value === '' ? 0 : output.value.split('\n').length))

function loadExample() {
  input.value = ['banana', 'Apple', 'cherry', 'apple', '', '10', '2', 'banana'].join('\n')
}
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
      class="code-area"
    />
    <div class="d-flex flex-wrap align-center ga-2 mt-2">
      <PasteBtn @paste="input = $event" />
      <v-btn variant="text" prepend-icon="mdi-lightbulb-outline" @click="loadExample">
        {{ t('common.loadExample') }}
      </v-btn>
    </div>

    <div class="d-flex flex-wrap align-center ga-4 mt-3">
      <v-select
        v-model="sortMode"
        :label="T('sort')"
        :items="[
          { title: T('none'), value: 'none' },
          { title: T('asc'), value: 'asc' },
          { title: T('desc'), value: 'desc' },
        ]"
        density="compact"
        hide-details
        style="max-width: 180px"
      />
    </div>

    <div class="d-flex flex-wrap ga-x-4">
      <v-checkbox v-model="numeric" :label="T('numeric')" hide-details density="compact" />
      <v-checkbox v-model="caseInsensitive" :label="T('caseInsensitive')" hide-details density="compact" />
      <v-checkbox v-model="removeDuplicates" :label="T('removeDuplicates')" hide-details density="compact" />
      <v-checkbox v-model="reverse" :label="T('reverse')" hide-details density="compact" />
      <v-checkbox v-model="trim" :label="T('trim')" hide-details density="compact" />
      <v-checkbox v-model="removeEmpty" :label="T('removeEmpty')" hide-details density="compact" />
    </div>

    <div class="d-flex ga-2 mt-2 mb-3">
      <v-chip size="small" variant="tonal">{{ T('linesBefore', { n: linesBefore }) }}</v-chip>
      <v-chip size="small" variant="tonal" color="primary">{{ T('linesAfter', { n: linesAfter }) }}</v-chip>
    </div>

    <OutputPanel :value="output" :rows="8" filename="sorted.txt" />
  </ToolShell>
</template>
