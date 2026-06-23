<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import ToolShell from '@/components/ToolShell.vue'
import { useHistory } from '@/composables/useHistory'

const TOOL_ID = 'markdown-preview'
const { t } = useI18n()
const route = useRoute()
const history = useHistory<{ input: string }>(TOOL_ID)

const input = ref('')

const rendered = computed(() => {
  if (!input.value) return ''
  const raw = marked.parse(input.value, { async: false }) as string
  return DOMPurify.sanitize(raw)
})

function save() {
  if (!input.value.trim()) return
  history.save(input.value.slice(0, 40), { input: input.value })
}

watch(input, () => save())

onMounted(() => {
  const h = route.query.h as string | undefined
  if (h) {
    const e = history.entries.value.find((x) => x.id === h)
    if (e) input.value = e.data.input
  }
})
</script>

<template>
  <ToolShell :max-width="1200">
    <div class="d-flex flex-wrap ga-4">
      <v-textarea
        v-model="input"
        :label="t('tools.markdown-preview.inputMd')"
        rows="18"
        auto-grow
        clearable
        class="code-area flex-1-1"
        style="min-width: 320px"
      />
      <div class="flex-1-1" style="min-width: 320px">
        <div class="text-caption text-medium-emphasis mb-1">{{ t('tools.markdown-preview.preview') }}</div>
        <v-sheet class="md-preview pa-4 rounded-lg" border>
          <!-- eslint-disable-next-line vue/no-v-html -- sanitized via DOMPurify -->
          <div v-html="rendered" />
        </v-sheet>
      </div>
    </div>
  </ToolShell>
</template>

<style scoped>
.code-area :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 14px;
}
.md-preview {
  min-height: 200px;
  line-height: 1.6;
}
.md-preview :deep(h1),
.md-preview :deep(h2),
.md-preview :deep(h3) {
  margin: 0.6em 0 0.3em;
  font-weight: 600;
}
.md-preview :deep(p) {
  margin: 0.5em 0;
}
.md-preview :deep(ul),
.md-preview :deep(ol) {
  padding-left: 1.5em;
  margin: 0.5em 0;
}
.md-preview :deep(pre) {
  background-color: rgba(var(--v-theme-on-surface), 0.06);
  padding: 0.8em;
  border-radius: 6px;
  overflow-x: auto;
}
.md-preview :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.9em;
}
.md-preview :deep(blockquote) {
  border-left: 3px solid rgba(var(--v-theme-primary), 0.5);
  padding-left: 1em;
  margin: 0.5em 0;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.md-preview :deep(table) {
  border-collapse: collapse;
}
.md-preview :deep(th),
.md-preview :deep(td) {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.2);
  padding: 0.4em 0.6em;
}
.md-preview :deep(img) {
  max-width: 100%;
}
</style>
