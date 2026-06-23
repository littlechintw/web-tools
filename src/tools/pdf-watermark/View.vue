<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PDFDocument, StandardFonts, degrees, rgb } from '@cantoo/pdf-lib'
import ToolShell from '@/components/ToolShell.vue'
import FileDrop from '@/components/FileDrop.vue'

const { t } = useI18n()

type Layout = 'tile' | 'center'

const pdfBytes = ref<Uint8Array | null>(null)
const fileName = ref('')
const pageCount = ref(0)

const text = ref('CONFIDENTIAL')
const fontSize = ref(48)
const color = ref('#ff0000')
const opacity = ref(0.3)
const rotation = ref(45)
const layout = ref<Layout>('tile')

const busy = ref(false)
const error = ref('')

/** Convert a #rrggbb string to pdf-lib rgb (0-1 components). */
function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return rgb(0, 0, 0)
  const int = parseInt(m[1], 16)
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255)
}

async function onFiles(files: File[]) {
  const file = files[0]
  if (!file || file.type !== 'application/pdf') {
    error.value = 'Not a PDF file'
    return
  }
  error.value = ''
  fileName.value = file.name.replace(/\.pdf$/i, '')
  pdfBytes.value = new Uint8Array(await file.arrayBuffer())
  try {
    const doc = await PDFDocument.load(pdfBytes.value.slice())
    pageCount.value = doc.getPageCount()
  } catch (e) {
    error.value = (e as Error).message
    pdfBytes.value = null
  }
}

async function apply() {
  if (!pdfBytes.value || !text.value) return
  busy.value = true
  error.value = ''
  try {
    const doc = await PDFDocument.load(pdfBytes.value.slice())
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const col = hexToRgb(color.value)
    const angle = degrees(rotation.value)

    for (const page of doc.getPages()) {
      const { width, height } = page.getSize()
      const textWidth = font.widthOfTextAtSize(text.value, fontSize.value)

      if (layout.value === 'center') {
        // Center the rotated baseline roughly on the page midpoint.
        const rad = (rotation.value * Math.PI) / 180
        page.drawText(text.value, {
          x: width / 2 - (textWidth / 2) * Math.cos(rad),
          y: height / 2 - (textWidth / 2) * Math.sin(rad),
          size: fontSize.value,
          font,
          color: col,
          opacity: opacity.value,
          rotate: angle,
        })
      } else {
        // Tile across the page on a regular grid.
        const stepX = Math.max(textWidth + fontSize.value * 2, fontSize.value * 4)
        const stepY = Math.max(fontSize.value * 4, 60)
        for (let y = -stepY; y < height + stepY; y += stepY) {
          for (let x = -stepX; x < width + stepX; x += stepX) {
            page.drawText(text.value, {
              x,
              y,
              size: fontSize.value,
              font,
              color: col,
              opacity: opacity.value,
              rotate: angle,
            })
          }
        }
      }
    }

    const bytes = await doc.save()
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName.value || 'watermarked'}-watermarked.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <ToolShell>
    <FileDrop accept="application/pdf" :hint="t('tools.pdf-watermark.dropHint')" @files="onFiles" />

    <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-4">
      {{ error }}
    </v-alert>

    <p v-if="!pdfBytes" class="text-medium-emphasis text-body-2 mt-4">
      {{ t('tools.pdf-watermark.noPdf') }}
    </p>

    <template v-else>
      <p class="text-medium-emphasis text-body-2 mt-4">
        {{ t('tools.pdf-watermark.pageCount', { count: pageCount }) }}
      </p>

      <v-text-field
        v-model="text"
        :label="t('tools.pdf-watermark.text')"
        class="mt-2"
        density="comfortable"
        hide-details
      />

      <v-row class="mt-2" dense>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model.number="fontSize"
            :label="t('tools.pdf-watermark.fontSize')"
            type="number"
            min="1"
            density="comfortable"
            hide-details
          />
        </v-col>
        <v-col cols="12" sm="6">
          <v-text-field
            v-model="color"
            :label="t('tools.pdf-watermark.color')"
            type="color"
            density="comfortable"
            hide-details
          />
        </v-col>
      </v-row>

      <div class="mt-4">
        <label class="text-body-2 text-medium-emphasis">
          {{ t('tools.pdf-watermark.opacity') }}: {{ opacity.toFixed(2) }}
        </label>
        <v-slider v-model="opacity" :min="0" :max="1" :step="0.05" hide-details density="compact" />
      </div>

      <div class="mt-2">
        <label class="text-body-2 text-medium-emphasis">
          {{ t('tools.pdf-watermark.rotation') }}: {{ rotation }}°
        </label>
        <v-slider v-model="rotation" :min="-180" :max="180" :step="1" hide-details density="compact" />
      </div>

      <div class="mt-4">
        <label class="text-body-2 text-medium-emphasis d-block mb-2">
          {{ t('tools.pdf-watermark.layout') }}
        </label>
        <v-btn-toggle v-model="layout" mandatory color="primary" density="comfortable" variant="outlined">
          <v-btn value="tile">{{ t('tools.pdf-watermark.tile') }}</v-btn>
          <v-btn value="center">{{ t('tools.pdf-watermark.center') }}</v-btn>
        </v-btn-toggle>
      </div>

      <v-btn
        class="mt-6"
        color="primary"
        :loading="busy"
        :disabled="!text"
        prepend-icon="mdi-watermark"
        @click="apply"
      >
        {{ busy ? t('tools.pdf-watermark.applying') : t('tools.pdf-watermark.apply') }}
      </v-btn>
    </template>
  </ToolShell>
</template>
