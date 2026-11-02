<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import OutputPanel from '@/components/OutputPanel.vue'
import { oneOf, useStoredRef } from '@/composables/useStoredRef'
import { backgroundDeclaration, gradientCss, shadowCss, shadowDeclaration, type ColorStop, type GradientKind, type ShadowLayer } from '@/lib/cssGen'

const { t } = useI18n()
const TABS = ['gradient', 'shadow'] as const
const KINDS = ['linear', 'radial', 'conic'] as const
const tab = useStoredRef<(typeof TABS)[number]>('css-generator.tab', 'gradient', oneOf(TABS))
const kind = useStoredRef<GradientKind>('css-generator.kind', 'linear', oneOf(KINDS))

const angle = ref(90)
const shape = ref<'circle' | 'ellipse'>('circle')
const cx = ref(50)
const cy = ref(50)
const stops = ref<ColorStop[]>([
  { color: '#6750a4', alpha: 1, pos: 0 },
  { color: '#ff8a65', alpha: 1, pos: 100 },
])
const layers = ref<ShadowLayer[]>([
  { x: 0, y: 8, blur: 24, spread: 0, color: '#000000', alpha: 0.25, inset: false },
])

const gradient = computed(() => ({ kind: kind.value, angle: angle.value, shape: shape.value, cx: cx.value, cy: cy.value, stops: stops.value }))
const gradientValue = computed(() => gradientCss(gradient.value))
const gradientDecl = computed(() => backgroundDeclaration(gradient.value))
const shadowDecl = computed(() => shadowDeclaration(layers.value))
const output = computed(() => (tab.value === 'gradient' ? gradientDecl.value : shadowDecl.value))
const showAngle = computed(() => kind.value !== 'radial')

