<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { allTools } from '@/tools/registry'
import { searchTools } from '@/lib/toolSearch'
import { useRecentsStore } from '@/stores/recents'
import { useFavoritesStore } from '@/stores/favorites'
import type { RegisteredTool } from '@/types'

/** ⌘K / Ctrl+K tool switcher: type to search, arrows to move, Enter to open. */
const open = defineModel<boolean>({ default: false })

const { t } = useI18n()
const router = useRouter()
const recents = useRecentsStore()
const favorites = useFavoritesStore()

const query = ref('')
const active = ref(0)
const inputRef = ref<{ focus: () => void } | null>(null)
const listRef = ref<HTMLElement | null>(null)

const byId = Object.fromEntries(allTools.map((tl) => [tl.id, tl]))
const titleOf = (id: string) => t(`tools.${id}.title`)
const descOf = (id: string) => t(`tools.${id}.description`)

interface Item {
  tool: RegisteredTool
  /** Position in the flattened list, for keyboard navigation. */
  index: number
}
interface Section {
  key: string
  label: string
  items: Item[]
}

const sections = computed<Section[]>(() => {
  const groups: { key: string; label: string; tools: RegisteredTool[] }[] = []
  if (query.value.trim()) {
    groups.push({ key: 'results', label: t('palette.results'), tools: searchTools(allTools, query.value, titleOf, descOf).slice(0, 12) })
  } else {
    const recent = recents.ids.map((id) => byId[id]).filter((x): x is RegisteredTool => !!x).slice(0, 6)
    if (recent.length) groups.push({ key: 'recent', label: t('home.recent'), tools: recent })
    const fav = favorites.ids
      .map((id) => byId[id])
      .filter((x): x is RegisteredTool => !!x && !recent.includes(x))
      .slice(0, 6)
    if (fav.length) groups.push({ key: 'fav', label: t('home.favorites'), tools: fav })
    if (!groups.length) groups.push({ key: 'all', label: t('home.allCategories'), tools: allTools.slice(0, 10) })
  }
  let index = 0
  return groups.map((g) => ({ key: g.key, label: g.label, items: g.tools.map((tool) => ({ tool, index: index++ })) }))
})

const flat = computed(() => sections.value.flatMap((s) => s.items.map((i) => i.tool)))

watch(open, async (v) => {
  if (v) {
    query.value = ''
    active.value = 0
    await nextTick()
    inputRef.value?.focus()
  }
})
watch(query, () => (active.value = 0))

function go(tool: RegisteredTool) {
  open.value = false
  router.push('/' + tool.route)
}

function move(delta: number) {
  const n = flat.value.length
  if (!n) return
  active.value = (active.value + delta + n) % n
  void nextTick(() => {
    listRef.value
      ?.querySelector<HTMLElement>(`[data-index="${active.value}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  })
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    move(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    move(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const tool = flat.value[active.value]
    if (tool) go(tool)
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="620" transition="dialog-top-transition">
    <v-card rounded="lg" @keydown="onKeydown">
      <v-text-field
        ref="inputRef"
        v-model="query"
        :placeholder="t('palette.placeholder')"
        prepend-inner-icon="mdi-magnify"
        variant="solo"
        flat
        hide-details
        autofocus
        clearable
        class="palette-input"
      />
      <v-divider />
      <div ref="listRef" class="palette-list">
        <template v-for="section in sections" :key="section.key">
          <div class="text-caption text-medium-emphasis px-4 pt-3 pb-1">{{ section.label }}</div>
          <v-list density="compact" nav class="py-0">
            <v-list-item
              v-for="item in section.items"
              :key="item.tool.id"
              :data-index="item.index"
              :active="active === item.index"
              :prepend-icon="item.tool.icon"
              :title="t('tools.' + item.tool.id + '.title')"
              :subtitle="t('tools.' + item.tool.id + '.description')"
              rounded="lg"
              color="primary"
              @click="go(item.tool)"
              @mousemove="active = item.index"
            />
          </v-list>
        </template>
        <div v-if="!flat.length" class="text-medium-emphasis text-body-2 pa-6 text-center">
          {{ t('home.noResults') }}
        </div>
      </div>
      <v-divider />
      <div class="text-caption text-medium-emphasis px-4 py-2">{{ t('palette.hint') }}</div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.palette-list {
  max-height: min(60vh, 480px);
  overflow-y: auto;
}
.palette-list :deep(.v-list-item-subtitle) {
  -webkit-line-clamp: 1;
}
.palette-input :deep(input) {
  font-size: 1.05rem;
}
</style>
