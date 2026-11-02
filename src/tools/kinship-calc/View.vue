<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'
import { oneOf, useStoredRef } from '@/composables/useStoredRef'
import {
  ALL_STEPS,
  canAppend,
  lookupTitle,
  moeUrl,
  resolve,
  resolveReverse,
  titleOptions,
  type Age,
  type DisplayStep,
  type KinshipResult,
  type Sex,
  type Step,
  type Title,
} from '@/lib/kinship'

const { t } = useI18n()
const k = (key: string, named?: Record<string, unknown>) => t(`tools.kinship-calc.${key}`, named ?? {})

const MODES = ['forward', 'reverse', 'lookup'] as const
const mode = useStoredRef<(typeof MODES)[number]>('kinship-calc.mode', 'forward', oneOf(MODES))
const ego = useStoredRef<Sex>('kinship-calc.sex', 'm', oneOf(['m', 'f'] as const))

const chain = ref<Step[]>([])
const age = ref<Age | null>(null)
const query = ref<string | null>(null)

const options = titleOptions()

const push = (s: Step) => canAppend(chain.value, ego.value, s) && chain.value.push(s)
const back = () => chain.value.pop()
const clear = () => {
  chain.value = []
}
const setChain = (c: Step[]) => {
  chain.value = [...c]
}
// A spouse step stops making sense when the speaker's sex changes: reset.
watch(ego, clear)
watch(chain, () => (age.value = null), { deep: true })

const presets: Step[][] = [
  ['f', 'eb'],
  ['f', 'es'],
  ['m', 'es'],
  ['m', 'yb'],
  ['f', 'eb', 'so'],
  ['m', 'es', 'd'],
  ['eb', 'w'],
  ['es', 'h'],
]
const stepLabel = (s: DisplayStep) => k(`step.${s}`)
const compose = (steps: readonly DisplayStep[], prefix = true) =>
  (prefix ? k('mePrefix') : '') + steps.map(stepLabel).join(k('glue'))

const stepDisabled = (s: Step) => !canAppend(chain.value, ego.value, s)

const result = computed<(KinshipResult & { inverse?: Step[] }) | null>(() => {
  if (mode.value === 'lookup' || chain.value.length === 0) return null
  const o = { ego: ego.value, relativeAge: age.value }
  return mode.value === 'forward' ? resolve(chain.value, o) : resolveReverse(chain.value, o)
})

const eqDesc = computed(() => {
  const r = result.value
  if (!r || r.status === 'unsupported') return ''
  const c = mode.value === 'reverse' && r.inverse ? r.inverse : r.chain
  return c.length ? compose(c, false) : ''
})

const needAgeTitles = computed(() => {
  const r = result.value
  return r && r.status === 'needAge' ? r.options : null
})
const shownTitle = computed<Title | null>(() => {
  const r = result.value
  return r && r.status === 'ok' ? r.title : null
})

const groups = computed(() => (query.value ? lookupTitle(query.value) : []))

const hasHint = (x: Title) => x.confidence === 'regional' || x.uncertain
const caveatsOf = (xs: Title[]) => [...new Set(xs.flatMap((x) => x.caveats))]

const summary = computed(() => {
  const x = shownTitle.value
  if (!x) return ''
  return `${x.zh} / ${x.tw} ${x.tl}`
})
const groupSummary = (title: Title) => `${title.zh} / ${title.tw} ${title.tl}`

const pathText = (p: { steps: DisplayStep[]; ego?: Sex; age?: Age }) => {
  let s = compose(p.steps, false)
  if (p.age) s += ` (${k(p.age === 'older' ? 'cousinOlder' : 'cousinYounger')})`
  if (p.ego) s += ` [${k(p.ego === 'm' ? 'forMale' : 'forFemale')}]`
  return s
}
</script>

