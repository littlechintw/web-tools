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
  (from `tools.<id>.title/description`) automatically. Import from `@/components/ToolShell.vue`.
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
- Adding a tool touches only: your `src/tools/<id>/` folder + each
  `src/locales/*.ts` (the `tools.<id>` block). Don't edit the registry/router.

## Available dependencies

Minimal by design (security). `qrcode`, `@zxing/browser`, `@zxing/library`,
`jsbarcode`, `bcryptjs`, `js-yaml`, `smol-toml`, `papaparse`, `diff`, `marked`,
`dompurify`, `cronstrue`, `cron-parser`.

Self-written, zero-dependency utils in `src/utils/`: `md5`, `nanoid`,
`uaParser`. Prefer Web Crypto (`crypto.subtle`, `crypto.getRandomValues`,
`crypto.randomUUID`) and native canvas APIs before reaching for a package.
