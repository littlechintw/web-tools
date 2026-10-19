<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import ToolShell from '@/components/ToolShell.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import { useClipboard } from '@/composables/useClipboard'
import { useHistory } from '@/composables/useHistory'
import { oneOf, useStoredRef } from '@/composables/useStoredRef'
import { downloadText } from '@/utils/download'

const TOOL_ID = 'markdown-preview'
const { t } = useI18n()
const { smAndUp } = useDisplay()
const T = (key: string) => t(`tools.${TOOL_ID}.${key}`)
const history = useHistory<{ input: string }>(TOOL_ID)
const { copied, copy } = useClipboard()

type Layout = 'split' | 'preview'
const layout = useStoredRef<Layout>('markdown-preview.layout', 'split', oneOf(['split', 'preview']))
const input = ref('')

const rendered = computed(() => {
  if (!input.value) return ''
  const raw = marked.parse(input.value, { async: false }) as string
  return DOMPurify.sanitize(raw)
})

const EXAMPLE = [
  '# Project notes',
  '',
  'Some **bold** and _italic_ text with a [link](https://example.com).',
  '',
  '- First item',
  '- Second item',
  '  - Nested item',
  '',
  '| Name  | Qty |',
  '| ----- | --: |',
  '| Apple |   3 |',
  '| Pear  |   5 |',
  '',
  '```js',
  'const greet = (name) => "Hello, " + name',
  '```',
  '',
  '> Rendered live and sanitized with DOMPurify.',
].join('\n')

function loadExample() {
  input.value = EXAMPLE
}

/** The first heading (or first non-empty line) names the exported document. */
const docTitle = computed(() => {
  const first = input.value
    .split('\n')
    .find((l) => l.trim())
    ?.replace(/^#+\s*/, '')
    .trim()
  return first || 'document'
})

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function htmlDocument(): string {
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(docTitle.value)}</title>`,
    '</head>',
    '<body>',
    rendered.value,
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

function downloadMd() {
  if (input.value) downloadText(input.value, 'document.md', 'text/markdown;charset=utf-8')
}

function downloadHtml() {
  if (rendered.value) downloadText(htmlDocument(), 'document.html', 'text/html;charset=utf-8')
}

function save() {
  if (!input.value.trim()) return
  history.save(input.value.slice(0, 40), { input: input.value })
}

watch(input, () => save())

history.restoreFromRoute((d) => {
  input.value = d.input
})
</script>

<template>
  <ToolShell :max-width="1200">
    <div class="d-flex flex-wrap ga-4">
      <div v-if="layout === 'split'" class="flex-1-1" style="min-width: 320px">
        <v-textarea
          v-model="input"
          :label="T('inputMd')"
          rows="18"
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
      </div>

      <div class="flex-1-1" style="min-width: 320px">
        <div class="d-flex flex-wrap align-center ga-1 mb-1">
          <span class="text-caption text-medium-emphasis">{{ T('preview') }}</span>
          <v-spacer />
          <v-btn-toggle v-model="layout" mandatory density="compact" variant="text" divided>
            <v-btn
              value="split"
              icon="mdi-view-split-vertical"
              size="small"
              :title="T('layoutSplit')"
              :aria-label="T('layoutSplit')"
            />
            <v-btn
              value="preview"
              icon="mdi-eye-outline"
              size="small"
              :title="T('layoutPreview')"
              :aria-label="T('layoutPreview')"
            />
          </v-btn-toggle>
          <v-divider vertical class="mx-1 align-self-stretch" />
          <!-- Phones get icon-only buttons so the toolbar stays on one line.
               (A VBtn ignores `icon` whenever a default slot exists, so the two
               variants are separate elements.) -->
          <template v-if="smAndUp">
            <v-btn
              size="small"
              variant="text"
              :disabled="!rendered"
              :color="copied ? 'success' : undefined"
              :prepend-icon="copied ? 'mdi-check' : 'mdi-code-tags'"
              @click="copy(rendered)"
            >
              {{ copied ? t('common.copied') : T('copyHtml') }}
            </v-btn>
            <v-btn
              size="small"
              variant="text"
              prepend-icon="mdi-language-markdown-outline"
              :disabled="!input"
              @click="downloadMd"
            >
              {{ T('downloadMd') }}
            </v-btn>
            <v-btn size="small" variant="text" prepend-icon="mdi-download" :disabled="!rendered" @click="downloadHtml">
              {{ T('downloadHtml') }}
            </v-btn>
          </template>
          <template v-else>
            <v-btn
              size="small"
              variant="text"
              :disabled="!rendered"
              :color="copied ? 'success' : undefined"
              :icon="copied ? 'mdi-check' : 'mdi-code-tags'"
              :title="T('copyHtml')"
              :aria-label="T('copyHtml')"
              @click="copy(rendered)"
            />
            <v-btn
              size="small"
              variant="text"
              icon="mdi-language-markdown-outline"
              :disabled="!input"
              :title="T('downloadMd')"
              :aria-label="T('downloadMd')"
              @click="downloadMd"
            />
            <v-btn
              size="small"
              variant="text"
              icon="mdi-download"
              :disabled="!rendered"
              :title="T('downloadHtml')"
              :aria-label="T('downloadHtml')"
              @click="downloadHtml"
            />
          </template>
        </div>
        <v-sheet class="md-preview pa-4 rounded-lg" border>
          <div v-if="!rendered" class="text-medium-emphasis">{{ t('common.noOutput') }}</div>
          <!-- eslint-disable-next-line vue/no-v-html -- sanitized via DOMPurify -->
          <div v-else v-html="rendered" />
        </v-sheet>
      </div>
    </div>
  </ToolShell>
</template>

<style scoped>
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
  font-family: var(--font-mono);
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
