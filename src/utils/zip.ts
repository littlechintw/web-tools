// Minimal ZIP writer (stored, no compression) so tools can hand the user one
// archive instead of firing a dozen separate downloads. Dependency-free: the
// format is just local headers + central directory + end record. Files are
// already-compressed media (PNG/JPEG/PDF) so "store" loses nothing.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(data: Uint8Array, seed = 0): number {
  let c = (seed ^ 0xffffffff) >>> 0
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  /** Path inside the archive, forward slashes, UTF-8. */
  name: string
  data: Uint8Array | Blob
  /** Defaults to now. */
  date?: Date
}

function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.min(Math.max(d.getFullYear(), 1980), 2107)
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

/** Build a ZIP archive from the given entries. */
export async function createZip(entries: ZipEntry[]): Promise<Blob> {
  const enc = new TextEncoder()
  const parts: BlobPart[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const bytes = entry.data instanceof Blob ? new Uint8Array(await entry.data.arrayBuffer()) : entry.data
    const name = enc.encode(entry.name.replace(/\\/g, '/').replace(/^\/+/, ''))
    const crc = crc32(bytes)
    const { time, date } = dosDateTime(entry.date ?? new Date())
    if (bytes.length > 0xffffffff) throw new Error(`ZIP entry too large: ${entry.name}`)

    // Local file header (30 bytes + name)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true) // version needed: 2.0
    local.setUint16(6, 0x0800, true) // bit 11: UTF-8 names
    local.setUint16(8, 0, true) // method: store
    local.setUint16(10, time, true)
    local.setUint16(12, date, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, bytes.length, true)
    local.setUint32(22, bytes.length, true)
    local.setUint16(26, name.length, true)
    local.setUint16(28, 0, true)
    parts.push(local.buffer, name, bytes as BlobPart)

    // Central directory header (46 bytes + name)
    const cd = new Uint8Array(46 + name.length)
    const v = new DataView(cd.buffer)
    v.setUint32(0, 0x02014b50, true)
    v.setUint16(4, 0x0314, true) // made by: UNIX, 2.0
    v.setUint16(6, 20, true)
    v.setUint16(8, 0x0800, true)
    v.setUint16(10, 0, true)
    v.setUint16(12, time, true)
    v.setUint16(14, date, true)
    v.setUint32(16, crc, true)
    v.setUint32(20, bytes.length, true)
    v.setUint32(24, bytes.length, true)
    v.setUint16(28, name.length, true)
    v.setUint16(30, 0, true) // extra
    v.setUint16(32, 0, true) // comment
    v.setUint16(34, 0, true) // disk
    v.setUint16(36, 0, true) // internal attrs
    v.setUint32(38, 0o100644 << 16, true) // external attrs: -rw-r--r--
    v.setUint32(42, offset, true)
    cd.set(name, 46)
    central.push(cd)

    offset += 30 + name.length + bytes.length
  }

  const cdSize = central.reduce((n, c) => n + c.length, 0)
  if (entries.length > 0xffff || offset + cdSize > 0xffffffff) throw new Error('ZIP too large')
  const eocd = new DataView(new ArrayBuffer(22))
  eocd.setUint32(0, 0x06054b50, true)
  eocd.setUint16(4, 0, true)
  eocd.setUint16(6, 0, true)
  eocd.setUint16(8, entries.length, true)
  eocd.setUint16(10, entries.length, true)
  eocd.setUint32(12, cdSize, true)
  eocd.setUint32(16, offset, true)
  eocd.setUint16(20, 0, true)

  return new Blob([...parts, ...(central as BlobPart[]), eocd.buffer], { type: 'application/zip' })
}
