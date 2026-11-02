<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import { oneOf, useStoredRef } from '@/composables/useStoredRef'
import {
  ACTIVITY_LEVELS, BMI_BOUNDS, LB_TO_KG, bmi, bmiCategory, bmr, calorieGoals, healthyWeightRange, imperialToMetric, tdee,
  type BmiCategory, type Sex,
} from '@/lib/bmi'

const { t, locale } = useI18n()
const K = (k: string) => t(`tools.bmi-calc.${k}`)

const UNITS = ['metric', 'imperial'] as const
const STANDARDS = ['tw', 'who'] as const
const FORMULAS = ['mifflin', 'harris'] as const
const ACTIVITY_KEYS = ['0', '1', '2', '3', '4'] as const

// Options are remembered; body measurements, age and sex are never persisted.
const units = useStoredRef<(typeof UNITS)[number]>('bmi-calc.units', 'metric', oneOf(UNITS))
const standard = useStoredRef<(typeof STANDARDS)[number]>('bmi-calc.standard', 'tw', oneOf(STANDARDS))
const formula = useStoredRef<(typeof FORMULAS)[number]>('bmi-calc.formula', 'mifflin', oneOf(FORMULAS))
const activityKey = useStoredRef<(typeof ACTIVITY_KEYS)[number]>('bmi-calc.activity', '1', oneOf(ACTIVITY_KEYS))

const sex = ref<Sex>('male')
const age = ref('')
const cmStr = ref('')
const kgStr = ref('')
const ftStr = ref('')
const inStr = ref('')
const lbStr = ref('')

const num = (s: string) => (s.trim() === '' ? NaN : Number(s))
const imperial = computed(() => units.value === 'imperial')

const body = computed(() => {
  if (imperial.value) {
    const ft = num(ftStr.value)
    const inch = inStr.value.trim() === '' ? 0 : num(inStr.value)
    const lb = num(lbStr.value)
    if (![ft, inch, lb].every(Number.isFinite) || ft < 0 || inch < 0) return null
    return imperialToMetric(ft, inch, lb)
  }
  return { cm: num(cmStr.value), kg: num(kgStr.value) }
})

const bmiValue = computed(() => (body.value ? bmi(body.value.kg, body.value.cm) : null))
const category = computed<BmiCategory | null>(() => (bmiValue.value === null ? null : bmiCategory(bmiValue.value, standard.value)))
const range = computed(() => (body.value ? healthyWeightRange(body.value.cm, standard.value) : null))

const bmrValue = computed(() => {
  const a = num(age.value)
  if (!body.value || !(a >= 10 && a <= 120)) return null
  return bmr({ sex: sex.value, age: a, cm: body.value.cm, kg: body.value.kg }, formula.value)
})
const activity = computed(() => ACTIVITY_LEVELS[Number(activityKey.value)])
const tdeeValue = computed(() => (bmrValue.value ? tdee(bmrValue.value, activity.value) : null))
const goals = computed(() => (tdeeValue.value ? calorieGoals(tdeeValue.value) : null))

const nf = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }))
const nf0 = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }))
const kcal = (n: number) => nf0.value.format(Math.round(n))
const weight = (kg: number) => (imperial.value ? `${nf.value.format(kg / LB_TO_KG)} lb` : `${nf.value.format(kg)} kg`)

const catColor: Record<BmiCategory, string> = {
  under: 'info', normal: 'success', over: 'warning', obese1: 'warning', obese2: 'error', obese3: 'error',
}
const rangeLabel = (cat: BmiCategory) => {
  const bounds = BMI_BOUNDS[standard.value]
  const i = bounds.findIndex(([c]) => c === cat)
  const lo = i === 0 ? null : bounds[i - 1][1]
  const hi = bounds[i][1]
  return lo === null ? `< ${hi}` : hi === Infinity ? `≥ ${lo}` : `${lo} – < ${hi}`
}
// Marker position on a 15..40 BMI scale.
const markerPct = computed(() => (bmiValue.value === null ? 0 : Math.min(100, Math.max(0, ((bmiValue.value - 15) / 25) * 100))))

const unitItems = computed(() => UNITS.map((u) => ({ title: K(`unit_${u}`), value: u })))
const stdItems = computed(() => STANDARDS.map((s) => ({ title: K(`std_${s}`), value: s })))
const formulaItems = computed(() => FORMULAS.map((f) => ({ title: K(`formula_${f}`), value: f })))
const actItems = computed(() => ACTIVITY_KEYS.map((k) => ({ title: K(`act_${k}`), value: k })))
const sexItems = computed(() => (['male', 'female'] as const).map((s) => ({ title: K(`sex_${s}`), value: s })))
</script>

