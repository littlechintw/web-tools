<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import CopyBtn from '@/components/CopyBtn.vue'
import { downloadText } from '@/utils/download'

/**
 * Read-only result panel: a labelled monospace textarea with a character
 * count, copy button and (optionally) a download button in its header.
 *
 *   <OutputPanel :value="output" :error="error" filename="result.json" />
 */
const props = withDefaults(
  defineProps<{
    value: string
    label?: string
    error?: string
    rows?: number | string
    autoGrow?: boolean
    mono?: boolean
    /** When set, a download button saves the value under this filename. */
    filename?: string
    mime?: string
    placeholder?: string
    /** Hide the character counter (e.g. for short single-line results). */
    hideCount?: boolean
  }>(),
  { label: '', error: '', rows: 6, autoGrow: true, mono: true, filename: '', mime: 'text/plain;charset=utf-8', placeholder: '', hideCount: false },
)

const { t } = useI18n()
const chars = computed(() => Array.from(props.value).length)
const title = computed(() => props.label || t('common.output'))

function download() {
  if (props.value) downloadText(props.value, props.filename, props.mime)
}
</script>

<template>
  <div class="output-panel">
    <div class="d-flex align-center ga-1 mb-1">
      <span class="text-caption text-medium-emphasis">{{ title }}</span>
      <v-chip v-if="!hideCount && value" size="x-small" variant="tonal" label class="ml-1">
        {{ t('common.charCount', { n: chars.toLocaleString() }) }}
      </v-chip>
      <v-spacer />
      <slot name="actions" />
      <v-btn
        v-if="filename"
        icon="mdi-download"
        size="small"
        variant="text"
        :disabled="!value"
        :title="t('common.download')"
        :aria-label="t('common.download')"
        @click="download"
      />
      <CopyBtn :text="value" icon size="small" />
    </div>
    <slot>
      <v-textarea
        :model-value="value"
        :rows="rows"
        :auto-grow="autoGrow"
        :error-messages="error || undefined"
        :placeholder="placeholder || t('common.noOutput')"
        readonly
        hide-details="auto"
        class="output-field"
        :class="{ 'code-area': mono }"
      />
    </slot>
  </div>
</template>

<style scoped>
/* A faint fill tells the output apart from editable inputs. */
.output-field :deep(.v-field) {
  background-color: rgba(var(--v-theme-on-surface), 0.03);
}
</style>
