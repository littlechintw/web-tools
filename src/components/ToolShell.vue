<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toolsByRoute } from '@/tools/registry'
import { useFavoritesStore } from '@/stores/favorites'

const props = defineProps<{
  /** Override the tool route to look up; defaults to the current route. */
  route?: string
  maxWidth?: number | string
}>()

const route = useRoute()
const { t } = useI18n()
const favorites = useFavoritesStore()

const tool = computed(() => {
  const key = props.route ?? route.path.replace(/^\//, '')
  return toolsByRoute[key]
})
const isFav = computed(() => (tool.value ? favorites.isFavorite(tool.value.id) : false))
</script>

<template>
  <v-container :style="{ maxWidth: (maxWidth ?? 980) + 'px' }" class="py-6">
    <div v-if="tool" class="d-flex align-start mb-1 ga-3">
      <v-avatar color="primary" variant="tonal" size="44" rounded="lg" class="flex-shrink-0">
        <v-icon :icon="tool.icon" size="26" />
      </v-avatar>
      <div class="flex-grow-1 min-w-0">
        <h1 class="text-h5 font-weight-bold">{{ t('tools.' + tool.id + '.title') }}</h1>
        <p class="text-body-2 text-medium-emphasis mt-1">{{ t('tools.' + tool.id + '.description') }}</p>
      </div>
      <div class="d-flex align-center ga-1 flex-shrink-0">
        <slot name="actions" />
        <v-btn
          :icon="isFav ? 'mdi-star' : 'mdi-star-outline'"
          :color="isFav ? 'amber' : undefined"
          variant="text"
          :title="isFav ? t('home.removeFavorite') : t('home.addFavorite')"
          :aria-label="isFav ? t('home.removeFavorite') : t('home.addFavorite')"
          :aria-pressed="isFav"
          @click="favorites.toggle(tool.id)"
        />
      </div>
    </div>
    <v-divider class="my-4" />
    <slot />
  </v-container>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}
</style>
