import { describe, it, expect } from 'vitest'
import type { ToolMeta } from '@/types'
import zhTW from '@/locales/zh-TW'
import en from '@/locales/en'
import ja from '@/locales/ja'
import ko from '@/locales/ko'

const LOCALES: Record<string, Record<string, unknown>> = {
  'zh-TW': zhTW as unknown as Record<string, unknown>,
  en: en as unknown as Record<string, unknown>,
  ja: ja as unknown as Record<string, unknown>,
  ko: ko as unknown as Record<string, unknown>,
}

// Load tool metas the same way the registry does
const metaModules = import.meta.glob<{ meta: ToolMeta }>('../../tools/*/tool.ts', { eager: true })

const toolIds = Object.values(metaModules)
  .map((m) => m.meta?.id)
  .filter(Boolean) as string[]

// Helper: safely walk nested keys
function getIn(obj: Record<string, unknown>, ...keys: string[]): unknown {
  let cur: unknown = obj
  for (const k of keys) {
    if (typeof cur !== 'object' || cur === null) return undefined
    cur = (cur as Record<string, unknown>)[k]
  }
  return cur
}

describe('i18n completeness', () => {
  it('at least one tool id found', () => {
    expect(toolIds.length).toBeGreaterThan(0)
  })

  for (const locale of Object.keys(LOCALES)) {
    describe(`[${locale}]`, () => {
      const dict = LOCALES[locale]

      for (const id of toolIds) {
        it(`tools.${id}.title`, () => {
          const value = getIn(dict, 'tools', id, 'title')
          expect(value, `[${locale}] tools.${id}.title is missing or empty`).toBeTruthy()
        })

        it(`tools.${id}.description`, () => {
          const value = getIn(dict, 'tools', id, 'description')
          expect(value, `[${locale}] tools.${id}.description is missing or empty`).toBeTruthy()
        })
      }
    })
  }
})
