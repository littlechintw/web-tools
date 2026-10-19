<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import JsBarcode from 'jsbarcode'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { useHistory } from '@/composables/useHistory'
import { isBoolean, isNumber, oneOf, useStoredRef } from '@/composables/useStoredRef'
import { downloadUrl } from '@/utils/download'

const TOOL_ID = 'barcode-generate'
const { t } = useI18n()
const T = (key: string) => t(`tools.${TOOL_ID}.${key}`)

const FORMATS = ['CODE128', 'CODE39', 'EAN13', 'EAN8', 'UPC', 'ITF14', 'MSI', 'pharmacode'] as const
type Format = (typeof FORMATS)[number]

interface SavedData {
  format: Format
  value: string
  barWidth: number
  height: number
  displayValue: boolean
}

const history = useHistory<SavedData>(TOOL_ID)

// Appearance options are remembered between visits; the value is not.
const format = useStoredRef<Format>('barcode-generate.format', 'CODE128', oneOf(FORMATS))
const value = ref('1234567890')
const barWidth = useStoredRef('barcode-generate.barWidth', 2, isNumber)
const height = useStoredRef('barcode-generate.height', 100, isNumber)
const displayValue = useStoredRef('barcode-generate.displayValue', true, isBoolean)

const canvasRef = ref<HTMLCanvasElement>()
const error = ref('')
const valid = ref(false)

function render() {
  void nextTick().then(() => {
    const el = canvasRef.value
    if (!el) return
    const ctx = el.getContext('2d')
    if (!value.value) {
      ctx?.clearRect(0, 0, el.width, el.height)
      error.value = ''
      valid.value = false
      return
    }
    error.value = ''
    let ok = false
    try {
      JsBarcode(el, value.value, {
        format: format.value,
        width: Math.max(1, Math.trunc(barWidth.value) || 1),
        height: Math.max(10, Math.trunc(height.value) || 10),
        displayValue: displayValue.value,
        margin: 10,
        valid: (isValid: boolean) => {
          ok = isValid
        },
      })
    } catch (e) {
      ok = false
      error.value = e instanceof Error ? e.message : String(e)
    }
    valid.value = ok
    if (!ok) {
      // JsBarcode leaves the canvas untouched on invalid input; clear it.
      const c = canvasRef.value
      c?.getContext('2d')?.clearRect(0, 0, c.width, c.height)
      if (!error.value) error.value = T('invalidValue')
    } else {
      error.value = ''
      // save only after validation, so history never records invalid values
      save()
    }
  })
}

function download() {
  const el = canvasRef.value
  if (!el || !valid.value) return
  const slug = value.value.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  downloadUrl(el.toDataURL('image/png'), `barcode-${format.value}${slug ? `-${slug}` : ''}.png`)
}

function save() {
  if (!valid.value) return
  history.save(`${format.value}: ${value.value.slice(0, 40)}`, {
    format: format.value,
    value: value.value,
    barWidth: barWidth.value,
    height: height.value,
    displayValue: displayValue.value,
  })
}

watch([format, value, barWidth, height, displayValue], () => {
  render()
})

history.restoreFromRoute((d) => {
  format.value = d.format
  value.value = d.value
  barWidth.value = d.barWidth
  height.value = d.height
  displayValue.value = d.displayValue
})

onMounted(() => render())

const formatItems = [...FORMATS]
</script>

<template>
  <ToolShell>
    <v-row density="comfortable">
      <v-col cols="12" sm="5">
        <v-select v-model="format" :items="formatItems" :label="T('format')" density="comfortable" />
      </v-col>
      <v-col cols="12" sm="7">
        <v-text-field
          v-model="value"
          :label="T('value')"
          :error-messages="error"
          :hint="T('valueHint')"
          density="comfortable"
          class="code-area"
        />
      </v-col>
    </v-row>

    <v-divider class="my-3" />

    <div class="text-subtitle-2 mb-2">{{ T('options') }}</div>
    <v-row density="comfortable" align="center">
      <v-col cols="6" sm="4">
        <v-text-field
          v-model.number="barWidth"
          type="number"
          min="1"
          max="6"
          :label="T('barWidth')"
          density="comfortable"
          hide-details
        />
      </v-col>
      <v-col cols="6" sm="4">
        <v-text-field
          v-model.number="height"
          type="number"
          min="10"
          max="300"
          :label="T('height')"
          density="comfortable"
          hide-details
        />
      </v-col>
      <v-col cols="12" sm="4">
        <v-checkbox v-model="displayValue" :label="T('displayValue')" hide-details density="compact" />
      </v-col>
    </v-row>

    <div class="d-flex justify-center my-4 barcode-wrap">
      <canvas v-show="valid" ref="canvasRef" class="barcode-canvas" />
      <div v-show="!valid" class="text-medium-emphasis pa-8">
        {{ error || T('valueHint') }}
      </div>
    </div>

    <div class="d-flex ga-2 flex-wrap justify-center">
      <v-btn color="primary" prepend-icon="mdi-download" :disabled="!valid" @click="download">
        {{ T('downloadPng') }}
      </v-btn>
      <CopyBtn :text="value" />
    </div>
  </ToolShell>
</template>

<style scoped>
.barcode-wrap {
  overflow-x: auto;
}
.barcode-canvas {
  max-width: 100%;
  background: #fff;
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.15);
}
</style>
