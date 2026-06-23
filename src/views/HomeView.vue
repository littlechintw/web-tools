<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { allTools, categoryOrder } from '@/tools/registry'
import { useFavoritesStore } from '@/stores/favorites'
import type { CategoryId } from '@/types'

const { t } = useI18n()
const favorites = useFavoritesStore()

const query = ref('')
const activeCat = ref<CategoryId | 'all' | 'fav'>('all')

const categories = categoryOrder.filter((c) => allTools.some((tl) => tl.category === c))

const toolTitle = (id: string) => t(`tools.${id}.title`)
const toolDesc = (id: string) => t(`tools.${id}.description`)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return allTools.filter((tl) => {
    if (activeCat.value === 'fav' && !favorites.isFavorite(tl.id)) return false
    if (activeCat.value !== 'all' && activeCat.value !== 'fav' && tl.category !== activeCat.value)
      return false
    if (!q) return true
    const hay = [toolTitle(tl.id), toolDesc(tl.id), tl.id, ...(tl.keywords ?? [])]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
})
</script>

<template>
  <v-container class="py-8" style="max-width: 1200px">
    <div class="text-center mb-6">
      <h1 class="text-h4 text-md-h3 font-weight-bold">{{ t('app.name') }}</h1>
      <p class="text-body-1 text-medium-emphasis mt-2">{{ t('app.tagline') }}</p>
      <p class="text-caption text-disabled mt-1">{{ t('app.privacy') }}</p>
    </div>

    <v-text-field
      v-model="query"
      :placeholder="t('home.searchPlaceholder')"
      prepend-inner-icon="mdi-magnify"
      clearable
      variant="solo-filled"
      flat
      hide-details
      class="mb-4 mx-auto"
      style="max-width: 640px"
    />

    <div class="d-flex flex-wrap justify-center ga-2 mb-6">
      <v-chip
        :variant="activeCat === 'all' ? 'flat' : 'tonal'"
        :color="activeCat === 'all' ? 'primary' : undefined"
        @click="activeCat = 'all'"
      >
        {{ t('home.allCategories') }}
      </v-chip>
      <v-chip
        :variant="activeCat === 'fav' ? 'flat' : 'tonal'"
        :color="activeCat === 'fav' ? 'primary' : undefined"
        prepend-icon="mdi-star"
        @click="activeCat = 'fav'"
      >
        {{ t('home.favorites') }}
      </v-chip>
      <v-chip
        v-for="c in categories"
        :key="c"
        :variant="activeCat === c ? 'flat' : 'tonal'"
        :color="activeCat === c ? 'primary' : undefined"
        @click="activeCat = c"
      >
        {{ t('categories.' + c) }}
      </v-chip>
    </div>

    <div class="text-caption text-medium-emphasis mb-3">
      {{ t('home.toolCount', { count: filtered.length }) }}
    </div>

    <v-row v-if="filtered.length">
      <v-col v-for="tl in filtered" :key="tl.id" cols="12" sm="6" md="4" lg="3">
        <v-card
          :to="'/' + tl.route"
          height="100%"
          variant="tonal"
          class="tool-card d-flex flex-column"
          hover
        >
          <v-card-item>
            <template #prepend>
              <v-avatar color="primary" variant="flat" rounded="lg">
                <v-icon :icon="tl.icon" />
              </v-avatar>
            </template>
            <v-card-title class="text-body-1 font-weight-bold">{{ toolTitle(tl.id) }}</v-card-title>
            <template #append>
              <v-btn
                :icon="favorites.isFavorite(tl.id) ? 'mdi-star' : 'mdi-star-outline'"
                :color="favorites.isFavorite(tl.id) ? 'amber' : undefined"
                variant="text"
                size="small"
                :title="favorites.isFavorite(tl.id) ? t('home.removeFavorite') : t('home.addFavorite')"
                @click.prevent="favorites.toggle(tl.id)"
              />
            </template>
          </v-card-item>
          <v-card-text class="text-body-2 text-medium-emphasis pt-0">
            {{ toolDesc(tl.id) }}
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-empty-state
      v-else
      icon="mdi-magnify-close"
      :title="t('home.noResults')"
    />
  </v-container>
</template>

<style scoped>
.tool-card {
  transition: transform 0.15s ease;
}
.tool-card:hover {
  transform: translateY(-3px);
}
</style>
