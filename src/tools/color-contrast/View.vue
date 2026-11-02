<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { contrastRatio, parseColor, suggestForeground, toHex, wcagResults } from '@/lib/colorContrast'

const { t } = useI18n()
const fgText = ref('#767676')
const bgText = ref('#ffffff')

const fg = computed(() => parseColor(fgText.value))
const bg = computed(() => parseColor(bgText.value))
const ratio = computed(() => (fg.value && bg.value ? contrastRatio(fg.value, bg.value) : null))
const results = computed(() => (ratio.value === null ? null : wcagResults(ratio.value)))
// Truncate (not round) so 4.499 never displays as a misleading pass.
const ratioText = computed(() => (ratio.value === null ? '—' : (Math.floor(ratio.value * 100) / 100).toFixed(2)))

const checks = computed(() => {
  const r = results.value
  if (!r) return []
  return [
    { key: 'normal', aa: r.aaNormal, aaa: r.aaaNormal },
    { key: 'large', aa: r.aaLarge, aaa: r.aaaLarge },
    { key: 'ui', aa: r.ui, aaa: null as boolean | null },
  ]
})

const suggestion = computed(() => {
  if (!fg.value || !bg.value || results.value?.aaNormal) return null
  const s = suggestForeground(fg.value, bg.value, 4.5)
  return s ? toHex(s) : null
})

const fgHex = computed(() => (fg.value ? toHex(fg.value) : '#000000'))
const bgHex = computed(() => (bg.value ? toHex(bg.value) : '#ffffff'))

function swap() {
  const a = fgText.value
  fgText.value = bgText.value
  bgText.value = a
}
</script>

<template>
  <ToolShell max-width="800">
    <v-row density="comfortable" align="center">
      <v-col cols="12" sm="5">
        <v-text-field
          v-model="fgText"
          :label="t('tools.color-contrast.foreground')"
          :error="!fg"
          :error-messages="fg ? [] : [t('tools.color-contrast.invalid')]"
          class="code-area"
          hide-details="auto"
        >
          <template #prepend-inner>
            <input
              type="color"
              :value="fgHex"
              :aria-label="t('tools.color-contrast.foreground')"
              class="swatch"
              @input="fgText = ($event.target as HTMLInputElement).value"
            />
          </template>
        </v-text-field>
      </v-col>
      <v-col cols="12" sm="2" class="text-center">
        <v-btn icon="mdi-swap-horizontal" variant="tonal" :title="t('common.swap')" :aria-label="t('common.swap')" @click="swap" />
      </v-col>
      <v-col cols="12" sm="5">
        <v-text-field
          v-model="bgText"
          :label="t('tools.color-contrast.background')"
          :error="!bg"
          :error-messages="bg ? [] : [t('tools.color-contrast.invalid')]"
          class="code-area"
          hide-details="auto"
        >
          <template #prepend-inner>
            <input
              type="color"
              :value="bgHex"
              :aria-label="t('tools.color-contrast.background')"
              class="swatch"
              @input="bgText = ($event.target as HTMLInputElement).value"
            />
          </template>
        </v-text-field>
      </v-col>
    </v-row>
    <div class="text-caption text-medium-emphasis mt-1">{{ t('tools.color-contrast.formats') }}</div>

    <v-card variant="tonal" class="mt-4 pa-4">
      <div class="d-flex align-center ga-3">
        <div class="text-h4 font-mono tabular-nums">{{ ratioText }} : 1</div>
        <CopyBtn :text="ratio === null ? '' : ratioText" icon />
      </div>

      <v-table v-if="results" density="compact" class="mt-3 bg-transparent">
        <thead>
          <tr>
            <th />
            <th class="text-center">AA</th>
            <th class="text-center">AAA</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in checks" :key="c.key">
            <td>{{ t(`tools.color-contrast.check_${c.key}`) }}</td>
            <td class="text-center">
              <v-chip :color="c.aa ? 'success' : 'error'" size="small" label>{{ c.aa ? t('tools.color-contrast.pass') : t('tools.color-contrast.fail') }}</v-chip>
            </td>
            <td class="text-center">
              <v-chip v-if="c.aaa !== null" :color="c.aaa ? 'success' : 'error'" size="small" label>{{ c.aaa ? t('tools.color-contrast.pass') : t('tools.color-contrast.fail') }}</v-chip>
              <span v-else class="text-medium-emphasis">—</span>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <div
      class="preview rounded mt-4 pa-4"
      :style="{ color: fgHex, backgroundColor: bgHex }"
    >
      <div class="preview-large">{{ t('tools.color-contrast.sampleLarge') }}</div>
      <div>{{ t('tools.color-contrast.sampleText') }}</div>
      <v-btn variant="outlined" size="small" class="mt-2 preview-btn" :style="{ color: fgHex, borderColor: fgHex }" tabindex="-1">
        {{ t('tools.color-contrast.sampleButton') }}
      </v-btn>
    </div>

    <v-alert v-if="suggestion" type="info" variant="tonal" density="compact" class="mt-4">
      <div class="d-flex align-center flex-wrap ga-3">
        <span>{{ t('tools.color-contrast.suggest') }}</span>
        <span class="chip-swatch rounded" :style="{ backgroundColor: suggestion }" />
        <code class="font-mono">{{ suggestion }}</code>
        <v-btn size="small" variant="tonal" @click="fgText = suggestion">{{ t('tools.color-contrast.apply') }}</v-btn>
      </div>
    </v-alert>
    <v-alert v-else-if="results && !results.aaNormal" type="warning" variant="tonal" density="compact" class="mt-4">
      {{ t('tools.color-contrast.noSuggestion') }}
    </v-alert>
  </ToolShell>
</template>

<style scoped>
.swatch { width: 28px; height: 28px; padding: 0; border: 0; background: none; cursor: pointer; }
.preview { border: 1px solid rgba(128, 128, 128, 0.4); }
.preview-large { font-size: 1.5rem; font-weight: 700; }
.chip-swatch { display: inline-block; width: 24px; height: 24px; border: 1px solid rgba(128, 128, 128, 0.5); }
</style>
