<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import JsBarcode from 'jsbarcode'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { useHistory } from '@/composables/useHistory'

const TOOL_ID = 'barcode-generate'
const { t } = useI18n()
const route = useRoute()

type Format = 'CODE128' | 'CODE39' | 'EAN13' | 'EAN8' | 'UPC' | 'ITF14' | 'MSI' | 'pharmacode'

interface SavedData {
  format: Format
  value: string
  barWidth: number
  height: number
  displayValue: boolean
}

const history = useHistory<SavedData>(TOOL_ID)

const format = ref<Format>('CODE128')
const value = ref('1234567890')
const barWidth = ref(2)
const height = ref(100)
const displayValue = ref(true)

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
      if (!error.value) error.value = t('tools.barcode-generate.invalidValue')
    } else {
      error.value = ''
    }
  })
}

function download() {
  const el = canvasRef.value
  if (!el || !valid.value) return
  const url = el.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = `barcode-${Date.now()}.png`
  a.click()
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
  save()
})

onMounted(() => {
  const h = route.query.h as string | undefined
  if (h) {
    const e = history.entries.value.find((x) => x.id === h)
    if (e) {
      const d = e.data
      format.value = d.format
      value.value = d.value
      barWidth.value = d.barWidth
      height.value = d.height
      displayValue.value = d.displayValue
    }
  }
  render()
})

const formatItems: Format[] = ['CODE128', 'CODE39', 'EAN13', 'EAN8', 'UPC', 'ITF14', 'MSI', 'pharmacode']
</script>

<template>
  <ToolShell>
    <v-row dense>
      <v-col cols="12" sm="5">
        <v-select
          v-model="format"
          :items="formatItems"
          :label="t('tools.barcode-generate.format')"
          density="comfortable"
        />
      </v-col>
      <v-col cols="12" sm="7">
        <v-text-field
          v-model="value"
          :label="t('tools.barcode-generate.value')"
          :error-messages="error"
          :hint="t('tools.barcode-generate.valueHint')"
          density="comfortable"
        />
      </v-col>
    </v-row>

    <v-divider class="my-3" />

    <div class="text-subtitle-2 mb-2">{{ t('tools.barcode-generate.options') }}</div>
    <v-row dense align="center">
      <v-col cols="6" sm="4">
        <v-text-field
          v-model.number="barWidth"
          type="number"
          min="1"
          max="6"
          :label="t('tools.barcode-generate.barWidth')"
          density="comfortable"
        />
      </v-col>
      <v-col cols="6" sm="4">
        <v-text-field
          v-model.number="height"
          type="number"
          min="10"
          max="300"
          :label="t('tools.barcode-generate.height')"
          density="comfortable"
        />
      </v-col>
      <v-col cols="12" sm="4">
        <v-checkbox
          v-model="displayValue"
          :label="t('tools.barcode-generate.displayValue')"
          hide-details
          density="compact"
        />
      </v-col>
    </v-row>

    <div class="d-flex justify-center my-4 barcode-wrap">
      <canvas v-show="valid" ref="canvasRef" class="barcode-canvas" />
      <div v-show="!valid" class="text-medium-emphasis pa-8">
        {{ error || t('tools.barcode-generate.valueHint') }}
      </div>
    </div>

    <div class="d-flex ga-2 flex-wrap justify-center">
      <v-btn color="primary" prepend-icon="mdi-download" :disabled="!valid" @click="download">
        {{ t('tools.barcode-generate.downloadPng') }}
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
