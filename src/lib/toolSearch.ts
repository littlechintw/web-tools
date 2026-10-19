import type { RegisteredTool } from '@/types'

/**
 * Case-insensitive tool search over title, description, id and keywords.
 * Every whitespace-separated term must match somewhere, so "pdf 壓縮" finds
 * the compressor without the words being adjacent. Results keep the input
 * order, but title matches are ranked first.
 */
export function searchTools(
  tools: RegisteredTool[],
  query: string,
  titleOf: (id: string) => string,
  descOf: (id: string) => string,
): RegisteredTool[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return tools
  const scored: { tool: RegisteredTool; score: number }[] = []
  for (const tool of tools) {
    const title = titleOf(tool.id).toLowerCase()
    const rest = [descOf(tool.id), tool.id, tool.route, ...(tool.keywords ?? [])].join(' ').toLowerCase()
    let score = 0
    let ok = true
    for (const term of terms) {
      if (title.includes(term)) score += title.startsWith(term) ? 3 : 2
      else if (rest.includes(term)) score += 1
      else {
        ok = false
        break
      }
    }
    if (ok) scored.push({ tool, score })
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.tool)
}
