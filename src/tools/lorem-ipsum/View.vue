<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import CopyBtn from '@/components/CopyBtn.vue'

const { t } = useI18n()

const WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
  'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
  'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
  'velit', 'esse', 'cillum', 'eu', 'fugiat', 'nulla', 'pariatur', 'excepteur',
  'sint', 'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui',
  'officia', 'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum',
]
const CLASSIC = 'Lorem ipsum dolor sit amet'

type Mode = 'paragraphs' | 'sentences' | 'words'
const mode = ref<Mode>('paragraphs')
const count = ref(3)
const startClassic = ref(true)
const output = ref('')

const rand = (n: number) => Math.floor(Math.random() * n)
const pick = () => WORDS[rand(WORDS.length)]
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function makeSentence(): string {
  const n = 6 + rand(10)
  const w: string[] = []
  for (let i = 0; i < n; i++) w.push(pick())
  // occasional comma after a middle word
  if (n > 8) w[4] = w[4] + ','
  return cap(w.join(' ')) + '.'
}

function makeParagraph(): string {
  const n = 3 + rand(4)
  const sentences: string[] = []
  for (let i = 0; i < n; i++) sentences.push(makeSentence())
  return sentences.join(' ')
}

function generate() {
  const c = Math.max(1, Math.min(1000, Math.floor(count.value || 1)))
  if (mode.value === 'words') {
    const w: string[] = []
    for (let i = 0; i < c; i++) w.push(pick())
    let s = w.join(' ')
    if (startClassic.value) {
      const tail = w.slice(5).join(' ')
      s = (CLASSIC + (tail ? ' ' + tail : '')).split(' ').slice(0, c).join(' ')
    }
    output.value = s
    return
  }
  if (mode.value === 'sentences') {
    const arr: string[] = []
    for (let i = 0; i < c; i++) arr.push(makeSentence())
    if (startClassic.value && arr.length) arr[0] = CLASSIC + ', ' + arr[0].charAt(0).toLowerCase() + arr[0].slice(1)
    output.value = arr.join(' ')
    return
  }
  // paragraphs
  const arr: string[] = []
  for (let i = 0; i < c; i++) arr.push(makeParagraph())
  if (startClassic.value && arr.length) {
    arr[0] = CLASSIC + ', ' + arr[0].charAt(0).toLowerCase() + arr[0].slice(1)
  }
  output.value = arr.join('\n\n')
}

generate()
</script>

<template>
  <ToolShell>
    <div class="d-flex flex-wrap align-center ga-4 mb-2">
      <v-btn-toggle v-model="mode" mandatory color="primary" density="comfortable" variant="outlined">
        <v-btn value="paragraphs">{{ t('tools.lorem-ipsum.paragraphs') }}</v-btn>
        <v-btn value="sentences">{{ t('tools.lorem-ipsum.sentences') }}</v-btn>
        <v-btn value="words">{{ t('tools.lorem-ipsum.words') }}</v-btn>
      </v-btn-toggle>
      <v-text-field
        v-model.number="count"
        :label="t('tools.lorem-ipsum.count')"
        type="number"
        min="1"
        max="1000"
        density="compact"
        hide-details
        style="max-width: 120px"
      />
    </div>

    <v-checkbox
      v-model="startClassic"
      :label="t('tools.lorem-ipsum.startClassic')"
      hide-details
      density="compact"
    />

    <v-btn color="primary" variant="flat" class="mt-2" prepend-icon="mdi-refresh" @click="generate">
      {{ t('tools.lorem-ipsum.generate') }}
    </v-btn>

    <v-textarea
      :model-value="output"
      :label="t('common.output')"
      rows="10"
      auto-grow
      readonly
      class="mt-3"
    />

    <div class="d-flex ga-2 mt-2">
      <CopyBtn :text="output" />
    </div>
  </ToolShell>
</template>