<template>
  <ToolShell>
    <v-alert type="warning" variant="tonal" density="compact" class="mb-4">{{ K('disclaimer') }}</v-alert>

    <v-row density="comfortable">
      <v-col cols="6" md="3">
        <v-select v-model="units" :items="unitItems" :label="K('units')" hide-details />
      </v-col>
      <v-col cols="6" md="3">
        <v-select v-model="sex" :items="sexItems" :label="K('sex')" hide-details />
      </v-col>
      <v-col cols="6" md="3">
        <v-text-field v-model="age" :label="K('age')" type="number" min="10" max="120" inputmode="numeric" hide-details class="tabular-nums" />
      </v-col>
      <v-col cols="6" md="3" />

      <template v-if="!imperial">
        <v-col cols="6" md="3">
          <v-text-field v-model="cmStr" :label="K('height')" suffix="cm" type="number" min="0" inputmode="decimal" hide-details class="tabular-nums" />
        </v-col>
        <v-col cols="6" md="3">
          <v-text-field v-model="kgStr" :label="K('weight')" suffix="kg" type="number" min="0" inputmode="decimal" hide-details class="tabular-nums" />
        </v-col>
      </template>
      <template v-else>
        <v-col cols="4" md="2">
          <v-text-field v-model="ftStr" :label="K('height')" suffix="ft" type="number" min="0" inputmode="numeric" hide-details class="tabular-nums" />
        </v-col>
        <v-col cols="4" md="2">
          <v-text-field v-model="inStr" :label="K('inches')" suffix="in" type="number" min="0" inputmode="decimal" hide-details class="tabular-nums" />
        </v-col>
        <v-col cols="4" md="2">
          <v-text-field v-model="lbStr" :label="K('weight')" suffix="lb" type="number" min="0" inputmode="decimal" hide-details class="tabular-nums" />
        </v-col>
      </template>
      <v-col cols="12" md="3">
        <v-select v-model="standard" :items="stdItems" :label="K('standard')" hide-details />
      </v-col>
      <v-col cols="12" md="3">
        <v-select v-model="formula" :items="formulaItems" :label="K('formula')" hide-details />
      </v-col>
      <v-col cols="12" md="6">
        <v-select v-model="activityKey" :items="actItems" :label="K('activity')" hide-details />
      </v-col>
    </v-row>

    <v-alert v-if="bmiValue === null" type="info" variant="tonal" density="compact" class="mt-4">{{ K('enterBody') }}</v-alert>

    <template v-else-if="category">
      <v-card variant="tonal" :color="catColor[category]" class="mt-4 pa-4">
        <div class="text-caption">{{ K('bmi') }}</div>
        <div class="d-flex align-baseline flex-wrap ga-3">
          <span class="text-h4 font-mono tabular-nums">{{ nf.format(bmiValue) }}</span>
          <span class="text-h6">{{ K(`cat_${category}`) }}</span>
        </div>
        <div class="position-relative mt-4" style="height: 12px" role="img" :aria-label="`BMI ${nf.format(bmiValue)}`">
          <div class="bmi-scale rounded-pill" />
          <div class="bmi-marker" :style="{ left: markerPct + '%' }" />
        </div>
      </v-card>

      <v-table density="compact" class="mt-3 border rounded">
        <tbody>
          <tr v-for="[c] in BMI_BOUNDS[standard]" :key="c" :class="{ 'font-weight-bold': c === category }">
            <td>{{ K(`cat_${c}`) }}</td>
            <td class="text-end tabular-nums">{{ rangeLabel(c) }}</td>
          </tr>
        </tbody>
      </v-table>

      <div v-if="range" class="mt-3">
        <span class="text-caption text-medium-emphasis">{{ K('healthyRange') }}</span>
        <div class="font-mono tabular-nums">{{ weight(range.min) }} – {{ weight(range.max) }}</div>
      </div>

      <template v-if="bmrValue && tdeeValue && goals">
        <v-row density="comfortable" class="mt-2">
          <v-col cols="6" md="3">
            <div class="text-caption text-medium-emphasis">{{ K('bmr') }}</div>
            <div class="text-h6 font-mono tabular-nums">{{ kcal(bmrValue) }} <small>kcal</small></div>
          </v-col>
          <v-col cols="6" md="3">
            <div class="text-caption text-medium-emphasis">{{ K('tdee') }}</div>
            <div class="text-h6 font-mono tabular-nums">{{ kcal(tdeeValue) }} <small>kcal</small></div>
          </v-col>
        </v-row>
        <div class="text-subtitle-2 mt-3 mb-1">{{ K('goals') }}</div>
        <v-table density="compact" class="border rounded">
          <tbody class="tabular-nums">
            <tr><td>{{ K('goal_lose') }}</td><td class="text-end">{{ kcal(goals.lose) }} kcal</td></tr>
            <tr><td>{{ K('goal_mildLose') }}</td><td class="text-end">{{ kcal(goals.mildLose) }} kcal</td></tr>
            <tr><td>{{ K('goal_maintain') }}</td><td class="text-end">{{ kcal(goals.maintain) }} kcal</td></tr>
            <tr><td>{{ K('goal_gain') }}</td><td class="text-end">{{ kcal(goals.gain) }} kcal</td></tr>
          </tbody>
        </v-table>
        <v-alert v-if="goals.lose < bmrValue" type="warning" variant="text" density="compact" class="mt-2">{{ K('belowBmr') }}</v-alert>
      </template>
      <div v-else class="text-caption text-medium-emphasis mt-3">{{ K('enterAge') }}</div>
    </template>
  </ToolShell>
</template>

<style scoped>
.bmi-scale {
  height: 12px;
  /* 15..40 scale: <18.5, 18.5-24, 24-27, 27-30, 30-35, 35+ */
  background: linear-gradient(90deg, #4fc3f7 0 14%, #66bb6a 14% 36%, #ffca28 36% 48%, #ffa726 48% 60%, #ef5350 60% 80%, #b71c1c 80% 100%);
}
.bmi-marker {
  position: absolute;
  top: -4px;
  width: 4px;
  height: 20px;
  margin-left: -2px;
  border-radius: 2px;
  background: currentColor;
  box-shadow: 0 0 0 2px rgb(var(--v-theme-surface));
}
</style>