function addStop() {
  if (stops.value.length >= 12) return
  stops.value.push({ color: '#ffffff', alpha: 1, pos: 50 })
}
function removeStop(i: number) {
  if (stops.value.length > 2) stops.value.splice(i, 1)
}
function moveStop(i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= stops.value.length) return
  const arr = stops.value
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}
function addLayer() {
  if (layers.value.length >= 8) return
  layers.value.push({ x: 0, y: 2, blur: 6, spread: 0, color: '#000000', alpha: 0.2, inset: false })
}
function removeLayer(i: number) {
  layers.value.splice(i, 1)
}
function moveLayer(i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= layers.value.length) return
  const arr = layers.value
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
}
function toNum(v: string | number, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
const kindItems = computed(() => KINDS.map((k) => ({ title: t(`tools.css-generator.kind_${k}`), value: k })))
const shapeItems = computed(() => (['circle', 'ellipse'] as const).map((k) => ({ title: t(`tools.css-generator.shape_${k}`), value: k })))
</script>

<template>
  <ToolShell max-width="900">
    <v-tabs v-model="tab" density="comfortable">
      <v-tab value="gradient">{{ t('tools.css-generator.tabGradient') }}</v-tab>
      <v-tab value="shadow">{{ t('tools.css-generator.tabShadow') }}</v-tab>
    </v-tabs>

    <div
      class="preview rounded-lg mt-4"
      :class="{ 'preview-shadow': tab === 'shadow' }"
      :style="tab === 'gradient' ? { background: gradientValue } : { boxShadow: shadowCss(layers) }"
      role="img"
      :aria-label="t('tools.css-generator.preview')"
    />

    <div v-if="tab === 'gradient'" class="mt-4">
      <v-row density="comfortable">
        <v-col cols="12" sm="6">
          <v-select v-model="kind" :items="kindItems" :label="t('tools.css-generator.type')" hide-details />
        </v-col>
        <v-col v-if="kind === 'radial'" cols="12" sm="6">
          <v-select v-model="shape" :items="shapeItems" :label="t('tools.css-generator.shape')" hide-details />
        </v-col>
        <v-col v-if="showAngle" cols="12" sm="6">
          <v-slider v-model="angle" :min="0" :max="360" :step="1" :label="t('tools.css-generator.angle')" thumb-label hide-details>
            <template #append>
              <span class="tabular-nums text-body-2">{{ angle }}°</span>
            </template>
          </v-slider>
        </v-col>
        <template v-if="kind !== 'linear'">
          <v-col cols="6" sm="3">
            <v-text-field :model-value="cx" type="number" suffix="%" :label="t('tools.css-generator.centerX')" hide-details class="tabular-nums" @update:model-value="cx = toNum($event, 50)" />
          </v-col>
          <v-col cols="6" sm="3">
            <v-text-field :model-value="cy" type="number" suffix="%" :label="t('tools.css-generator.centerY')" hide-details class="tabular-nums" @update:model-value="cy = toNum($event, 50)" />
          </v-col>
        </template>
      </v-row>

      <div class="text-subtitle-2 mt-4 mb-1">{{ t('tools.css-generator.stops') }}</div>
      <v-card v-for="(s, i) in stops" :key="i" variant="outlined" class="pa-3 mb-2">
        <div class="d-flex align-center flex-wrap ga-3">
          <input v-model="s.color" type="color" class="swatch" :aria-label="t('tools.css-generator.color')" />
          <v-text-field :model-value="s.pos" type="number" min="0" max="100" suffix="%" :label="t('tools.css-generator.position')" hide-details density="compact" class="tabular-nums num-field" @update:model-value="s.pos = Math.min(100, Math.max(0, toNum($event)))" />
          <v-text-field :model-value="s.alpha" type="number" min="0" max="1" step="0.05" :label="t('tools.css-generator.alpha')" hide-details density="compact" class="tabular-nums num-field" @update:model-value="s.alpha = Math.min(1, Math.max(0, toNum($event, 1)))" />
          <v-spacer />
          <v-btn icon="mdi-arrow-up" size="small" variant="text" :disabled="i === 0" :title="t('tools.css-generator.moveUp')" :aria-label="t('tools.css-generator.moveUp')" @click="moveStop(i, -1)" />
          <v-btn icon="mdi-arrow-down" size="small" variant="text" :disabled="i === stops.length - 1" :title="t('tools.css-generator.moveDown')" :aria-label="t('tools.css-generator.moveDown')" @click="moveStop(i, 1)" />
          <v-btn icon="mdi-delete-outline" size="small" variant="text" :disabled="stops.length <= 2" :title="t('tools.css-generator.remove')" :aria-label="t('tools.css-generator.remove')" @click="removeStop(i)" />
        </div>
      </v-card>
      <v-btn prepend-icon="mdi-plus" variant="tonal" :disabled="stops.length >= 12" @click="addStop">{{ t('tools.css-generator.addStop') }}</v-btn>
    </div>

    <div v-else class="mt-4">
      <v-card v-for="(l, i) in layers" :key="i" variant="outlined" class="pa-3 mb-2">
        <div class="d-flex align-center ga-2 mb-2">
          <span class="text-subtitle-2">{{ t('tools.css-generator.layer', { n: i + 1 }) }}</span>
          <v-spacer />
          <v-btn icon="mdi-arrow-up" size="small" variant="text" :disabled="i === 0" :title="t('tools.css-generator.moveUp')" :aria-label="t('tools.css-generator.moveUp')" @click="moveLayer(i, -1)" />
          <v-btn icon="mdi-arrow-down" size="small" variant="text" :disabled="i === layers.length - 1" :title="t('tools.css-generator.moveDown')" :aria-label="t('tools.css-generator.moveDown')" @click="moveLayer(i, 1)" />
          <v-btn icon="mdi-delete-outline" size="small" variant="text" :title="t('tools.css-generator.remove')" :aria-label="t('tools.css-generator.remove')" @click="removeLayer(i)" />
        </div>
        <v-row density="comfortable" align="center">
          <v-col cols="6" sm="3"><v-text-field :model-value="l.x" type="number" suffix="px" :label="t('tools.css-generator.offsetX')" hide-details density="compact" class="tabular-nums" @update:model-value="l.x = toNum($event)" /></v-col>
          <v-col cols="6" sm="3"><v-text-field :model-value="l.y" type="number" suffix="px" :label="t('tools.css-generator.offsetY')" hide-details density="compact" class="tabular-nums" @update:model-value="l.y = toNum($event)" /></v-col>
          <v-col cols="6" sm="3"><v-text-field :model-value="l.blur" type="number" min="0" suffix="px" :label="t('tools.css-generator.blur')" hide-details density="compact" class="tabular-nums" @update:model-value="l.blur = Math.max(0, toNum($event))" /></v-col>
          <v-col cols="6" sm="3"><v-text-field :model-value="l.spread" type="number" suffix="px" :label="t('tools.css-generator.spread')" hide-details density="compact" class="tabular-nums" @update:model-value="l.spread = toNum($event)" /></v-col>
          <v-col cols="4" sm="2"><input v-model="l.color" type="color" class="swatch" :aria-label="t('tools.css-generator.color')" /></v-col>
          <v-col cols="8" sm="4"><v-text-field :model-value="l.alpha" type="number" min="0" max="1" step="0.05" :label="t('tools.css-generator.alpha')" hide-details density="compact" class="tabular-nums" @update:model-value="l.alpha = Math.min(1, Math.max(0, toNum($event, 1)))" /></v-col>
          <v-col cols="12" sm="6"><v-switch v-model="l.inset" :label="t('tools.css-generator.inset')" density="compact" hide-details color="primary" /></v-col>
        </v-row>
      </v-card>
      <v-btn prepend-icon="mdi-plus" variant="tonal" :disabled="layers.length >= 8" @click="addLayer">{{ t('tools.css-generator.addLayer') }}</v-btn>
    </div>

    <OutputPanel class="mt-4" :label="t('tools.css-generator.css')" :value="output" filename="style.css" hide-count />
  </ToolShell>
</template>

<style scoped>
.preview { height: 180px; border: 1px solid rgba(128, 128, 128, 0.25); }
.preview-shadow { width: 60%; max-width: 260px; margin-inline: auto; background: rgb(var(--v-theme-surface)); height: 140px; }
.swatch { width: 40px; height: 36px; padding: 0; border: 0; background: none; cursor: pointer; }
.num-field { max-width: 120px; }
</style>