<template>
  <ToolShell>
    <v-btn-toggle v-model="mode" mandatory color="primary" variant="outlined" divided class="mb-3 flex-wrap h-auto">
      <v-btn value="forward">{{ k('mode.forward') }}</v-btn>
      <v-btn value="reverse">{{ k('mode.reverse') }}</v-btn>
      <v-btn value="lookup">{{ k('mode.lookup') }}</v-btn>
    </v-btn-toggle>

    <div v-if="mode !== 'lookup'" class="d-flex align-center flex-wrap ga-3 mb-2">
      <span class="text-body-2">{{ k('mySex') }}</span>
      <v-btn-toggle v-model="ego" mandatory density="comfortable" color="primary" variant="outlined" divided>
        <v-btn value="m" size="small">{{ k('male') }}</v-btn>
        <v-btn value="f" size="small">{{ k('female') }}</v-btn>
      </v-btn-toggle>
    </div>

    <template v-if="mode !== 'lookup'">
      <div class="text-subtitle-2 mt-2 mb-1">{{ k('buildTitle') }}</div>
      <div class="d-flex align-center flex-wrap ga-1 pa-3 border rounded mb-2" style="min-height: 52px">
        <v-chip size="small" color="primary" variant="flat">{{ k('me') }}</v-chip>
        <template v-for="(s, i) in chain" :key="i">
          <span class="text-medium-emphasis">{{ k('of') }}</span>
          <v-chip size="small" variant="tonal">{{ stepLabel(s) }}</v-chip>
        </template>
        <span v-if="!chain.length" class="text-caption text-medium-emphasis ms-1">{{ k('startHint') }}</span>
        <v-spacer />
        <v-btn icon="mdi-backspace-outline" size="small" variant="text" :disabled="!chain.length" :title="k('backspace')" :aria-label="k('backspace')" @click="back" />
        <v-btn icon="mdi-close" size="small" variant="text" :disabled="!chain.length" :title="k('clear')" :aria-label="k('clear')" @click="clear" />
      </div>

      <div class="d-flex flex-wrap ga-2">
        <v-btn v-for="s in ALL_STEPS" :key="s" variant="tonal" size="small" :disabled="stepDisabled(s)" @click="push(s)">
          {{ stepLabel(s) }}
        </v-btn>
      </div>
      <div class="text-caption text-medium-emphasis mt-1">{{ k('stepHint', { max: 5 }) }}</div>
      <div class="d-flex flex-wrap ga-2 mt-2">
        <span class="text-caption text-medium-emphasis align-self-center">{{ k('examples') }}</span>
        <v-chip v-for="(p, i) in presets" :key="i" size="small" variant="outlined" @click="setChain(p)">
          {{ compose(p, false) }}
        </v-chip>
      </div>

      <div v-if="mode === 'reverse'" class="text-body-2 mt-4">{{ k('reverseHint') }}</div>

      <div v-if="needAgeTitles" class="mt-4">
        <div class="text-body-2 mb-1">{{ k('ageQuestion') }}</div>
        <v-btn-toggle v-model="age" density="comfortable" color="primary" variant="outlined" divided>
          <v-btn value="older" size="small">{{ k('otherOlder') }}</v-btn>
          <v-btn value="younger" size="small">{{ k('otherYounger') }}</v-btn>
        </v-btn-toggle>
      </div>
      <div v-else-if="result?.status === 'ok' && result.age" class="mt-4">
        <v-btn-toggle v-model="age" mandatory density="comfortable" color="primary" variant="outlined" divided>
          <v-btn value="older" size="small">{{ k('otherOlder') }}</v-btn>
          <v-btn value="younger" size="small">{{ k('otherYounger') }}</v-btn>
        </v-btn-toggle>
      </div>

      <v-alert v-if="!chain.length" type="info" variant="tonal" density="compact" class="mt-4">{{ k('empty') }}</v-alert>
      <v-alert v-else-if="result?.status === 'self'" type="info" variant="tonal" density="compact" class="mt-4">{{ k('self') }}</v-alert>
      <v-alert v-else-if="result?.status === 'unsupported'" type="warning" variant="tonal" density="compact" class="mt-4">
        <div class="font-weight-medium">{{ k('unsupported') }}</div>
        <div class="text-body-2">{{ k(`reason.${result.reason}`) }}</div>
      </v-alert>
      <v-alert v-else-if="needAgeTitles && !age" type="info" variant="tonal" density="compact" class="mt-4">{{ k('needAge') }}</v-alert>

      <v-card v-if="shownTitle" variant="tonal" class="mt-4 pa-4">
        <div class="d-flex align-start justify-space-between ga-3">
          <div class="text-caption text-medium-emphasis">{{ mode === 'forward' ? k('resultForward') : k('resultReverse') }}</div>
          <CopyBtn :text="summary" />
        </div>
        <v-row density="comfortable" class="mt-1">
          <v-col cols="12" sm="6">
            <div class="text-caption text-medium-emphasis">{{ k('mandarin') }}</div>
            <div class="text-h5 break-all">{{ shownTitle.zh }}</div>
            <div v-if="shownTitle.zhAlt.length" class="text-body-2 text-medium-emphasis break-all">{{ k('alsoCalled') }}{{ shownTitle.zhAlt.join('、') }}</div>
          </v-col>
          <v-col cols="12" sm="6">
            <div class="text-caption text-medium-emphasis">{{ k('hokkien') }}</div>
            <div class="d-flex align-center ga-1">
              <span class="text-h5 break-all">{{ shownTitle.tw }}</span>
              <v-btn
              v-if="shownTitle.moe"
              icon="mdi-open-in-new"
              size="x-small"
              variant="text"
              :href="moeUrl(shownTitle.moe)"
              target="_blank"
              rel="noopener noreferrer"
              :title="k('moeLink', { word: shownTitle.moe })"
              :aria-label="k('moeLink', { word: shownTitle.moe })"
            />
            </div>
            <div class="text-body-2 font-mono break-all">{{ shownTitle.tl }}</div>
            <div v-if="shownTitle.twAlt.length" class="text-body-2 text-medium-emphasis break-all">{{ k('alsoCalled') }}{{ shownTitle.twAlt.join('、') }}</div>
            <div class="text-caption text-medium-emphasis mt-1">{{ k('sourceNote') }}</div>
          </v-col>
        </v-row>
        <div v-if="eqDesc" class="text-body-2 mt-3 break-all">{{ k('equals') }}{{ eqDesc }}</div>
        <div v-if="hasHint(shownTitle)" class="text-caption text-medium-emphasis mt-2">
          <v-icon icon="mdi-information-outline" size="x-small" />
          {{ k('regionalHint') }}<template v-if="shownTitle.uncertain">{{ k('uncertainHint') }}</template>
        </div>
        <ul v-if="shownTitle.caveats.length" class="text-caption text-medium-emphasis mt-2 ps-4">
          <li v-for="c in shownTitle.caveats" :key="c">{{ k(`caveat.${c}`) }}</li>
        </ul>
      </v-card>
    </template>

    <template v-else>
      <v-autocomplete
        v-model="query"
        :items="options"
        :label="k('pickTitle')"
        :placeholder="k('pickPlaceholder')"
        clearable
        hide-details
        class="mt-2"
      />
      <div v-if="query && !groups.length" class="text-body-2 mt-3">{{ k('noMatch') }}</div>
      <v-card v-for="g in groups" :key="g.title.zh + g.title.tw" variant="tonal" class="mt-4 pa-4">
        <div class="d-flex align-start justify-space-between ga-3">
          <div>
            <span class="text-h6">{{ g.title.zh }}</span>
            <span class="text-body-1 ms-3">{{ g.title.tw }}</span>
            <v-btn
              v-if="g.title.moe"
              icon="mdi-open-in-new"
              size="x-small"
              variant="text"
              :href="moeUrl(g.title.moe)"
              target="_blank"
              rel="noopener noreferrer"
              :title="k('moeLink', { word: g.title.moe })"
              :aria-label="k('moeLink', { word: g.title.moe })"
            />
            <span class="text-body-2 font-mono ms-2">{{ g.title.tl }}</span>
          </div>
          <CopyBtn :text="groupSummary(g.title)" />
        </div>
        <div v-if="g.title.zhAlt.length" class="text-body-2 text-medium-emphasis">{{ k('alsoCalled') }}{{ g.title.zhAlt.join('、') }}</div>
        <div class="text-caption text-medium-emphasis mt-1">{{ k('sourceNote') }}</div>
        <div class="text-caption text-medium-emphasis mt-3">{{ k('couldBe') }}</div>
        <ul class="ps-5">
          <li v-for="(p, i) in g.paths" :key="i" class="text-body-2 break-all">{{ k('mePrefix') }}{{ pathText(p) }}</li>
        </ul>
        <div v-if="hasHint(g.title)" class="text-caption text-medium-emphasis mt-2">
          <v-icon icon="mdi-information-outline" size="x-small" />
          {{ k('regionalHint') }}<template v-if="g.title.uncertain">{{ k('uncertainHint') }}</template>
        </div>
        <ul v-if="caveatsOf([g.title]).length" class="text-caption text-medium-emphasis mt-2 ps-4">
          <li v-for="c in caveatsOf([g.title])" :key="c">{{ k(`caveat.${c}`) }}</li>
        </ul>
      </v-card>
    </template>

    <v-alert type="info" variant="text" density="compact" class="mt-4 px-0">
      <div class="text-caption">{{ k('generalNote') }}</div>
      <div class="text-caption">{{ k('assumptions') }}</div>
      <div class="text-caption">{{ k('romanNote') }}</div>
    </v-alert>
  </ToolShell>
</template>
