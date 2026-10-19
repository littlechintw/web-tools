<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import PasteBtn from '@/components/PasteBtn.vue'
import { useClipboard } from '@/composables/useClipboard'
import { useHistory } from '@/composables/useHistory'

const TOOL_ID = 'color-convert'
const { t } = useI18n()
const { copy } = useClipboard()

const history = useHistory<{ input: string }>(TOOL_ID)

interface RGB {
  r: number
  g: number
  b: number
}
interface HSL {
  h: number
  s: number
  l: number
}

const input = ref('#3b82f6')
const error = ref('')

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function parseColor(raw: string): RGB | null {
  const str = raw.trim().toLowerCase()
  if (!str) return null

  // HEX
  let m = str.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (m) {
    let hex = m[1]
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    }
  }

  // rgb()
  m = str.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/)
  if (m) {
    return {
      r: clamp(Math.round(parseFloat(m[1])), 0, 255),
      g: clamp(Math.round(parseFloat(m[2])), 0, 255),
      b: clamp(Math.round(parseFloat(m[3])), 0, 255),
    }
  }

  // hsl()
  m = str.match(/^hsla?\(\s*([\d.]+)[ ,]+([\d.]+)%?[ ,]+([\d.]+)%?/)
  if (m) {
    return hslToRgb({
      h: parseFloat(m[1]),
      s: clamp(parseFloat(m[2]), 0, 100),
      l: clamp(parseFloat(m[3]), 0, 100),
    })
  }

  return null
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hslToRgb({ h, s, l }: HSL): RGB {
  h = ((h % 360) + 360) % 360
  const sn = s / 100
  const ln = l / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = ln - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/** WCAG 2.x relative luminance (0 = black, 1 = white). */
function luminance({ r, g, b }: RGB): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastRatio(l1: number, l2: number): number {
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

type WcagLevel = 'levelAaa' | 'levelAa' | 'levelAaLarge' | 'levelFail'

function wcagLevel(ratio: number): WcagLevel {
  if (ratio >= 7) return 'levelAaa'
  if (ratio >= 4.5) return 'levelAa'
  if (ratio >= 3) return 'levelAaLarge'
  return 'levelFail'
}

const LEVEL_COLOR: Record<WcagLevel, string> = {
  levelAaa: 'success',
  levelAa: 'success',
  levelAaLarge: 'warning',
  levelFail: 'error',
}

const rgb = computed<RGB | null>(() => {
  error.value = ''
  const c = parseColor(input.value)
  if (!c) {
    if (input.value.trim()) error.value = t('tools.color-convert.invalid')
    return null
  }
  return c
})

const hexStr = computed(() => (rgb.value ? toHex(rgb.value) : ''))
const rgbStr = computed(() => (rgb.value ? `rgb(${rgb.value.r}, ${rgb.value.g}, ${rgb.value.b})` : ''))
const hslObj = computed(() => (rgb.value ? rgbToHsl(rgb.value) : null))
const hslStr = computed(() =>
  hslObj.value ? `hsl(${hslObj.value.h}, ${hslObj.value.s}%, ${hslObj.value.l}%)` : '',
)

// native color input binds to hex; only valid full hex
const pickerValue = computed({
  get: () => hexStr.value || '#000000',
  set: (v: string) => {
    input.value = v
  },
})

interface Swatch {
  hex: string
  /** Black or white, whichever reads better on this swatch. */
  onColor: string
}

const palette = computed<Swatch[]>(() => {
  if (!hslObj.value) return []
  const { h, s } = hslObj.value
  const steps = [90, 80, 70, 60, 50, 40, 30, 20, 10]
  return steps.map((l) => {
    const c = hslToRgb({ h, s, l })
    return { hex: toHex(c), onColor: luminance(c) > 0.179 ? '#000000' : '#ffffff' }
  })
})

const rows = computed(() => [
  { label: 'HEX', value: hexStr.value },
  { label: 'RGB', value: rgbStr.value },
  { label: 'HSL', value: hslStr.value },
])

const contrast = computed(() => {
  if (!rgb.value) return []
  const lum = luminance(rgb.value)
  return [
    { key: 'onWhite', bg: '#ffffff', ratio: contrastRatio(lum, 1) },
    { key: 'onBlack', bg: '#000000', ratio: contrastRatio(lum, 0) },
  ].map((c) => ({
    ...c,
    label: t(`tools.color-convert.${c.key}`),
    text: `${c.ratio.toFixed(2)} : 1`,
    level: wcagLevel(c.ratio),
  }))
})

// Click-to-copy feedback for the palette: a check mark on the swatch plus a snackbar.
const snackbar = ref(false)
const copiedSwatch = ref('')
let swatchTimer: ReturnType<typeof setTimeout> | undefined

async function copySwatch(hex: string) {
  if (!(await copy(hex))) return
  copiedSwatch.value = hex
  snackbar.value = true
  clearTimeout(swatchTimer)
  swatchTimer = setTimeout(() => (copiedSwatch.value = ''), 1500)
}

function save() {
  if (!rgb.value) return
  history.save(hexStr.value, { input: input.value })
}

watch(input, () => save())

history.restoreFromRoute((d) => {
  input.value = d.input
})
</script>

<template>
  <ToolShell>
    <div class="d-flex flex-wrap align-center ga-4">
      <v-text-field
        v-model="input"
        :label="t('tools.color-convert.inputColor')"
        :error-messages="error"
        clearable
        hide-details="auto"
        class="code-area"
        style="min-width: 260px"
      />
      <input
        type="color"
        :value="pickerValue"
        :title="t('tools.color-convert.picker')"
        :aria-label="t('tools.color-convert.picker')"
        class="native-color"
        @input="pickerValue = ($event.target as HTMLInputElement).value"
      />
    </div>
    <div class="d-flex flex-wrap align-center ga-2 mt-2 mb-4">
      <PasteBtn @paste="input = $event" />
    </div>

    <div v-if="rgb" class="d-flex flex-wrap ga-4 align-stretch">
      <div
        class="swatch-big rounded-lg"
        :style="{ backgroundColor: hexStr }"
        :title="t('tools.color-convert.preview')"
      />
      <div class="flex-grow-1">
        <v-list bg-color="transparent">
          <v-list-item v-for="row in rows" :key="row.label" class="px-0">
            <template #title>
              <span class="text-caption text-medium-emphasis">{{ row.label }}</span>
            </template>
            <template #subtitle>
              <span class="font-mono text-body-1">{{ row.value }}</span>
            </template>
            <template #append>
              <CopyBtn :text="row.value" icon />
            </template>
          </v-list-item>
        </v-list>
      </div>
    </div>

    <div v-if="contrast.length" class="mt-4">
      <div class="text-caption text-medium-emphasis mb-2">
        {{ t('tools.color-convert.contrast') }}
      </div>
      <div class="d-flex flex-wrap ga-3">
        <div v-for="c in contrast" :key="c.key" class="d-flex align-center ga-3 rounded-lg border pa-2 pr-4">
          <div class="contrast-sample rounded" :style="{ backgroundColor: c.bg, color: hexStr }">Aa</div>
          <div>
            <div class="text-caption text-medium-emphasis">{{ c.label }}</div>
            <div class="d-flex align-center ga-2">
              <span class="font-mono tabular-nums">{{ c.text }}</span>
              <v-chip size="x-small" :color="LEVEL_COLOR[c.level]" variant="tonal" label>
                {{ t('tools.color-convert.' + c.level) }}
              </v-chip>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="palette.length" class="mt-4">
      <div class="text-caption text-medium-emphasis mb-2">
        {{ t('tools.color-convert.tintsShades') }}
      </div>
      <div class="d-flex flex-wrap ga-1">
        <button
          v-for="c in palette"
          :key="c.hex"
          type="button"
          class="swatch rounded d-flex align-center justify-center"
          :style="{ backgroundColor: c.hex }"
          :title="`${c.hex} — ${t('tools.color-convert.clickToCopy')}`"
          :aria-label="`${c.hex} — ${t('tools.color-convert.clickToCopy')}`"
          @click="copySwatch(c.hex)"
        >
          <v-icon v-if="copiedSwatch === c.hex" icon="mdi-check" size="small" :style="{ color: c.onColor }" />
        </button>
      </div>
    </div>

    <v-snackbar v-model="snackbar" :timeout="1500" location="bottom">
      {{ t('common.copied') }}
    </v-snackbar>
  </ToolShell>
</template>

<style scoped>
.native-color {
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 8px;
  background: none;
  cursor: pointer;
  padding: 0;
}
.swatch-big {
  width: 120px;
  height: 120px;
  border: 1px solid rgba(var(--v-border-color), 0.3);
}
.swatch {
  width: 56px;
  height: 48px;
  border: 1px solid rgba(var(--v-border-color), 0.3);
  cursor: pointer;
  padding: 0;
}
.contrast-sample {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  border: 1px solid rgba(var(--v-border-color), 0.3);
}
</style>
