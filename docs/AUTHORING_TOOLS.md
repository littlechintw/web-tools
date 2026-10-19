# Authoring a tool

Every tool is a self-contained folder under `src/tools/<id>/`. The registry
auto-discovers it via `import.meta.glob` — **you never edit a shared file** to
add a tool. Just create the folder with two files.

## Files

```
src/tools/<id>/
  tool.ts     # metadata only — NO translatable text
  View.vue    # the UI
```

`<id>` is kebab-case, unique, and equals the folder name.

## tool.ts

`tool.ts` holds **no translatable strings** — only structural metadata. All text
(title, description, in-tool labels) lives in the locale files (see i18n below).

```ts
import type { ToolMeta } from '@/types'

export const meta: ToolMeta = {
  id: 'my-tool',          // === folder name
  route: 'my-tool',       // URL path => /my-tool
  category: 'text',       // see CategoryId below
  icon: 'mdi-foo',        // any Material Design Icon name
  order: 1,               // optional ordering within category
  keywords: ['foo', '關鍵字'], // optional, language-agnostic search terms
}
```

`CategoryId` is one of:
`encode` | `text` | `data` | `convert` | `datetime` | `generate` | `media` | `dev`

## i18n (centralized)

Every language is ONE file: `src/locales/<code>.ts`, holding the app shell,
category labels, and every tool's strings under `tools.<id>`. Add your tool's
strings to **each** locale file (at minimum `zh-TW.ts`; missing languages fall
back to English → Traditional Chinese automatically):

```ts
// in src/locales/zh-TW.ts (and en.ts / ja.ts / ko.ts)
tools: {
  'my-tool': {
    title: '我的工具',
    description: '一句話說明',
    greeting: '你好',      // any in-tool label
  },
}
```

In the component: `t('tools.my-tool.title')`, `t('tools.my-tool.greeting')`.

> vue-i18n caveat: `@`, `|`, `{`, `}` are special in message strings. To output
> a literal `@`, write `{'@'}`.

**Adding a new language** = copy a locale file to `<code>.ts`, translate the
values. It is auto-discovered (glob); optionally add a display label in
`src/plugins/i18n.ts` (`LOCALE_LABELS`).

## View.vue

- Wrap everything in `<ToolShell>` — it renders the title/description header
  (from `tools.<id>.title/description`) plus the favourite star automatically.
  Import from `@/components/ToolShell.vue`. Optional `max-width` prop and an
  `#actions` slot for header buttons.
- Use `useI18n()` from `vue-i18n`; tool strings are `t('tools.<id>.key')`,
  shared strings are `t('common.*')` (copy, copied, clear, paste, pasteFailed,
  input, output, result, download, upload, save, cancel, confirm, close, swap,
  example, loadExample, error, reset, loading, selectFile, dropHere, pasteHint,
  fileTypeError, charCount, noOutput).

### Shared components (`src/components/`)

| Component | Use it for |
| --- | --- |
| `OutputPanel` | Every read-only text result. Header with label, character count, copy and (with `filename`) download button; monospace body; `error` prop for parse errors. |
| `CopyBtn` | Copy buttons (`icon` for icon-only). Disabled automatically while `text` is empty. |
| `PasteBtn` | "Paste from clipboard" next to the main input. Emits `paste(text)`; hides itself when the clipboard API is unavailable. |
| `FileDrop` | File input. Validates `accept`, shows the chosen file chips (`:show-selected="false"` if the tool lists files itself), accepts files pasted with Ctrl/Cmd+V, emits `files` / `rejected`. |

### Composables (`src/composables/`)

- `useHistory<T>('<id>')` — `history.save(label, data)`, `history.entries`,
  and `history.restoreFromRoute((data) => …)` to reopen an entry from
  `/tool?h=<id>` (call it during setup).
- `useStoredRef(key, default, guard?)` — a localStorage-backed ref so the
  user's *options* (format, indent, quality, flags…) are remembered between
  visits. Key convention: `'<tool-id>.<option>'`. Guards: `oneOf([...])`,
  `isNumber`, `isBoolean`. Never persist the main input or file contents.
- `useAudioContext()` — lazily created, resumed and auto-closed AudioContext
  for tools that make sounds (`audio.play((ctx) => …)`).
