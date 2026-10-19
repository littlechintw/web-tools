<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatBytes } from '@/utils/format'

/**
 * Drop zone + file picker. Validates against `accept`, shows the chosen
 * file(s), and also accepts files pasted with Ctrl/Cmd+V anywhere on the page
 * (unless the user is typing in a text field).
 */
const props = withDefaults(
  defineProps<{
    /** Same syntax as <input accept>: "image/*", "application/pdf,.pdf", … */
    accept?: string
    multiple?: boolean
    hint?: string
    disabled?: boolean
    /** Show the selected file name(s) and sizes under the zone. */
    showSelected?: boolean
    /** Listen for files pasted from the clipboard. */
    paste?: boolean
    compact?: boolean
  }>(),
  { accept: '*/*', multiple: false, hint: '', disabled: false, showSelected: true, paste: true, compact: false },
)

const emit = defineEmits<{ files: [files: File[]]; rejected: [files: File[]] }>()

const { t } = useI18n()
const dragging = ref(false)
const inputRef = ref<HTMLInputElement>()
const rootRef = ref<HTMLElement>()
const selected = ref<{ name: string; size: number }[]>([])
const rejectedNames = ref('')

const acceptTokens = computed(() =>
  props.accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
)
const acceptsImages = computed(() => acceptTokens.value.some((tk) => tk === '*/*' || tk.startsWith('image/')))

function matches(file: File): boolean {
  const tokens = acceptTokens.value
  if (!tokens.length || tokens.includes('*/*')) return true
  const type = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  return tokens.some((tk) => {
    if (tk.startsWith('.')) return name.endsWith(tk)
    if (tk.endsWith('/*')) return type.startsWith(tk.slice(0, -1))
    // Some platforms hand over files with an empty MIME type; don't reject
    // those on type alone when the extension can't be checked either.
    return type === tk || (type === '' && !tokens.some((x) => x.startsWith('.')))
  })
}

function handleFiles(list: FileList | File[] | null) {
  if (!list || list.length === 0 || props.disabled) return
  const all = Array.from(list)
  let ok = all.filter(matches)
  const bad = all.filter((f) => !matches(f))
  if (!props.multiple) ok = ok.slice(0, 1)
  if (bad.length) {
    rejectedNames.value = bad.map((f) => f.name).join(', ')
    emit('rejected', bad)
  } else {
    rejectedNames.value = ''
  }
  if (ok.length) {
    selected.value = ok.map((f) => ({ name: f.name, size: f.size }))
    emit('files', ok)
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false
  handleFiles(e.dataTransfer?.files ?? null)
}

function onDragLeave(e: DragEvent) {
  // dragleave also fires when moving over child elements; only deactivate
  // when the pointer actually leaves the drop zone.
  const to = e.relatedTarget as Node | null
  if (!to || !(e.currentTarget as Node).contains(to)) dragging.value = false
}

function onSelect(e: Event) {
  handleFiles((e.target as HTMLInputElement).files)
  ;(e.target as HTMLInputElement).value = ''
}

function open() {
  if (!props.disabled) inputRef.value?.click()
}

function onPaste(e: ClipboardEvent) {
  if (!props.paste || props.disabled) return
  // Only a visible drop zone should claim the paste, and never steal a paste
  // aimed at a text field.
  if (!rootRef.value || rootRef.value.offsetParent === null) return
  const target = e.target as HTMLElement | null
  if (target && (target.closest('input, textarea, [contenteditable="true"]'))) return
  const files = Array.from(e.clipboardData?.files ?? [])
  if (!files.length) return
  e.preventDefault()
  handleFiles(files)
}

onMounted(() => document.addEventListener('paste', onPaste))
onUnmounted(() => document.removeEventListener('paste', onPaste))

/** Forget the displayed selection (e.g. after the tool resets). */
defineExpose({ reset: () => { selected.value = []; rejectedNames.value = '' } })
</script>

<template>
  <div ref="rootRef">
    <div
      class="file-drop text-center rounded-lg"
      :class="{ 'file-drop--active': dragging, 'file-drop--disabled': disabled, 'pa-8': !compact, 'pa-4': compact }"
      role="button"
      :tabindex="disabled ? -1 : 0"
      :aria-disabled="disabled"
      @click="open"
      @keydown.enter.prevent="open"
      @keydown.space.prevent="open"
      @dragover.prevent="!disabled && (dragging = true)"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <v-icon icon="mdi-cloud-upload-outline" :size="compact ? 28 : 40" class="mb-2 text-medium-emphasis" />
      <div class="text-body-1">{{ hint || t('common.dropHere') }}</div>
      <div v-if="paste && acceptsImages" class="text-caption text-medium-emphasis mt-1">
        {{ t('common.pasteHint') }}
      </div>
      <input
        ref="inputRef"
        type="file"
        :accept="accept"
        :multiple="multiple"
        :disabled="disabled"
        hidden
        @change="onSelect"
        @click.stop
      />
    </div>

    <div v-if="rejectedNames" class="text-caption text-error mt-2">
      <v-icon icon="mdi-alert-circle-outline" size="14" class="mr-1" />{{ t('common.fileTypeError', { names: rejectedNames }) }}
    </div>

    <div v-if="showSelected && selected.length" class="d-flex flex-wrap ga-1 mt-2">
      <v-chip
        v-for="(f, i) in selected"
        :key="i"
        size="small"
        variant="tonal"
        color="primary"
        prepend-icon="mdi-file-outline"
        class="file-chip"
      >
        <span class="text-truncate">{{ f.name }}</span>
        <span class="text-medium-emphasis ml-1">({{ formatBytes(f.size) }})</span>
      </v-chip>
    </div>
  </div>
</template>

<style scoped>
.file-drop {
  border: 2px dashed rgba(var(--v-border-color), 0.4);
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
}
.file-drop:hover,
.file-drop--active,
.file-drop:focus-visible {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.06);
  outline: none;
}
.file-drop--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.file-chip {
  max-width: 100%;
}
.file-chip :deep(.v-chip__content) {
  overflow: hidden;
}
</style>
