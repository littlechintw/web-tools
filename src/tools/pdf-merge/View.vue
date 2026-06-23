<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PDFDocument } from '@cantoo/pdf-lib'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'

interface PdfItem {
  name: string
  buffer: ArrayBuffer
  pageCount: number
}

const { t } = useI18n()

const items = ref<PdfItem[]>([])
const error = ref('')
const busy = ref(false)
let lastUrl: string | null = null

const totalPages = computed(() => items.value.reduce((sum, it) => sum + it.pageCount, 0))

async function onFiles(files: File[]) {
  error.value = ''
  for (const file of files) {
    try {
      const buffer = await file.arrayBuffer()
      const doc = await PDFDocument.load(buffer)
      items.value.push({ name: file.name, buffer, pageCount: doc.getPageCount() })
    } catch {
      error.value = t('tools.pdf-merge.loadError', { name: file.name })
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
}

function remove(index: number) {
  items.value.splice(index, 1)
}

function clearAll() {
  items.value = []
  error.value = ''
}

function revokeUrl() {
  if (lastUrl) {
    URL.revokeObjectURL(lastUrl)
    lastUrl = null
  }
}

async function merge() {
  if (!items.value.length || busy.value) return
  error.value = ''
  busy.value = true
  try {
    const out = await PDFDocument.create()
    for (const item of items.value) {
      const src = await PDFDocument.load(item.buffer)
      const copied = await out.copyPages(src, src.getPageIndices())
      for (const page of copied) out.addPage(page)
    }
    const bytes = await out.save()
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
    revokeUrl()
    lastUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = lastUrl
    a.download = t('tools.pdf-merge.outputName')
    a.click()
  } catch {
    error.value = t('tools.pdf-merge.mergeError')
  } finally {
    busy.value = false
  }
}

onUnmounted(revokeUrl)
</script>

<template>
  <ToolShell>
    <FileDrop
      accept="application/pdf"
      :multiple="true"
      :hint="items.length ? t('tools.pdf-merge.addMore') : t('tools.pdf-merge.dropHint')"
      @files="onFiles"
    />

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-4">
      {{ error }}
    </v-alert>

    <div v-if="!items.length" class="text-medium-emphasis text-body-2 mt-4">
      {{ t('tools.pdf-merge.empty') }}
    </div>

    <template v-else>
      <div class="d-flex align-center justify-space-between mt-4 mb-2">
        <span class="text-body-2 font-weight-medium">
          {{ t('tools.pdf-merge.totalPages', { count: totalPages }) }}
        </span>
        <v-btn variant="text" size="small" color="error" prepend-icon="mdi-delete-sweep" @click="clearAll">
          {{ t('tools.pdf-merge.clearAll') }}
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
          <v-list-item-subtitle>{{ item.pageCount }} {{ t('tools.pdf-merge.pages') }}</v-list-item-subtitle>
          <template #append>
            <v-btn
              icon="mdi-arrow-up"
              variant="text"
              size="small"
              :disabled="i === 0"
              :title="t('tools.pdf-merge.moveUp')"
              @click="move(i, -1)"
            />
            <v-btn
              icon="mdi-arrow-down"
              variant="text"
              size="small"
              :disabled="i === items.length - 1"
              :title="t('tools.pdf-merge.moveDown')"
              @click="move(i, 1)"
            />
            <v-btn
              icon="mdi-close"
              variant="text"
              size="small"
              color="error"
              :title="t('tools.pdf-merge.remove')"
              @click="remove(i)"
            />
          </template>
        </v-list-item>
      </v-list>

      <v-btn
        color="primary"
        size="large"
        class="mt-4"
        prepend-icon="mdi-merge"
        :loading="busy"
        :disabled="busy"
        @click="merge"
      >
        {{ busy ? t('tools.pdf-merge.merging') : t('tools.pdf-merge.merge') }}
      </v-btn>
    </template>
  </ToolShell>
</template>
