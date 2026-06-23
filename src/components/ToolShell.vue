<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toolsByRoute } from '@/tools/registry'

const props = defineProps<{
  /** Override the tool route to look up; defaults to the current route. */
  route?: string
  maxWidth?: number | string
}>()

const route = useRoute()
const { t } = useI18n()

const tool = computed(() => {
  const key = props.route ?? route.path.replace(/^\//, '')
  return toolsByRoute[key]
})
</script>

<template>
  <v-container :style="{ maxWidth: (maxWidth ?? 980) + 'px' }" class="py-6">
    <div v-if="tool" class="d-flex align-center mb-1 ga-3">
      <v-avatar color="primary" variant="tonal" size="44" rounded="lg">
        <v-icon :icon="tool.icon" size="26" />
      </v-avatar>
      <div>
        <h1 class="text-h5 font-weight-bold">{{ t('tools.' + tool.id + '.title') }}</h1>
        <p class="text-body-2 text-medium-emphasis mt-1">{{ t('tools.' + tool.id + '.description') }}</p>
      </div>
    </div>
    <v-divider class="my-4" />
    <slot />
  </v-container>
</template>
