export type Locale = 'zh-TW' | 'en' | 'ja' | 'ko'

/** Top-level grouping shown on the home page. */
export type CategoryId =
  | 'encode'
  | 'text'
  | 'convert'
  | 'generate'
  | 'media'
  | 'datetime'
  | 'dev'
  | 'data'

/**
 * Metadata every tool module must export from its `tool.ts`.
 * The registry auto-discovers these via import.meta.glob, so adding a tool
 * never requires editing the registry — just drop a new folder in src/tools/.
 *
 * NOTE: tools carry NO translatable text. The title, description and every
 * in-tool label live in the per-language files under src/locales/ (namespace
 * `tools.<id>`). Adding a language therefore only touches one locale file.
 */
export interface ToolMeta {
  /** Stable unique id, also the folder name. kebab-case. */
  id: string
  /** URL path segment, e.g. 'base64' => /base64 */
  route: string
  category: CategoryId
  /** mdi icon name, e.g. 'mdi-qrcode' */
  icon: string
  /** Extra search terms (any language). */
  keywords?: string[]
  /** Optional ordering hint within a category (lower = earlier). */
  order?: number
}

export interface RegisteredTool extends ToolMeta {
  /** Lazy component loader for the router. */
  component: () => Promise<unknown>
}

export interface HistoryEntry<T = unknown> {
  id: string
  toolId: string
  /** Short human-readable label for the list. */
  label: string
  /** Arbitrary serializable payload restored by the tool. */
  data: T
  createdAt: number
}
