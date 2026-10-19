<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClipboard } from '@/composables/useClipboard'

withDefaults(
  defineProps<{
    variant?: 'flat' | 'text' | 'tonal' | 'outlined'
    size?: string
    /** Icon-only button (with a tooltip title). */
    icon?: boolean
  }>(),
  { variant: 'text', size: 'default', icon: false },
)

const emit = defineEmits<{ paste: [text: string] }>()

const { t } = useI18n()
const { read, canRead } = useClipboard()
const failed = ref(false)

async function paste() {
  const text = await read()
  if (text === null) {
    failed.value = true
    setTimeout(() => (failed.value = false), 2000)
    return
  }
  emit('paste', text)
}
</script>

<template>
  <!-- Firefox and non-secure contexts have no clipboard read API: the user
       can still Ctrl+V into the field, so just hide the button. -->
  <v-btn
    v-if="canRead && icon"
    :icon="failed ? 'mdi-alert-circle-outline' : 'mdi-content-paste'"
    :color="failed ? 'error' : undefined"
    :size="size"
    variant="text"
    :title="failed ? t('common.pasteFailed') : t('common.paste')"
    :aria-label="t('common.paste')"
    @click="paste"
  />
  <v-btn
    v-else-if="canRead"
    :variant="variant"
    :size="size"
    :color="failed ? 'error' : undefined"
    :prepend-icon="failed ? 'mdi-alert-circle-outline' : 'mdi-content-paste'"
    @click="paste"
  >
    {{ failed ? t('common.pasteFailed') : t('common.paste') }}
  </v-btn>
</template>
