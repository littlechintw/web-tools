<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PDFDocument } from '@cantoo/pdf-lib'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'
import { downloadBlob } from '@/utils/download'
import { formatBytes, stripExtension } from '@/utils/format'

interface PdfItem {
  name: string
  size: number
  buffer: ArrayBuffer
  pageCount: number
}

const { t } = useI18n()
const T = (key: string, args?: Record<string, unknown>) => t(`tools.pdf-merge.${key}`, args ?? {})

const items = ref<PdfItem[]>([])
const error = ref('')
const success = ref('')
const busy = ref(false)

const totalPages = computed(() => items.value.reduce((sum, it) => sum + it.pageCount, 0))
const totalSize = computed(() => items.value.reduce((sum, it) => sum + it.size, 0))
const canMerge = computed(() => items.value.length >= 2)
// The merged file is named after the first document in the list.
const outputName = computed(() =>
  items.value.length ? `${stripExtension(items.value[0].name)}-merged.pdf` : '',
)

// Serialize batches so two quick drops append in drop order instead of
// interleaving their files as each finishes parsing.
let addQueue: Promise<void> = Promise.resolve()

function onFiles(files: File[]) {
  addQueue = addQueue.then(() => addFiles(files))
}

async function addFiles(files: File[]) {
  error.value = ''
  success.value = ''
  for (const file of files) {
    try {
      const buffer = await file.arrayBuffer()
      const doc = await PDFDocument.load(buffer)
      items.value.push({ name: file.name, size: file.size, buffer, pageCount: doc.getPageCount() })
    } catch {
      error.value = T('loadError', { name: file.name })
    }
  }
}

function move(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= items.value.length) return
  const next = items.value.slice()
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved)
  items.value = next
  success.value = ''
}

function remove(index: number) {
  items.value.splice(index, 1)
  success.value = ''
}

function clearAll() {
  items.value = []
  error.value = ''
  success.value = ''
}

async function merge() {
  if (!canMerge.value || busy.value) return
  error.value = ''
  success.value = ''
  busy.value = true
  try {
    const out = await PDFDocument.create()
    for (const item of items.value) {
      const src = await PDFDocument.load(item.buffer)
      const copied = await out.copyPages(src, src.getPageIndices())
      for (const page of copied) out.addPage(page)
    }
    const bytes = await out.save()
    const name = outputName.value
    downloadBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), name)
    success.value = T('merged', { count: items.value.length, name })
  } catch {
    error.value = T('mergeError')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <ToolShell>
    <FileDrop
      accept="application/pdf,.pdf"
      :multiple="true"
      :show-selected="false"
      :hint="items.length ? T('addMore') : T('dropHint')"
      @files="onFiles"
    />

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-4">
      {{ error }}
    </v-alert>

    <div v-if="!items.length" class="text-medium-emphasis text-body-2 mt-4">
      {{ T('empty') }}
    </div>

    <template v-else>
      <div class="d-flex flex-wrap align-center ga-2 mt-4 mb-2">
        <span class="text-body-2 font-weight-medium">{{ T('totalPages', { count: totalPages }) }}</span>
        <span class="text-body-2 text-medium-emphasis">· {{ T('totalSize', { size: formatBytes(totalSize) }) }}</span>
        <v-spacer />
        <v-btn variant="text" size="small" color="error" prepend-icon="mdi-delete-sweep" @click="clearAll">
          {{ T('clearAll') }}
        </v-btn>
      </div>

      <v-list lines="two" density="comfortable" class="rounded-lg border">
        <v-list-item v-for="(item, i) in items" :key="i">
          <template #prepend>
            <v-avatar color="primary" variant="tonal" rounded="lg">
              <span class="text-caption font-weight-bold">{{ i + 1 }}</span>
            </v-avatar>
          </template>
          <v-list-item-title class="text-truncate">{{ item.name }}</v-list-item-title>
          <v-list-item-subtitle>
            {{ item.pageCount }} {{ T('pages') }} · {{ formatBytes(item.size) }}
          </v-list-item-subtitle>
          <template #append>
            <v-btn
              icon="mdi-arrow-up"
              variant="text"
              size="small"
              :disabled="i === 0"
              :title="T('moveUp')"
              @click="move(i, -1)"
            />
            <v-btn
              icon="mdi-arrow-down"
              variant="text"
              size="small"
              :disabled="i === items.length - 1"
              :title="T('moveDown')"
              @click="move(i, 1)"
            />
            <v-btn
              icon="mdi-close"
              variant="text"
              size="small"
              color="error"
              :title="T('remove')"
              @click="remove(i)"
            />
          </template>
        </v-list-item>
      </v-list>

      <div class="d-flex flex-wrap align-center ga-3 mt-4">
        <v-btn
          color="primary"
          size="large"
          prepend-icon="mdi-merge"
          :loading="busy"
          :disabled="busy || !canMerge"
          @click="merge"
        >
          {{ busy ? T('merging') : T('merge') }}
        </v-btn>
        <span v-if="!canMerge" class="text-caption text-medium-emphasis">{{ T('needTwo') }}</span>
        <span v-else class="text-caption text-medium-emphasis text-truncate">{{ outputName }}</span>
      </div>

      <v-alert v-if="success" type="success" variant="tonal" density="compact" class="mt-4">
        {{ success }}
      </v-alert>
    </template>
  </ToolShell>
</template>
