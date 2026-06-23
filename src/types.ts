export type Locale = 'zh-TW' | 'en'

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

export interface LocalizedText {
  'zh-TW': string
  en: string
}

/**
 * Metadata every tool module must export from its `tool.ts`.
 * The registry auto-discovers these via import.meta.glob, so adding a tool
 * never requires editing a shared file — just drop a new folder in src/tools/.
 */
export interface ToolMeta {
  /** Stable unique id, also the folder name. kebab-case. */
  id: string
  /** URL path segment, e.g. 'base64' => /base64 */
  route: string
  category: CategoryId
  /** mdi icon name, e.g. 'mdi-qrcode' */
  icon: string
  title: LocalizedText
  description: LocalizedText
  /** Extra search terms (any language). */
  keywords?: string[]
  /** Optional ordering hint within a category (lower = earlier). */
  order?: number
}

/** Optional per-tool i18n messages, merged under the `tools.<id>` namespace. */
export type ToolMessages = Partial<Record<Locale, Record<string, unknown>>>

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
