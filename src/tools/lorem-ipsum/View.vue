<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ToolShell from '@/components/ToolShell.vue'
import OutputPanel from '@/components/OutputPanel.vue'
import { isBoolean, isNumber, oneOf, useStoredRef } from '@/composables/useStoredRef'

const TOOL_ID = 'lorem-ipsum'
const { t } = useI18n()
const T = (key: string) => t(`tools.${TOOL_ID}.${key}`)

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
const mode = useStoredRef<Mode>('lorem-ipsum.mode', 'paragraphs', oneOf(['paragraphs', 'sentences', 'words']))
const count = useStoredRef('lorem-ipsum.count', 3, isNumber)
const startClassic = useStoredRef('lorem-ipsum.startClassic', true, isBoolean)
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

// Every option change produces fresh text right away; the button re-rolls
// with the same options.
watch([mode, count, startClassic], () => generate())
generate()
</script>

<template>
  <ToolShell>
    <div class="d-flex flex-wrap align-center ga-4 mb-2">
      <v-btn-toggle v-model="mode" mandatory color="primary" density="comfortable" variant="outlined" divided>
        <v-btn value="paragraphs">{{ T('paragraphs') }}</v-btn>
        <v-btn value="sentences">{{ T('sentences') }}</v-btn>
        <v-btn value="words">{{ T('words') }}</v-btn>
      </v-btn-toggle>
      <v-text-field
        v-model.number="count"
        :label="T('count')"
        type="number"
        min="1"
        max="1000"
        density="compact"
        hide-details
        style="max-width: 120px"
      />
      <v-checkbox v-model="startClassic" :label="T('startClassic')" hide-details density="compact" />
    </div>

    <v-btn color="primary" variant="flat" class="mt-2" prepend-icon="mdi-refresh" @click="generate">
      {{ T('generate') }}
    </v-btn>

    <OutputPanel class="mt-4" :value="output" :rows="10" :mono="false" filename="lorem.txt" />
  </ToolShell>
</template>
