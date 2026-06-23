<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'

const { t } = useI18n()
const input = ref('')

const stats = computed(() => {
  const s = input.value
  const chars = [...s].length
  const charsNoSpaces = [...s.replace(/\s/g, '')].length
  const wordCount = (s.match(/\S+/g) ?? []).length
  const lines = s === '' ? 0 : s.split(/\r\n|\r|\n/).length
  const paragraphs = s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).length
  const bytes = new TextEncoder().encode(s).length
  const minutes = Math.ceil(wordCount / 200)
  return [
    { key: 'chars', value: String(chars), icon: 'mdi-alphabetical' },
    { key: 'charsNoSpaces', value: String(charsNoSpaces), icon: 'mdi-alphabetical-variant' },
    { key: 'words', value: String(wordCount), icon: 'mdi-format-text' },
    { key: 'lines', value: String(lines), icon: 'mdi-format-line-spacing' },
    { key: 'paragraphs', value: String(paragraphs), icon: 'mdi-format-paragraph' },
    { key: 'bytes', value: String(bytes), icon: 'mdi-memory' },
    {
      key: 'readingTime',
      value: t('tools.text-stats.minutes', { n: wordCount === 0 ? 0 : minutes }),
      icon: 'mdi-clock-outline',
    },
  ]
})
</script>

<template>
  <ToolShell>
    <v-textarea
      v-model="input"
      :label="t('tools.text-stats.inputText')"
      rows="8"
      auto-grow
      clearable
    />

    <v-row class="mt-2" dense>
      <v-col v-for="s in stats" :key="s.key" cols="6" sm="4" md="3">
        <v-card variant="tonal" color="primary" class="pa-3 text-center">
          <v-icon :icon="s.icon" class="mb-1" />
          <div class="text-h6 font-weight-bold">{{ s.value }}</div>
          <div class="text-caption text-medium-emphasis">{{ t('tools.text-stats.' + s.key) }}</div>
        </v-card>
      </v-col>
    </v-row>
  </ToolShell>
</template>
