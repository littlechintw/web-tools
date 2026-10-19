<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import FileDrop from '@/components/FileDrop.vue'
import { useClipboard } from '@/composables/useClipboard'
import { oneOf, useStoredRef } from '@/composables/useStoredRef'
import { loadImage } from '@/utils/image'

const TOOL_ID = 'color-picker-image'
const { t } = useI18n()
const T = (key: string) => t(`tools.${TOOL_ID}.${key}`)
const { copy } = useClipboard()

interface PickedColor {
  hex: string
  rgb: string
}
type Zoom = 'fit' | 'actual'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const hasImage = ref(false)
const loadError = ref(false)
const hover = ref<PickedColor | null>(null)
const recent = ref<PickedColor[]>([])
// Fit the image to the panel width, or show it 1:1 (scrollable) for
// pixel-precise picking. Remembered between visits.
const zoom = useStoredRef<Zoom>('color-picker-image.zoom', 'fit', oneOf(['fit', 'actual']))

const snackbar = ref(false)
const snackText = ref('')

let objectUrl: string | null = null
let ctx: CanvasRenderingContext2D | null = null

function toHex(n: number): string {
  return n.toString(16).padStart(2, '0')
}

function readPixel(e: MouseEvent): PickedColor | null {
  const canvas = canvasRef.value
  if (!canvas || !ctx) return null
  const rect = canvas.getBoundingClientRect()
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width)
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height)
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null
  const d = ctx.getImageData(x, y, 1, 1).data
  return {
    hex: `#${toHex(d[0])}${toHex(d[1])}${toHex(d[2])}`.toUpperCase(),
    rgb: `rgb(${d[0]}, ${d[1]}, ${d[2]})`,
  }
}

function onMove(e: MouseEvent) {
  hover.value = readPixel(e)
}

function onClick(e: MouseEvent) {
  const c = readPixel(e)
  if (!c) return
  if (recent.value[0]?.hex !== c.hex) {
    recent.value.unshift(c)
    if (recent.value.length > 24) recent.value.pop()
  }
}

async function copyColor(text: string) {
  if (await copy(text)) {
    snackText.value = text
    snackbar.value = true
  }
}

async function onFiles(files: File[]) {
  const file = files[0]
  if (!file) return
  loadError.value = false
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = URL.createObjectURL(file)
  let img: HTMLImageElement
  try {
    img = await loadImage(objectUrl)
  } catch {
    loadError.value = true
    return
  }
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx?.drawImage(img, 0, 0)
  hasImage.value = true
  hover.value = null
}

function clearRecent() {
  recent.value = []
}

onUnmounted(() => {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
})
</script>

<template>
  <ToolShell>
    <FileDrop accept="image/*" :hint="T('uploadHint')" :class="{ 'mb-4': hasImage }" @files="onFiles" />
    <v-alert v-if="loadError" type="error" variant="tonal" density="compact" class="mt-2">
      {{ t('common.error') }}
    </v-alert>

    <div v-show="hasImage">
      <div class="d-flex align-center justify-space-between flex-wrap ga-2 mb-2">
        <p class="text-medium-emphasis text-body-2 mb-0">{{ T('clickHint') }}</p>
        <v-btn-toggle v-model="zoom" mandatory density="compact" variant="outlined" color="primary" divided>
          <v-btn value="fit" size="small" prepend-icon="mdi-fit-to-screen-outline">{{ T('zoomFit') }}</v-btn>
          <v-btn value="actual" size="small" prepend-icon="mdi-image-size-select-actual">{{ T('zoomActual') }}</v-btn>
        </v-btn-toggle>
      </div>
      <div class="canvas-wrap rounded-lg">
        <canvas
          ref="canvasRef"
          class="canvas-el"
          :class="{ 'canvas-el--fit': zoom === 'fit' }"
          @pointermove="onMove"
          @click="onClick"
        />
      </div>

      <v-card v-if="hover" variant="tonal" rounded="lg" class="mt-3">
        <v-card-text class="d-flex align-center ga-4">
          <div class="swatch" :style="{ background: hover.hex }" />
          <div>
            <div class="text-caption text-medium-emphasis">{{ T('hover') }}</div>
            <div class="d-flex align-center flex-wrap ga-3 mt-1">
              <code class="font-mono">{{ hover.hex }}</code>
              <CopyBtn :text="hover.hex" icon size="small" />
              <code class="font-mono">{{ hover.rgb }}</code>
              <CopyBtn :text="hover.rgb" icon size="small" />
            </div>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <template v-if="hasImage">
      <div class="d-flex align-center justify-space-between mt-5 mb-2">
        <h3 class="text-subtitle-1 font-weight-medium">{{ T('recent') }}</h3>
        <v-btn v-if="recent.length" variant="text" size="small" prepend-icon="mdi-delete-outline" @click="clearRecent">
          {{ T('clear') }}
        </v-btn>
      </div>
      <p v-if="!recent.length" class="text-medium-emphasis text-body-2">
        {{ T('empty') }}
      </p>
      <div class="d-flex flex-wrap ga-2">
        <v-chip
          v-for="(c, i) in recent"
          :key="i"
          variant="outlined"
          :title="`${c.rgb} · ${t('common.copy')}`"
          @click="copyColor(c.hex)"
        >
          <span class="chip-swatch" :style="{ background: c.hex }" />
          <span class="font-mono">{{ c.hex }}</span>
        </v-chip>
      </div>
    </template>

    <v-snackbar v-model="snackbar" :timeout="1500" color="success" variant="tonal">
      <v-icon icon="mdi-check" size="18" class="mr-2" />{{ t('common.copied') }}
      <code class="font-mono ml-2">{{ snackText }}</code>
    </v-snackbar>
  </ToolShell>
</template>

<style scoped>
.canvas-wrap {
  max-width: 100%;
  max-height: 70vh;
  overflow: auto;
  border: 1px solid rgba(var(--v-border-color), 0.3);
}
.canvas-el {
  display: block;
  cursor: crosshair;
}
.canvas-el--fit {
  max-width: 100%;
  height: auto;
}
.swatch {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  border: 1px solid rgba(var(--v-border-color), 0.4);
  flex: none;
}
.chip-swatch {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  margin-right: 6px;
  border: 1px solid rgba(var(--v-border-color), 0.4);
  display: inline-block;
}
</style>
