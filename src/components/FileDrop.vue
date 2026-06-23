<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    accept?: string
    multiple?: boolean
    hint?: string
  }>(),
  { accept: '*/*', multiple: false, hint: '' },
)

const emit = defineEmits<{ files: [files: File[]] }>()

const { t } = useI18n()
const dragging = ref(false)
const inputRef = ref<HTMLInputElement>()

function handleFiles(list: FileList | null) {
  if (!list || list.length === 0) return
  emit('files', Array.from(list))
}

function onDrop(e: DragEvent) {
  dragging.value = false
  handleFiles(e.dataTransfer?.files ?? null)
}

function onSelect(e: Event) {
  handleFiles((e.target as HTMLInputElement).files)
  ;(e.target as HTMLInputElement).value = ''
}
</script>

<template>
  <div
    class="file-drop pa-8 text-center rounded-lg"
    :class="{ 'file-drop--active': dragging }"
    role="button"
    tabindex="0"
    @click="inputRef?.click()"
    @keydown.enter.prevent="inputRef?.click()"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <v-icon icon="mdi-cloud-upload-outline" size="40" class="mb-2 text-medium-emphasis" />
    <div class="text-body-1">{{ hint || t('common.dropHere') }}</div>
    <input
      ref="inputRef"
      type="file"
      :accept="accept"
      :multiple="multiple"
      hidden
      @change="onSelect"
    />
  </div>
</template>

<style scoped>
.file-drop {
  border: 2px dashed rgba(var(--v-border-color), 0.4);
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
}
.file-drop:hover,
.file-drop--active {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.06);
}
</style>
