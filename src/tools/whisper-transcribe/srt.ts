export interface TranscriptChunk {
  timestamp: [number, number | null]
  text: string
}

function pad(n: number, width = 2): string {
  return String(Math.floor(n)).padStart(width, '0')
}

function formatSrtTimestamp(seconds: number): string {
  const clamped = Math.max(0, seconds)
  const ms = Math.round((clamped % 1) * 1000)
  const total = Math.floor(clamped)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`
}

/** Builds an SRT subtitle file from Whisper's timestamped chunks. */
export function chunksToSrt(chunks: TranscriptChunk[]): string {
  return chunks
    .map((chunk, i) => {
      const [start, end] = chunk.timestamp
      const safeEnd = end ?? start + 1
      return `${i + 1}\n${formatSrtTimestamp(start)} --> ${formatSrtTimestamp(safeEnd)}\n${chunk.text.trim()}\n`
    })
    .join('\n')
}
