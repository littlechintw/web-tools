<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { useHistory } from '@/composables/useHistory'

const TOOL_ID = 'unit-convert'
const { t } = useI18n()
const route = useRoute()

type CategoryId =
  | 'length'
  | 'mass'
  | 'temperature'
  | 'data'
  | 'area'
  | 'volume'
  | 'speed'
  | 'time'

// factor = how many base units one of this unit equals.
const FACTORS: Record<Exclude<CategoryId, 'temperature'>, Record<string, number>> = {
  length: {
    mm: 0.001,
    cm: 0.01,
    m: 1,
    km: 1000,
    in: 0.0254,
    ft: 0.3048,
    yd: 0.9144,
    mi: 1609.344,
    nmi: 1852,
  },
  mass: {
    mg: 0.000001,
    g: 0.001,
    kg: 1,
    t: 1000,
    oz: 0.0283495231,
    lb: 0.45359237,
    st: 6.35029318,
  },
  data: {
    bit: 0.125,
    B: 1,
    KB: 1000,
    MB: 1e6,
    GB: 1e9,
    TB: 1e12,
    KiB: 1024,
    MiB: 1048576,
    GiB: 1073741824,
    TiB: 1099511627776,
  },
  area: {
    'mm²': 0.000001,
    'cm²': 0.0001,
    'm²': 1,
    'km²': 1e6,
    ha: 10000,
    'in²': 0.00064516,
    'ft²': 0.09290304,
    acre: 4046.8564224,
  },
  volume: {
    ml: 0.001,
    l: 1,
    'm³': 1000,
    tsp: 0.00492892,
    tbsp: 0.0147868,
    'fl-oz': 0.0295735,
    cup: 0.236588,
    pt: 0.473176,
    qt: 0.946353,
    gal: 3.785411784,
  },
  speed: {
    'm/s': 1,
    'km/h': 0.277777778,
    mph: 0.44704,
    'ft/s': 0.3048,
    knot: 0.514444444,
  },
  time: {
    ms: 0.001,
    s: 1,
    min: 60,
    h: 3600,
    day: 86400,
    week: 604800,
    year: 31557600,
  },
}

const TEMP_UNITS = ['C', 'F', 'K']

const categories: CategoryId[] = [
  'length',
  'mass',
  'temperature',
  'data',
  'area',
  'volume',
  'speed',
  'time',
]

const history = useHistory<{ category: CategoryId; from: string; to: string; value: string }>(
  TOOL_ID,
)

const category = ref<CategoryId>('length')
const value = ref('1')

const unitsFor = (cat: CategoryId): string[] =>
  cat === 'temperature' ? TEMP_UNITS : Object.keys(FACTORS[cat])

const fromUnit = ref(unitsFor('length')[0])
const toUnit = ref(unitsFor('length')[1])

watch(category, (cat) => {
  const units = unitsFor(cat)
  fromUnit.value = units[0]
  toUnit.value = units[1] ?? units[0]
})

function toBaseTemp(v: number, unit: string): number {
  if (unit === 'C') return v
  if (unit === 'F') return ((v - 32) * 5) / 9
  return v - 273.15 // K
}
function fromBaseTemp(c: number, unit: string): number {
  if (unit === 'C') return c
  if (unit === 'F') return (c * 9) / 5 + 32
  return c + 273.15 // K
}

const categoryItems = computed(() =>
  categories.map((c) => ({
    title: t(`tools.unit-convert.cat${c.charAt(0).toUpperCase()}${c.slice(1)}`),
    value: c,
  })),
)

const units = computed(() => unitsFor(category.value))

const result = computed<string>(() => {
  const v = parseFloat(value.value)
  if (!isFinite(v)) return ''
  let out: number
  if (category.value === 'temperature') {
    out = fromBaseTemp(toBaseTemp(v, fromUnit.value), toUnit.value)
  } else {
    const table = FACTORS[category.value]
    out = (v * table[fromUnit.value]) / table[toUnit.value]
  }
  // trim float noise
  return String(Number(out.toPrecision(12)))
})

function save() {
  if (!value.value.trim() || !result.value) return
  const label = `${value.value} ${fromUnit.value} → ${toUnit.value}`
  history.save(label, {
    category: category.value,
    from: fromUnit.value,
    to: toUnit.value,
    value: value.value,
  })
}

watch([value, fromUnit, toUnit, category], () => save())

function swap() {
  const f = fromUnit.value
  fromUnit.value = toUnit.value
  toUnit.value = f
}

onMounted(() => {
  const h = route.query.h as string | undefined
  if (h) {
    const e = history.entries.value.find((x) => x.id === h)
    if (e) {
      category.value = e.data.category
      // set units after category-driven reset
      fromUnit.value = e.data.from
      toUnit.value = e.data.to
      value.value = e.data.value
    }
  }
})
</script>

<template>
  <ToolShell>
    <v-select
      v-model="category"
      :items="categoryItems"
      :label="t('tools.unit-convert.category')"
      density="compact"
      hide-details
      class="mb-4"
      style="max-width: 260px"
    />

    <div class="d-flex flex-wrap align-end ga-3">
      <v-text-field
        v-model="value"
        :label="t('tools.unit-convert.value')"
        type="number"
        hide-details
        style="max-width: 200px"
      />
      <v-select
        v-model="fromUnit"
        :items="units"
        :label="t('tools.unit-convert.fromUnit')"
        density="compact"
        hide-details
        style="max-width: 160px"
      />
      <v-btn icon="mdi-swap-horizontal" variant="text" :title="t('common.swap')" @click="swap" />
      <v-select
        v-model="toUnit"
        :items="units"
        :label="t('tools.unit-convert.toUnit')"
        density="compact"
        hide-details
        style="max-width: 160px"
      />
    </div>

    <v-card variant="tonal" class="mt-4 pa-4 d-flex align-center justify-space-between ga-3">
      <div>
        <div class="text-caption text-medium-emphasis">{{ t('tools.unit-convert.result') }}</div>
        <div class="text-h6 code-text">{{ result }} {{ result ? toUnit : '' }}</div>
      </div>
      <CopyBtn :text="result" icon />
    </v-card>
  </ToolShell>
</template>

<style scoped>
.code-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  word-break: break-all;
}
</style>
