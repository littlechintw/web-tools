/** Human-readable byte size: "512 B", "1.5 KB", "2.50 MB". */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0 B'
  if (n < 1024) return `${Math.round(n)} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/** Strip a file extension: "report.final.pdf" → "report.final". */
export function stripExtension(name: string): string {
  return name.replace(/(.)\.[^./\\]+$/, '$1')
}
