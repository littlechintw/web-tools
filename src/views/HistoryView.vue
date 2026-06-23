<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useHistoryStore } from '@/stores/history'
import { allTools, toolsByRoute } from '@/tools/registry'
import type { HistoryEntry } from '@/types'

const { t } = useI18n()
const router = useRouter()
const store = useHistoryStore()

const search = ref('')
const toolFilter = ref<string>('all')

const toolById = computed(() =>
  Object.fromEntries(allTools.map((tl) => [tl.id, tl])),
)

const usedToolIds = computed(() => {
  const ids = new Set(store.entries.map((e) => e.toolId))
  return allTools.filter((tl) => ids.has(tl.id))
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return store.entries.filter((e) => {
    if (toolFilter.value !== 'all' && e.toolId !== toolFilter.value) return false
    if (!q) return true
    return (
      e.label.toLowerCase().includes(q) ||
      JSON.stringify(e.data).toLowerCase().includes(q)
    )
  })
})

function toolName(toolId: string): string {
  const tl = toolById.value[toolId]
  return tl ? t(`tools.${toolId}.title`) : toolId
}

function toolIcon(toolId: string): string {
  return toolById.value[toolId]?.icon ?? 'mdi-puzzle-outline'
}

function openTool(e: HistoryEntry) {
  const tl = toolById.value[e.toolId]
  if (tl) router.push({ path: '/' + tl.route, query: { h: e.id } })
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString()
}

// ----- editing -----
const editDialog = ref(false)
const editing = ref<HistoryEntry | null>(null)
const editLabel = ref('')
const editData = ref('')
const editError = ref('')

function startEdit(e: HistoryEntry) {
  editing.value = e
  editLabel.value = e.label
  editData.value = JSON.stringify(e.data, null, 2)
  editError.value = ''
  editDialog.value = true
}

function saveEdit() {
  if (!editing.value) return
  let parsed: unknown
  try {
    parsed = JSON.parse(editData.value)
  } catch {
    editError.value = t('history.invalidJson')
    return
  }
  store.update(editing.value.id, { label: editLabel.value, data: parsed })
  editDialog.value = false
}

// ----- delete -----
function delEntry(e: HistoryEntry) {
  if (confirm(t('history.confirmDelete'))) store.remove(e.id)
}

function clearCurrentTool() {
  if (toolFilter.value === 'all') {
    if (confirm(t('history.confirmClearEverything'))) store.clearAll()
  } else {
    const name = toolName(toolFilter.value)
    if (confirm(t('history.confirmDeleteAll', { tool: name }))) store.clearTool(toolFilter.value)
  }
}

// ----- export / import -----
function exportJson() {
  const blob = new Blob([JSON.stringify(store.entries, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `web-tools-history-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const importInput = ref<HTMLInputElement>()
function triggerImport() {
  importInput.value?.click()
}
async function onImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    if (Array.isArray(data)) store.importEntries(data, 'merge')
  } catch {
    alert(t('history.invalidJson'))
  }
  ;(e.target as HTMLInputElement).value = ''
}

// expose to satisfy template usage
void toolsByRoute
</script>

<template>
  <v-container class="py-6" style="max-width: 1080px">
    <div class="d-flex align-center ga-3 mb-4">
      <v-icon icon="mdi-history" size="32" color="primary" />
      <h1 class="text-h5 font-weight-bold">{{ t('history.title') }}</h1>
      <v-spacer />
      <v-btn variant="text" prepend-icon="mdi-export" @click="exportJson">{{ t('history.export') }}</v-btn>
      <v-btn variant="text" prepend-icon="mdi-import" @click="triggerImport">{{ t('history.import') }}</v-btn>
      <input ref="importInput" type="file" accept="application/json" hidden @change="onImport" />
    </div>

    <v-row class="mb-2" dense>
      <v-col cols="12" sm="7">
        <v-text-field
          v-model="search"
          :placeholder="t('history.search')"
          prepend-inner-icon="mdi-magnify"
          hide-details
          clearable
          density="compact"
        />
      </v-col>
      <v-col cols="12" sm="5">
        <v-select
          v-model="toolFilter"
          :items="[
            { title: t('history.allTools'), value: 'all' },
            ...usedToolIds.map((tl) => ({ title: t(`tools.${tl.id}.title`), value: tl.id })),
          ]"
          hide-details
          density="compact"
        />
      </v-col>
    </v-row>

    <div class="d-flex align-center mb-3">
      <span class="text-caption text-medium-emphasis">{{ t('history.count', { count: filtered.length }) }}</span>
      <v-spacer />
      <v-btn
        v-if="store.entries.length"
        size="small"
        color="error"
        variant="text"
        prepend-icon="mdi-delete-sweep"
        @click="clearCurrentTool"
      >
        {{ toolFilter === 'all' ? t('history.deleteAll') : t('history.deleteToolHistory') }}
      </v-btn>
    </div>

    <v-empty-state
      v-if="!store.entries.length"
      icon="mdi-history"
      :title="t('history.empty')"
      :text="t('history.emptyHint')"
    />

    <v-list v-else lines="two">
      <v-list-item
        v-for="e in filtered"
        :key="e.id"
        :prepend-icon="toolIcon(e.toolId)"
        rounded="lg"
        class="mb-1"
        border
      >
        <v-list-item-title class="font-weight-medium">{{ e.label || '(untitled)' }}</v-list-item-title>
        <v-list-item-subtitle>
          {{ toolName(e.toolId) }} · {{ fmtDate(e.createdAt) }}
        </v-list-item-subtitle>
        <template #append>
          <v-btn icon="mdi-open-in-app" variant="text" size="small" :title="t('history.open')" @click="openTool(e)" />
          <v-btn icon="mdi-pencil" variant="text" size="small" :title="t('history.edit')" @click="startEdit(e)" />
          <v-btn icon="mdi-delete" variant="text" size="small" color="error" :title="t('history.delete')" @click="delEntry(e)" />
        </template>
      </v-list-item>
    </v-list>

    <v-dialog v-model="editDialog" max-width="640">
      <v-card>
        <v-card-title>{{ t('history.edit') }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="editLabel" :label="t('history.editLabel')" class="mb-2" />
          <v-textarea
            v-model="editData"
            :label="t('history.editData')"
            :error-messages="editError"
            rows="10"
            class="code-area"
            auto-grow
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="editDialog = false">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" @click="saveEdit">{{ t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.code-area :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}
</style>
