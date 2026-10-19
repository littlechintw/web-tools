import { describe, it, expect } from 'vitest'
import { crc32, createZip } from '@/utils/zip'

/** Tiny reader for the archives we write: walks the central directory. */
async function readZip(blob: Blob) {
  const buf = new Uint8Array(await blob.arrayBuffer())
  const v = new DataView(buf.buffer)
  const eocd = buf.length - 22
  expect(v.getUint32(eocd, true)).toBe(0x06054b50)
  const count = v.getUint16(eocd + 10, true)
  let p = v.getUint32(eocd + 16, true)
  const out: { name: string; data: Uint8Array; crc: number }[] = []
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50)
    const crc = v.getUint32(p + 16, true)
    const size = v.getUint32(p + 20, true)
    const nameLen = v.getUint16(p + 28, true)
    const localOff = v.getUint32(p + 42, true)
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen))
    expect(v.getUint32(localOff, true)).toBe(0x04034b50)
    const localNameLen = v.getUint16(localOff + 26, true)
    const dataStart = localOff + 30 + localNameLen
    out.push({ name, data: buf.slice(dataStart, dataStart + size), crc })
    p += 46 + nameLen
  }
  return out
}

describe('crc32()', () => {
  it('matches known vectors', () => {
    expect(crc32(new TextEncoder().encode('hello'))).toBe(0x3610a686)
    expect(crc32(new TextEncoder().encode('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339)
    expect(crc32(new Uint8Array(0))).toBe(0)
  })
})

describe('createZip()', () => {
  it('round-trips entries with UTF-8 names and binary data', async () => {
    const a = new TextEncoder().encode('hello')
    const b = new Uint8Array([0, 1, 2, 255, 254])
    const zip = await createZip([
      { name: 'a.txt', data: a },
      { name: '資料夾/圖片 2.png', data: new Blob([b]) },
    ])
    expect(zip.type).toBe('application/zip')
    const entries = await readZip(zip)
    expect(entries.map((e) => e.name)).toEqual(['a.txt', '資料夾/圖片 2.png'])
    expect(new TextDecoder().decode(entries[0].data)).toBe('hello')
    expect(entries[0].crc).toBe(0x3610a686)
    expect([...entries[1].data]).toEqual([0, 1, 2, 255, 254])
    expect(entries[1].crc).toBe(crc32(b))
  })

  it('writes a valid empty archive', async () => {
    const zip = await createZip([])
    expect(zip.size).toBe(22)
    expect(await readZip(zip)).toEqual([])
  })
})
