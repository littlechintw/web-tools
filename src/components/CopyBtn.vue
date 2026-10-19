<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClipboard } from '@/composables/useClipboard'

const props = withDefaults(
  defineProps<{
    text: string
    variant?: 'flat' | 'text' | 'tonal' | 'outlined'
    size?: string
    block?: boolean
    label?: boolean
    icon?: boolean
    /** Disable explicitly; the button is also disabled while `text` is empty. */
    disabled?: boolean
    /** Custom caption instead of "Copy" (the "Copied!" feedback is kept). */
    labelText?: string
  }>(),
  { variant: 'tonal', size: 'default', block: false, label: true, icon: false, disabled: false, labelText: '' },
)

const { t } = useI18n()
const { copied, copy } = useClipboard()
const isDisabled = computed(() => props.disabled || !props.text)
</script>

<template>
  <v-btn
    v-if="icon"
    :icon="copied ? 'mdi-check' : 'mdi-content-copy'"
    :color="copied ? 'success' : undefined"
    :size="size"
    :disabled="isDisabled"
    variant="text"
    :title="copied ? t('common.copied') : t('common.copy')"
    :aria-label="t('common.copy')"
    @click="copy(props.text)"
  />
  <v-btn
    v-else
    :variant="variant"
    :size="size"
    :block="block"
    :disabled="isDisabled"
    :color="copied ? 'success' : 'primary'"
    :prepend-icon="copied ? 'mdi-check' : 'mdi-content-copy'"
    @click="copy(props.text)"
  >
    <template v-if="label">{{ copied ? t('common.copied') : labelText || t('common.copy') }}</template>
  </v-btn>
</template>
