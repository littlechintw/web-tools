<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import FileDrop from '@/components/FileDrop.vue'
import { useClipboard } from '@/composables/useClipboard'

const { t } = useI18n()
const { copy } = useClipboard()

interface PickedColor {
  hex: string
  rgb: string
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
const hasImage = ref(false)
const hover = ref<PickedColor | null>(null)
const recent = ref<PickedColor[]>([])

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

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('load'))
    img.src = url
  })
}

async function onFiles(files: File[]) {
  const file = files[0]
  if (!file) return
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = URL.createObjectURL(file)
  const img = await loadImage(objectUrl)
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
    <FileDrop
      v-if="!hasImage"
      accept="image/*"
      :hint="t('tools.color-picker-image.uploadHint')"
      @files="onFiles"
    />

    <div v-show="hasImage">
      <p class="text-medium-emphasis text-body-2 mb-2">
        {{ t('tools.color-picker-image.clickHint') }}
      </p>
      <div class="canvas-wrap rounded-lg">
        <canvas
          ref="canvasRef"
          class="canvas-el"
          @mousemove="onMove"
          @click="onClick"
        />
      </div>

      <v-card v-if="hover" variant="tonal" class="mt-3">
        <v-card-text class="d-flex align-center ga-4">
          <div class="swatch" :style="{ background: hover.hex }" />
          <div>
            <div class="text-caption text-medium-emphasis">{{ t('tools.color-picker-image.hover') }}</div>
            <div class="d-flex align-center ga-3 mt-1">
              <code class="mono">{{ hover.hex }}</code>
              <CopyBtn :text="hover.hex" icon size="small" />
              <code class="mono">{{ hover.rgb }}</code>
              <CopyBtn :text="hover.rgb" icon size="small" />
            </div>
          </div>
        </v-card-text>
      </v-card>
    </div>

    <template v-if="hasImage">
      <div class="d-flex align-center justify-space-between mt-5 mb-2">
        <h3 class="text-subtitle-1 font-weight-medium">{{ t('tools.color-picker-image.recent') }}</h3>
        <v-btn
          v-if="recent.length"
          variant="text"
          size="small"
          prepend-icon="mdi-delete-outline"
          @click="clearRecent"
        >
          {{ t('tools.color-picker-image.clear') }}
        </v-btn>
      </div>
      <p v-if="!recent.length" class="text-medium-emphasis text-body-2">
        {{ t('tools.color-picker-image.empty') }}
      </p>
      <div class="d-flex flex-wrap ga-2">
        <v-chip
          v-for="(c, i) in recent"
          :key="i"
          variant="outlined"
          :title="c.rgb"
          @click="copy(c.hex)"
        >
          <span class="chip-swatch" :style="{ background: c.hex }" />
          <span class="mono">{{ c.hex }}</span>
        </v-chip>
      </div>
    </template>
  </ToolShell>
</template>

<style scoped>
.canvas-wrap {
  max-width: 100%;
  overflow: auto;
  border: 1px solid rgba(var(--v-border-color), 0.3);
}
.canvas-el {
  display: block;
  max-width: 100%;
  height: auto;
  cursor: crosshair;
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
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}
</style>
