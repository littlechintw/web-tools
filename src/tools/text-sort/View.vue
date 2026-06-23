<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'

const { t } = useI18n()

type SortMode = 'none' | 'asc' | 'desc'
const input = ref('')
const sortMode = ref<SortMode>('asc')
const numeric = ref(false)
const caseInsensitive = ref(false)
const removeDuplicates = ref(false)
const reverse = ref(false)
const trim = ref(true)
const removeEmpty = ref(true)

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
</script>

<template>
  <ToolShell>
    <v-textarea
      v-model="input"
      :label="t('tools.text-sort.inputText')"
      rows="8"
      auto-grow
      clearable
      class="code-area"
    />

    <div class="d-flex flex-wrap align-center ga-4 mt-2">
      <v-select
        v-model="sortMode"
        :label="t('tools.text-sort.sort')"
        :items="[
          { title: t('tools.text-sort.none'), value: 'none' },
          { title: t('tools.text-sort.asc'), value: 'asc' },
          { title: t('tools.text-sort.desc'), value: 'desc' },
        ]"
        density="compact"
        hide-details
        style="max-width: 180px"
      />
    </div>

    <div class="d-flex flex-wrap ga-x-4">
      <v-checkbox v-model="numeric" :label="t('tools.text-sort.numeric')" hide-details density="compact" />
      <v-checkbox v-model="caseInsensitive" :label="t('tools.text-sort.caseInsensitive')" hide-details density="compact" />
      <v-checkbox v-model="removeDuplicates" :label="t('tools.text-sort.removeDuplicates')" hide-details density="compact" />
      <v-checkbox v-model="reverse" :label="t('tools.text-sort.reverse')" hide-details density="compact" />
      <v-checkbox v-model="trim" :label="t('tools.text-sort.trim')" hide-details density="compact" />
      <v-checkbox v-model="removeEmpty" :label="t('tools.text-sort.removeEmpty')" hide-details density="compact" />
    </div>

    <div class="d-flex ga-2 mt-2 mb-1">
      <v-chip size="small" variant="tonal">{{ t('tools.text-sort.linesBefore', { n: linesBefore }) }}</v-chip>
      <v-chip size="small" variant="tonal" color="primary">{{ t('tools.text-sort.linesAfter', { n: linesAfter }) }}</v-chip>
    </div>

    <v-textarea
      :model-value="output"
      :label="t('common.output')"
      rows="8"
      auto-grow
      readonly
      class="code-area"
    />

    <div class="d-flex ga-2 mt-2">
      <CopyBtn :text="output" />
    </div>
  </ToolShell>
</template>

<style scoped>
.code-area :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
}
</style>
