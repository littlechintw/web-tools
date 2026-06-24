import { describe, it, expect } from 'vitest'
import type { ToolMeta } from '@/types'

const VALID_CATEGORIES = new Set([
  'encode', 'text', 'convert', 'generate', 'media', 'pdf', 'datetime', 'dev', 'data', 'fun',
])

// Load all tool metadata eagerly via Vite's glob
const metaModules = import.meta.glob<{ meta: ToolMeta }>('../../tools/*/tool.ts', { eager: true })
const viewModules = import.meta.glob('../../tools/*/View.vue')

function folderOf(path: string): string {
  // '../../tools/base64/tool.ts' -> 'base64'
  return path.split('/').at(-2)!
}

const tools = Object.entries(metaModules).map(([path, mod]) => ({
  folder: folderOf(path),
  meta: mod.meta,
}))

describe('tool registry integrity', () => {
  it('at least one tool is registered', () => {
    expect(tools.length).toBeGreaterThan(0)
  })

  for (const { folder, meta } of tools) {
    describe(`[${folder}]`, () => {
      it('has meta export', () => {
        expect(meta, `${folder}/tool.ts is missing 'meta' export`).toBeDefined()
      })

      it('id is a non-empty string', () => {
        expect(typeof meta.id).toBe('string')
        expect(meta.id.length).toBeGreaterThan(0)
      })

      it('id matches folder name', () => {
        expect(meta.id).toBe(folder)
      })

      it('route is a non-empty string', () => {
        expect(typeof meta.route).toBe('string')
        expect(meta.route.length).toBeGreaterThan(0)
      })

      it('category is valid', () => {
        expect(VALID_CATEGORIES.has(meta.category), `unknown category '${meta.category}'`).toBe(true)
      })

      it('icon starts with mdi-', () => {
        expect(meta.icon).toMatch(/^mdi-/)
      })

      it('has a matching View.vue', () => {
        const viewPath = `../../tools/${folder}/View.vue`
        expect(viewModules[viewPath], `no View.vue found for ${folder}`).toBeDefined()
      })
    })
  }

  it('no duplicate tool ids', () => {
    const ids = tools.map((t) => t.meta.id)
    const unique = new Set(ids)
    expect(ids.length).toBe(unique.size)
  })

  it('no duplicate routes', () => {
    const routes = tools.map((t) => t.meta.route)
    const unique = new Set(routes)
    expect(routes.length).toBe(unique.size)
  })
})