- `useClipboard()` — `copy(text)` with a transient `copied` flag, `read()`.
- `useDragReorder(onMove)` — pointer-based drag-to-reorder (mouse + touch).
  Bind `:ref="setContainer"` on the list, `:data-index="i"` on items, and
  `@pointerdown="start(i, $event)"` on a `.drag-handle`; keep arrow buttons as
  the keyboard/accessible fallback.
- `useUndoStack<T>()` — multi-level undo/redo over snapshots (`push` before a
  change, `undo(current)` / `redo(current)` return the state to restore;
  `maxEntries` / `maxBytes` caps). Pair with `undoRedoShortcut(e)` for
  Ctrl/⌘+Z and Ctrl/⌘+Shift+Z.

### Utilities (`src/utils/`)

- `download.ts` — `downloadBlob`, `downloadText`, `downloadBytes`,
  `downloadUrl`, `downloadSequentially` (staggered multi-file). Never build
  `<a download>` by hand.
- `format.ts` — `formatBytes`, `stripExtension` (derive output names from the
  input file name: `stripExtension(file.name) + '-compressed.pdf'`).
- `zip.ts` — `createZip(entries)` (stored ZIP, no deps). Use it whenever a tool
  would otherwise trigger several downloads (pages, split parts).
- `image.ts` — `loadImage`, `canvasToBlob`, `readFileAsDataUrl`, `extensionForMime`.
- `bytes.ts` — `bytesToHex`, `bytesToBase64`, `base64ToBytes`, `dataUrlToBytes`.
- `md5`, `nanoid`, `uaParser`, `pdfjs` (configured pdf.js `getDocument`).

### Styling

Global classes from `src/styles/main.css`: `code-area` (monospace
v-text-field / v-textarea), `font-mono`, `tabular-nums`, `break-all`. Do not
re-declare monospace fonts in scoped CSS. Vuetify 4: use
`<v-row density="comfortable">` (not `dense`) and `ga-*` for gaps.

Typography: Vuetify 4 only ships the Material 3 classes (`text-headline-*`,
`text-title-*`, `text-body-large`…). The Material 2 names this code base uses
(`text-h1…h6`, `text-subtitle-1/2`, `text-body-1/2`, `text-caption`,
`text-overline`, `text-md-h3`) are defined in `src/styles/main.css`, so keep
using them — but don't invent new breakpoint variants without adding them there.

### UX checklist for a new tool

1. Text input → `PasteBtn` + a "load example" button when an example helps.
2. Text output → `OutputPanel` with a sensible `filename`.
3. Encode/decode style tools → a swap button (output → input, flip mode).
4. Options the user would set every time → `useStoredRef`.
5. Files → `FileDrop`; output filenames derived from the input name.
6. Long operations → progress indicator, a disabled/loading primary button and
   a cancel button (pass an `AbortSignal`, see pdf-compress).
7. Errors → inline `v-alert` / `error` props with an i18n message, never raw exceptions only.
8. Anything destructive or multi-step (editing, reordering) → undo/redo via `useUndoStack`.
9. Lists the user arranges → drag-to-reorder via `useDragReorder` (plus arrows).

## Rules

- TypeScript is strict: `noUnusedLocals`, `noUnusedParameters`,
  `verbatimModuleSyntax` (always `import type` for types).
- Vue 3.5 `<script setup lang="ts">`. Vuetify 4 components.
- **Pure client-side. No network calls.** All processing happens in the browser.
- Prefer Web Crypto (`crypto.subtle`) and native APIs over dependencies.
- Sanitize any HTML you render (use DOMPurify) — security matters.
- Adding a tool touches only: your `src/tools/<id>/` folder + each
  `src/locales/*.ts` (the `tools.<id>` block). Don't edit the registry/router.

## Available dependencies

Minimal by design (security). `qrcode`, `@zxing/browser`, `@zxing/library`,
`jsbarcode`, `bcryptjs`, `js-yaml`, `smol-toml`, `papaparse`, `diff`, `marked`,
`dompurify`, `cronstrue`, `cron-parser`.

Self-written, zero-dependency utils in `src/utils/`: `md5`, `nanoid`,
`uaParser`. Prefer Web Crypto (`crypto.subtle`, `crypto.getRandomValues`,
`crypto.randomUUID`) and native canvas APIs before reaching for a package.
