<script setup lang="ts">
import { onBeforeUnmount, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PDFDocument, degrees } from '@cantoo/pdf-lib'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'
import { getDocument } from '@/utils/pdfjs'

interface PageItem {
  /** Original 0-based page index in the source PDF. */
  src: number
  /** Cumulative rotation to apply, in degrees (0/90/180/270). */
  rotate: number
  /** Whether the page is marked for deletion. */
  deleted: boolean
  /** Rendered thumbnail object URL. */
  thumb: string
}

const { t } = useI18n()

const fileName = ref('')
const rawBytes = ref<Uint8Array | null>(null)
const pages = reactive<PageItem[]>([])
const loading = ref(false)
const applying = ref(false)
const error = ref('')

function revokeThumbs() {
  for (const p of pages) {
    if (p.thumb) URL.revokeObjectURL(p.thumb)
  }
}

function clearState() {
  revokeThumbs()
  pages.splice(0, pages.length)
  rawBytes.value = null
  fileName.value = ''
  error.value = ''
}

async function onFiles(files: File[]) {
  const file = files[0]
  if (!file) return
  clearState()
  loading.value = true
  fileName.value = file.name
  try {
    const buf = new Uint8Array(await file.arrayBuffer())
    rawBytes.value = buf
    // pdf.js may detach the buffer it receives — hand it a copy.
    const pdf = await getDocument({ data: new Uint8Array(buf.slice(0)) }).promise
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 0.4 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.floor(viewport.width))
      canvas.height = Math.max(1, Math.floor(viewport.height))
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      await page.render({ canvasContext: ctx, viewport, canvas }).promise
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png'),
      )
      pages.push({
        src: i - 1,
        rotate: 0,
        deleted: false,
        thumb: blob ? URL.createObjectURL(blob) : '',
      })
    }
    await pdf.cleanup()
  } catch {
    clearState()
    error.value = t('tools.pdf-organize.loadError')
  } finally {
    loading.value = false
  }
}

function rotatePage(i: number) {
  pages[i].rotate = (pages[i].rotate + 90) % 360
}

function toggleDelete(i: number) {
  pages[i].deleted = !pages[i].deleted
}

function move(i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= pages.length) return
  const tmp = pages[i]
  pages[i] = pages[j]
  pages[j] = tmp
}

async function apply() {
  if (!rawBytes.value) return
  const kept = pages.filter((p) => !p.deleted)
  if (kept.length === 0) {
    error.value = t('tools.pdf-organize.noPagesLeft')
    return
  }
  error.value = ''
  applying.value = true
  try {
    const src = await PDFDocument.load(rawBytes.value)
    const out = await PDFDocument.create()
    const copied = await out.copyPages(
      src,
      kept.map((p) => p.src),
    )
    copied.forEach((page, idx) => {
      const deg = kept[idx].rotate
      if (deg) {
        const base = page.getRotation().angle
        page.setRotation(degrees((base + deg) % 360))
      }
      out.addPage(page)
    })
    const bytes = await out.save()
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName.value.replace(/\.pdf$/i, '') + '-organized.pdf'
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    error.value = t('tools.pdf-organize.applyError')
  } finally {
    applying.value = false
  }
}

onBeforeUnmount(revokeThumbs)
</script>

<template>
  <ToolShell>
    <FileDrop
      v-if="pages.length === 0 && !loading"
      accept="application/pdf"
      :hint="t('tools.pdf-organize.dropHint')"
      @files="onFiles"
    />

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4">
      {{ error }}
    </v-alert>

    <div v-if="loading" class="d-flex flex-column align-center ga-3 py-8">
      <v-progress-circular indeterminate color="primary" />
      <span class="text-medium-emphasis">{{ t('tools.pdf-organize.loading') }}</span>
    </div>

    <template v-if="pages.length > 0">
      <div class="d-flex flex-wrap align-center ga-3 mb-4">
        <span class="text-body-2 text-medium-emphasis">{{ fileName }}</span>
        <v-spacer />
        <v-btn variant="text" prepend-icon="mdi-refresh" @click="clearState">
          {{ t('tools.pdf-organize.reset') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="mdi-download"
          :loading="applying"
          @click="apply"
        >
          {{ t('tools.pdf-organize.apply') }}
        </v-btn>
      </div>

      <div class="page-grid">
        <v-card
          v-for="(p, i) in pages"
          :key="p.src + '-' + i"
          variant="outlined"
          :class="{ 'page-card--deleted': p.deleted }"
          class="pa-2"
        >
          <div class="thumb-wrap">
            <img
              :src="p.thumb"
              :alt="t('tools.pdf-organize.pageLabel', { n: i + 1 })"
              class="thumb"
              :style="{ transform: `rotate(${p.rotate}deg)` }"
            />
            <div v-if="p.deleted" class="deleted-overlay">
              <v-icon icon="mdi-delete" size="32" />
              <span class="text-caption">{{ t('tools.pdf-organize.deleted') }}</span>
            </div>
          </div>

          <div class="text-caption text-center mt-1">
            {{ t('tools.pdf-organize.pageLabel', { n: i + 1 }) }}
          </div>

          <div class="d-flex justify-center ga-1 mt-1">
            <v-btn
              icon="mdi-chevron-left"
              size="x-small"
              variant="text"
              :disabled="i === 0"
              :title="t('tools.pdf-organize.moveLeft')"
              @click="move(i, -1)"
            />
            <v-btn
              icon="mdi-rotate-right"
              size="x-small"
              variant="text"
              :title="t('tools.pdf-organize.rotate')"
              @click="rotatePage(i)"
            />
            <v-btn
              :icon="p.deleted ? 'mdi-restore' : 'mdi-delete-outline'"
              size="x-small"
              variant="text"
              :color="p.deleted ? 'success' : 'error'"
              :title="p.deleted ? t('tools.pdf-organize.restore') : t('tools.pdf-organize.delete')"
              @click="toggleDelete(i)"
            />
            <v-btn
              icon="mdi-chevron-right"
              size="x-small"
              variant="text"
              :disabled="i === pages.length - 1"
              :title="t('tools.pdf-organize.moveRight')"
              @click="move(i, 1)"
            />
          </div>
        </v-card>
      </div>
    </template>
  </ToolShell>
</template>

<style scoped>
.page-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}
.thumb-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 3 / 4;
  background: rgba(var(--v-border-color), 0.06);
  border-radius: 4px;
  overflow: hidden;
}
.thumb {
  max-width: 100%;
  max-height: 100%;
  transition: transform 0.2s;
}
.deleted-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: rgba(var(--v-theme-error), 0.18);
  color: rgb(var(--v-theme-error));
}
.page-card--deleted {
  opacity: 0.7;
}
</style>
