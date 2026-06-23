# Authoring a tool

Every tool is a self-contained folder under `src/tools/<id>/`. The registry
auto-discovers it via `import.meta.glob` — **you never edit a shared file** to
add a tool. Just create the folder with two files.

## Files

```
src/tools/<id>/
  tool.ts     # metadata + optional i18n messages
  View.vue    # the UI
```

`<id>` is kebab-case, unique, and equals the folder name.

## tool.ts

```ts
import type { ToolMeta, ToolMessages } from '@/types'

export const meta: ToolMeta = {
  id: 'my-tool',          // === folder name
  route: 'my-tool',       // URL path => /my-tool
  category: 'text',       // see CategoryId below
  icon: 'mdi-foo',        // any Material Design Icon name
  order: 1,               // optional ordering within category
  title: { 'zh-TW': '中文名', en: 'English name' },
  description: { 'zh-TW': '一句話說明', en: 'One-line description' },
  keywords: ['foo', '關鍵字'], // optional, improves search
}

// Optional. Strings are available in the component as t('tools.my-tool.key').
export const messages: ToolMessages = {
  'zh-TW': { greeting: '你好' },
  en: { greeting: 'Hello' },
}
```

`CategoryId` is one of:
`encode` | `text` | `data` | `convert` | `datetime` | `generate` | `media` | `dev`

## View.vue

- Wrap everything in `<ToolShell>` — it renders the title/description header
  from the registry automatically. Import from `@/components/ToolShell.vue`.
- Use `<CopyBtn :text="..." />` from `@/components/CopyBtn.vue` for copy buttons.
- Use `<FileDrop @files="..." accept="image/*" />` from `@/components/FileDrop.vue`
  for file inputs (emits `File[]`).
- For history use `useHistory<T>('<id>')` from `@/composables/useHistory`:
  - `history.save(label, data)` to record an entry.
  - `history.entries.value` reactive list for this tool.
  - On mount, restore from `route.query.h` (entry id) — see the base64 example.
- Use `useI18n()` from `vue-i18n`; tool strings are `t('tools.<id>.key')`,
  shared strings are `t('common.*')` (copy, copied, clear, input, output,
  result, download, save, saveToHistory, cancel, confirm, close, swap, example,
  error, reset, loading, selectFile, dropHere).

See `src/tools/base64/` as the canonical reference.

## Rules

- TypeScript is strict: `noUnusedLocals`, `noUnusedParameters`,
  `verbatimModuleSyntax` (always `import type` for types).
- Vue 3.5 `<script setup lang="ts">`. Vuetify 4 components.
- **Pure client-side. No network calls.** All processing happens in the browser.
- Prefer Web Crypto (`crypto.subtle`) and native APIs over dependencies.
- Sanitize any HTML you render (use DOMPurify) — security matters.
- Do NOT edit shared files (registry, router, i18n, locales). Only your folder.

## Available dependencies

`qrcode`, `@zxing/browser`, `@zxing/library`, `jsbarcode`, `spark-md5`,
`bcryptjs`, `js-yaml`, `smol-toml`, `papaparse`, `diff`, `marked`, `dompurify`,
`cronstrue`, `cron-parser`, `ua-parser-js`, `nanoid`, `browser-image-compression`.
Type packages installed for: diff, js-yaml, papaparse, qrcode, spark-md5.
