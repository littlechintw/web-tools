import { describe, it, expect } from 'vitest'
import { searchTools } from '@/lib/toolSearch'
import type { RegisteredTool } from '@/types'

const mk = (id: string, keywords: string[] = []): RegisteredTool => ({
  id,
  route: id,
  category: 'text',
  icon: 'mdi-x',
  keywords,
  component: async () => ({}),
})

const TOOLS = [mk('base64', ['encode']), mk('pdf-compress', ['pdf', '壓縮']), mk('json-format', ['json'])]
const titles: Record<string, string> = { base64: 'Base64 編解碼', 'pdf-compress': 'PDF 壓縮', 'json-format': 'JSON 格式化' }
const title = (id: string) => titles[id]
const desc = (id: string) => `about ${id}`

describe('searchTools()', () => {
  it('returns everything for an empty query', () => {
    expect(searchTools(TOOLS, '   ', title, desc)).toHaveLength(3)
  })
  it('matches title, keywords and id case-insensitively', () => {
    expect(searchTools(TOOLS, 'BASE', title, desc).map((t) => t.id)).toEqual(['base64'])
    expect(searchTools(TOOLS, '壓縮', title, desc).map((t) => t.id)).toEqual(['pdf-compress'])
    expect(searchTools(TOOLS, 'json-f', title, desc).map((t) => t.id)).toEqual(['json-format'])
  })
  it('requires every term to match', () => {
    expect(searchTools(TOOLS, 'pdf 壓縮', title, desc)).toHaveLength(1)
    expect(searchTools(TOOLS, 'pdf json', title, desc)).toHaveLength(0)
  })
  it('ranks title matches above description/keyword matches', () => {
    const tools = [mk('a', ['zip']), mk('zip-tool')]
    const t2 = (id: string) => (id === 'zip-tool' ? 'Zip Tool' : 'Archive')
    expect(searchTools(tools, 'zip', t2, desc).map((t) => t.id)).toEqual(['zip-tool', 'a'])
  })
})
