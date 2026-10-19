<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay } from 'vuetify'
import { allTools, categoryOrder } from '@/tools/registry'
import { useFavoritesStore } from '@/stores/favorites'
import { useRecentsStore } from '@/stores/recents'
import { searchTools } from '@/lib/toolSearch'
import type { CategoryId, RegisteredTool } from '@/types'

const { t } = useI18n()
const { mobile } = useDisplay()
const favorites = useFavoritesStore()
const recents = useRecentsStore()

const query = ref('')
const activeCat = ref<CategoryId | 'all' | 'fav'>('all')

const categories = categoryOrder.filter((c) => allTools.some((tl) => tl.category === c))
const byId = Object.fromEntries(allTools.map((tl) => [tl.id, tl]))

const toolTitle = (id: string) => t(`tools.${id}.title`)
const toolDesc = (id: string) => t(`tools.${id}.description`)

const filtered = computed(() => {
  const pool = allTools.filter((tl) => {
    if (activeCat.value === 'fav') return favorites.isFavorite(tl.id)
    if (activeCat.value !== 'all') return tl.category === activeCat.value
    return true
  })
  return searchTools(pool, query.value, toolTitle, toolDesc)
})

const recentTools = computed(() =>
  recents.ids.map((id) => byId[id]).filter((x): x is RegisteredTool => !!x).slice(0, 8),
)
const showRecent = computed(() => recentTools.value.length > 0 && !query.value.trim() && activeCat.value === 'all')
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
      autofocus
      class="mb-4 mx-auto"
      style="max-width: 640px"
    />

    <!-- Phones: one horizontally scrollable row instead of four stacked rows of chips. -->
    <div class="d-flex ga-2 mb-6 cat-row" :class="mobile ? 'cat-row--scroll' : 'flex-wrap justify-center'">
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

    <!-- Recently used: the tools you actually come back to, one click away. -->
    <section v-if="showRecent" class="mb-6">
      <div class="d-flex align-center mb-2">
        <v-icon icon="mdi-history" size="18" class="mr-1 text-medium-emphasis" />
        <span class="text-subtitle-2 text-medium-emphasis">{{ t('home.recent') }}</span>
        <v-spacer />
        <v-btn size="x-small" variant="text" @click="recents.clear()">{{ t('home.clearRecent') }}</v-btn>
      </div>
      <div class="d-flex flex-wrap ga-2">
        <v-chip
          v-for="tl in recentTools"
          :key="tl.id"
          :to="'/' + tl.route"
          :prepend-icon="tl.icon"
          variant="outlined"
          link
        >
          {{ toolTitle(tl.id) }}
        </v-chip>
      </div>
    </section>

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
                :aria-label="favorites.isFavorite(tl.id) ? t('home.removeFavorite') : t('home.addFavorite')"
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

    <v-empty-state v-else icon="mdi-magnify-close" :title="t('home.noResults')" />
  </v-container>
</template>

<style scoped>
.cat-row--scroll {
  overflow-x: auto;
  flex-wrap: nowrap;
  padding-bottom: 4px;
  margin-inline: -16px;
  padding-inline: 16px;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.cat-row--scroll::-webkit-scrollbar {
  display: none;
}
.cat-row--scroll > * {
  flex: 0 0 auto;
}
.tool-card {
  transition: transform 0.15s ease;
}
/* Titles must stay readable in narrow columns: wrap instead of truncating. */
.tool-card :deep(.v-card-title) {
  white-space: normal;
  line-height: 1.3;
  word-break: break-word;
}
.tool-card :deep(.v-card-item__append) {
  align-self: flex-start;
}
.tool-card:hover {
  transform: translateY(-3px);
}
</style>
