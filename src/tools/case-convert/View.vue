<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'

const { t } = useI18n()
const input = ref('')

/** Split arbitrary text into normalized lowercase words. */
function words(s: string): string[] {
  return (
    s
      // split camelCase / PascalCase boundaries
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      // non-alphanumeric separators
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map((w) => w.toLowerCase())
  )
}

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)

const rows = computed(() => {
  const w = words(input.value)
  const sentence = w.length ? cap(w.join(' ')) : ''
  return [
    { key: 'camelCase', value: w.map((x, i) => (i ? cap(x) : x)).join('') },
    { key: 'PascalCase', value: w.map(cap).join('') },
    { key: 'snake_case', value: w.join('_') },
    { key: 'kebab-case', value: w.join('-') },
    { key: 'CONSTANT_CASE', value: w.join('_').toUpperCase() },
    { key: 'dot.case', value: w.join('.') },
    { key: 'Title Case', value: w.map(cap).join(' ') },
    { key: 'lowercase', value: input.value.toLowerCase() },
    { key: 'UPPERCASE', value: input.value.toUpperCase() },
    { key: 'Sentence case', value: sentence },
  ]
})
</script>

<template>
  <ToolShell>
    <v-textarea
      v-model="input"
      :label="t('tools.case-convert.inputText')"
      rows="3"
      auto-grow
      clearable
      class="code-area"
    />

    <v-table density="comfortable" class="mt-3">
      <tbody>
        <tr v-for="row in rows" :key="row.key">
          <td class="text-medium-emphasis" style="width: 160px; white-space: nowrap">{{ row.key }}</td>
          <td class="mono">{{ row.value }}</td>
          <td style="width: 56px" class="text-right">
            <CopyBtn :text="row.value" icon size="small" />
          </td>
        </tr>
      </tbody>
    </v-table>
  </ToolShell>
</template>

<style scoped>
.code-area :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
  word-break: break-all;
}
</style>
