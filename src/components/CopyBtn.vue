<script setup lang="ts">
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
  }>(),
  { variant: 'tonal', size: 'default', block: false, label: true, icon: false },
)

const { t } = useI18n()
const { copied, copy } = useClipboard()
</script>

<template>
  <v-btn
    v-if="icon"
    :icon="copied ? 'mdi-check' : 'mdi-content-copy'"
    :color="copied ? 'success' : undefined"
    :size="size"
    variant="text"
    :title="t('common.copy')"
    @click="copy(props.text)"
  />
  <v-btn
    v-else
    :variant="variant"
    :size="size"
    :block="block"
    :color="copied ? 'success' : 'primary'"
    :prepend-icon="copied ? 'mdi-check' : 'mdi-content-copy'"
    @click="copy(props.text)"
  >
    <template v-if="label">{{ copied ? t('common.copied') : t('common.copy') }}</template>
  </v-btn>
</template>
