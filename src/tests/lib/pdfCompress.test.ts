import { describe, it, expect } from 'vitest'
import { PDFContext, PDFDocument, PDFHexString, PDFName, PDFRawStream } from '@cantoo/pdf-lib'
import {
  analyzePdf,
  compressPdfImages,
  describeColorSpace,
  formatBytes,
  gcUnreachable,
  isDefaultDecode,
  jpegComponents,
  samplesToRGBA,
  searchLadder,
  undoPredictor,
  type ColorSpaceInfo,
  type DecodedImage,
  type ImageEncoder,
} from '@/lib/pdfCompress'

// ---------------------------------------------------------------------------
// helpers

const GRAY: ColorSpaceInfo = { kind: 'gray', ncomp: 1 }
const RGB: ColorSpaceInfo = { kind: 'rgb', ncomp: 3 }
const CMYK: ColorSpaceInfo = { kind: 'cmyk', ncomp: 4 }

function noise(n: number): Uint8Array {
  const a = new Uint8Array(n)
  crypto.getRandomValues(a)
  return a
}

/** Minimal JPEG header (SOI, APP0, SOF0 with `nf` components) padded to `size`. */
function fakeJpeg(nf: number, size = 6000): Uint8Array {
  const head = [
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, // APP0 (len 4)
    0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x10, nf, // SOF0: P=8, 16x16, Nf
  ]
  const out = new Uint8Array(size)
  out.set(head)
  out[size - 2] = 0xff
  out[size - 1] = 0xd9
  return out
}

interface Call {
  img: DecodedImage
  width: number
  height: number
  quality: number
}

function recorder(output: (w: number, h: number) => Uint8Array | null) {
  const calls: Call[] = []
  const encode: ImageEncoder = async (img, width, height, quality) => {
    calls.push({ img, width, height, quality })
    const bytes = output(width, height)
    return bytes ? { bytes, width, height } : null
  }
  return { calls, encode }
}

type Literal = Record<string, unknown>

async function buildPdf(setup: (doc: PDFDocument) => void): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.addPage([200, 200])
  setup(doc)
  return doc.save({ useObjectStreams: true })
}

function addImage(doc: PDFDocument, dict: Literal, contents: Uint8Array, flate = true) {
  const ctx = doc.context
  const base = { Type: 'XObject', Subtype: 'Image', ...dict }
  const stream = flate ? ctx.flateStream(contents, base) : ctx.stream(contents, base)
  const ref = ctx.register(stream)
  doc.getPage(0).node.setXObject(PDFName.of(`Im${ref.objectNumber}`), ref)
  return ref
}

async function imageStreams(bytes: Uint8Array): Promise<PDFRawStream[]> {
  const doc = await PDFDocument.load(bytes)
  return doc.context
    .enumerateIndirectObjects()
    .map(([, o]) => o)
    .filter(
      (o): o is PDFRawStream =>
        o instanceof PDFRawStream && o.dict.lookup(PDFName.of('Subtype')) === PDFName.of('Image'),
    )
}

const name = (s: PDFRawStream, key: string) => (s.dict.lookup(PDFName.of(key)) as PDFName | undefined)?.decodeText()
const num = (s: PDFRawStream, key: string) => Number(s.dict.lookup(PDFName.of(key))?.toString())

// ---------------------------------------------------------------------------

describe('formatBytes()', () => {
  it('picks a sensible unit', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.50 MB')
    expect(formatBytes(NaN)).toBe('0 B')
  })
})

describe('undoPredictor()', () => {
  it('passes data through for predictor 1', () => {
    const d = new Uint8Array([1, 2, 3])
    expect(undoPredictor(d, 1, 1, 8, 3)).toBe(d)
  })

  it('PNG None/Sub/Up/Average/Paeth (bpp 1)', () => {
    // Two rows of three 8-bit gray samples each, filter byte first.
    const sub = new Uint8Array([1, 10, 5, 5])
    expect([...undoPredictor(sub, 15, 1, 8, 3)]).toEqual([10, 15, 20])

    const up = new Uint8Array([0, 1, 2, 3, 2, 1, 1, 1])
    expect([...undoPredictor(up, 12, 1, 8, 3)]).toEqual([1, 2, 3, 2, 3, 4])

    const avg = new Uint8Array([0, 10, 20, 3, 1, 2])
    expect([...undoPredictor(avg, 13, 1, 8, 2)]).toEqual([10, 20, 6, 15])

    const paeth = new Uint8Array([0, 10, 20, 4, 1, 2])
    expect([...undoPredictor(paeth, 14, 1, 8, 2)]).toEqual([10, 20, 11, 22])
  })

  it('PNG Sub honours bytes-per-pixel for RGB', () => {
    // One RGB pixel row of two pixels: second pixel is a delta of the first.
    const d = new Uint8Array([1, 10, 20, 30, 1, 1, 1])
    expect([...undoPredictor(d, 11, 3, 8, 2)]).toEqual([10, 20, 30, 11, 21, 31])
  })

  it('TIFF predictor 2 (8-bit)', () => {
    const d = new Uint8Array([10, 5, 5, 1, 1, 1])
    expect([...undoPredictor(d, 2, 1, 8, 3)]).toEqual([10, 15, 20, 1, 2, 3])
  })

  it('rejects unknown PNG filter types', () => {
    expect(() => undoPredictor(new Uint8Array([9, 1, 2]), 15, 1, 8, 2)).toThrow()
  })
})

describe('samplesToRGBA()', () => {
  it('8-bit gray', () => {
    expect([...samplesToRGBA(new Uint8Array([0, 255]), 2, 1, 8, GRAY)]).toEqual([0, 0, 0, 255, 255, 255, 255, 255])
  })

  it('1-bit gray with row padding', () => {
    // rows: 1 0 1 / 0 1 1 → 0b101xxxxx, 0b011xxxxx
    const px = samplesToRGBA(new Uint8Array([0xa0, 0x60]), 3, 2, 1, GRAY)
    const reds = [0, 1, 2, 3, 4, 5].map((i) => px[i * 4])
    expect(reds).toEqual([255, 0, 255, 0, 255, 255])
  })

  it('4-bit gray scales to 0–255', () => {
    const px = samplesToRGBA(new Uint8Array([0xf8]), 2, 1, 4, GRAY)
    expect([px[0], px[4]]).toEqual([255, 136])
  })

  it('16-bit gray keeps the high byte', () => {
    expect(samplesToRGBA(new Uint8Array([0xff, 0x00, 0x80, 0xff]), 2, 1, 16, GRAY)[4]).toBe(128)
  })

  it('8-bit RGB', () => {
    expect([...samplesToRGBA(new Uint8Array([1, 2, 3]), 1, 1, 8, RGB)]).toEqual([1, 2, 3, 255])
  })

  it('CMYK → RGB', () => {
    const white = samplesToRGBA(new Uint8Array([0, 0, 0, 0]), 1, 1, 8, CMYK)
    const black = samplesToRGBA(new Uint8Array([0, 0, 0, 255]), 1, 1, 8, CMYK)
    const cyan = samplesToRGBA(new Uint8Array([255, 0, 0, 0]), 1, 1, 8, CMYK)
    expect([...white.slice(0, 3)]).toEqual([255, 255, 255])
    expect([...black.slice(0, 3)]).toEqual([0, 0, 0])
    expect([...cyan.slice(0, 3)]).toEqual([0, 255, 255])
  })

  it('2-bit indexed palette lookup', () => {
    const cs: ColorSpaceInfo = {
      kind: 'indexed',
      ncomp: 1,
      base: { kind: 'rgb', ncomp: 3 },
      hival: 3,
      palette: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0]),
    }
    // indices 0,1,2,3 → 0b00011011
    const px = samplesToRGBA(new Uint8Array([0x1b]), 4, 1, 2, cs)
    expect([...px]).toEqual([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 255])
  })

  it('treats missing data as zeros instead of throwing', () => {
    const px = samplesToRGBA(new Uint8Array([7]), 2, 2, 8, GRAY)
    expect(px.length).toBe(16)
    expect(px[0]).toBe(7)
    expect(px[4]).toBe(0)
  })
})

describe('isDefaultDecode()', () => {
  const ctx = PDFContext.create()
  it('absent → default', () => expect(isDefaultDecode(undefined, RGB, 8)).toBe(true))
  it('matching array → default', () => expect(isDefaultDecode(ctx.obj([0, 1, 0, 1, 0, 1]), RGB, 8)).toBe(true))
  it('inverted → not default', () => expect(isDefaultDecode(ctx.obj([1, 0, 1, 0, 1, 0]), RGB, 8)).toBe(false))
  it('indexed uses 2^bpc - 1', () => {
    const cs: ColorSpaceInfo = { kind: 'indexed', ncomp: 1, base: RGB, hival: 3, palette: new Uint8Array(12) }
    expect(isDefaultDecode(ctx.obj([0, 255]), cs, 8)).toBe(true)
    expect(isDefaultDecode(ctx.obj([0, 15]), cs, 8)).toBe(false)
  })
})

describe('jpegComponents()', () => {
  it('reads Nf from the SOF marker', () => {
    expect(jpegComponents(fakeJpeg(3))).toBe(3)
    expect(jpegComponents(fakeJpeg(1))).toBe(1)
    expect(jpegComponents(fakeJpeg(4))).toBe(4)
  })
  it('returns null for non-JPEG data', () => {
    expect(jpegComponents(new Uint8Array([1, 2, 3, 4, 5]))).toBeNull()
    expect(jpegComponents(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBeNull()
  })
})

describe('describeColorSpace()', () => {
  const ctx = PDFContext.create()
  it('device names', () => {
    expect(describeColorSpace(PDFName.of('DeviceRGB'), ctx)?.kind).toBe('rgb')
    expect(describeColorSpace(PDFName.of('DeviceGray'), ctx)?.kind).toBe('gray')
    expect(describeColorSpace(PDFName.of('DeviceCMYK'), ctx)?.kind).toBe('cmyk')
    expect(describeColorSpace(PDFName.of('Pattern'), ctx)).toBeNull()
  })
  it('ICCBased via N, through an indirect ref', () => {
    const icc = ctx.register(ctx.stream(new Uint8Array(0), { N: 4 }))
    expect(describeColorSpace(ctx.obj(['ICCBased', icc]), ctx)?.kind).toBe('cmyk')
    const csRef = ctx.register(ctx.obj(['ICCBased', ctx.register(ctx.stream(new Uint8Array(0), { N: 3 }))]))
    expect(describeColorSpace(csRef, ctx)?.kind).toBe('rgb')
  })
  it('Indexed with a hex-string palette', () => {
    const cs = describeColorSpace(ctx.obj(['Indexed', 'DeviceRGB', 1, PDFHexString.of('FF000000FF00')]), ctx)
    expect(cs?.kind).toBe('indexed')
    if (cs?.kind === 'indexed') {
      expect(cs.hival).toBe(1)
      expect([...cs.palette]).toEqual([255, 0, 0, 0, 255, 0])
    }
  })
  it('unsupported families', () => {
    expect(describeColorSpace(ctx.obj(['Separation', 'Spot', 'DeviceCMYK']), ctx)).toBeNull()
    expect(describeColorSpace(ctx.obj(['Lab', {}]), ctx)).toBeNull()
  })
})

describe('gcUnreachable()', () => {
  it('drops orphan objects but keeps the document intact', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    const before = doc.context.enumerateIndirectObjects().length
    doc.context.register(doc.context.obj({ Junk: 'yes' }))
    doc.context.register(doc.context.obj([1, 2, 3]))
    expect(gcUnreachable(doc.context)).toBe(2)
    expect(doc.context.enumerateIndirectObjects().length).toBe(before)
    const bytes = await doc.save()
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })
})

describe('searchLadder()', () => {
  const sizes = [100, 80, 60, 40, 20]
  const run = (log: number[]) => async (_s: number, i: number) => {
    log.push(i)
    return { bytes: new Uint8Array(sizes[i]) }
  }

  it('finds the gentlest step that fits in ~log2(n) attempts', async () => {
    const log: number[] = []
    const r = await searchLadder(sizes, 50, run(log))
    expect(r.stepIndex).toBe(3)
    expect(r.fits).toBe(true)
    expect(log.length).toBeLessThanOrEqual(3)
    expect(r.attempts).toBe(log.length)
  })

  it('returns the smallest result when nothing fits', async () => {
    const r = await searchLadder(sizes, 10, run([]))
    expect(r.fits).toBe(false)
    expect(r.bytes.length).toBe(20)
  })

  it('picks the first step when everything fits', async () => {
    const r = await searchLadder(sizes, 1000, run([]))
    expect(r.stepIndex).toBe(0)
  })
})

describe('compressPdfImages()', () => {
  const RGB_DICT = { Width: 64, Height: 64, ColorSpace: 'DeviceRGB', BitsPerComponent: 8 }

  it('decodes a Flate RGB image, downscales it and swaps in the JPEG', async () => {
    const pixels = noise(64 * 64 * 3)
    const src = await buildPdf((doc) => {
      addImage(doc, RGB_DICT, pixels)
      doc.context.register(doc.context.obj({ Junk: 'orphan' }))
    })
    const rec = recorder(() => new Uint8Array(100).fill(0xab))
    const { bytes, stats } = await compressPdfImages(src, { quality: 0.5, maxEdge: 32, stripMetadata: true }, rec.encode)

    expect(rec.calls).toHaveLength(1)
    const call = rec.calls[0]
    expect(call.quality).toBe(0.5)
    expect([call.width, call.height]).toEqual([32, 32])
    expect(call.img.kind).toBe('rgba')
    if (call.img.kind === 'rgba') {
      expect([...call.img.data.slice(0, 4)]).toEqual([pixels[0], pixels[1], pixels[2], 255])
      expect(call.img.data.length).toBe(64 * 64 * 4)
    }

    const imgs = await imageStreams(bytes)
    expect(imgs).toHaveLength(1)
    expect(name(imgs[0], 'Filter')).toBe('DCTDecode')
    expect(name(imgs[0], 'ColorSpace')).toBe('DeviceRGB')
    expect(num(imgs[0], 'Width')).toBe(32)
    expect(num(imgs[0], 'Height')).toBe(32)
    expect(num(imgs[0], 'BitsPerComponent')).toBe(8)
    expect(imgs[0].getContentsSize()).toBe(100)

    expect(stats.imagesTotal).toBe(1)
    expect(stats.imagesRecompressed).toBe(1)
    expect(stats.objectsRemoved).toBeGreaterThanOrEqual(1)
    expect(bytes.length).toBeLessThan(src.length)
    expect(new TextDecoder('latin1').decode(bytes)).not.toContain('/Junk')
  })

  it('keeps the original when the re-encoded image is not clearly smaller', async () => {
    const src = await buildPdf((doc) => addImage(doc, RGB_DICT, noise(64 * 64 * 3)))
    const rec = recorder(() => new Uint8Array(20000))
    const { bytes, stats } = await compressPdfImages(src, { quality: 0.5, maxEdge: 4000, stripMetadata: false }, rec.encode)
    expect(rec.calls).toHaveLength(1)
    expect([rec.calls[0].width, rec.calls[0].height]).toEqual([64, 64])
    expect(stats.imagesRecompressed).toBe(0)
    expect(name((await imageStreams(bytes))[0], 'Filter')).toBe('FlateDecode')
  })

  it('undoes PNG predictors declared in DecodeParms', async () => {
    // 48x48 RGB noise, each row prefixed with PNG filter byte 0 (None). Big
    // enough that the Flate stream clears the "tiny" threshold.
    const W = 48
    const pixels = noise(W * W * 3)
    const predicted = new Uint8Array(W * (W * 3 + 1))
    for (let r = 0; r < W; r++) predicted.set(pixels.subarray(r * W * 3, (r + 1) * W * 3), r * (W * 3 + 1) + 1)
    const src = await buildPdf((doc) =>
      addImage(
        doc,
        {
          Width: W,
          Height: W,
          ColorSpace: 'DeviceRGB',
          BitsPerComponent: 8,
          DecodeParms: { Predictor: 15, Colors: 3, BitsPerComponent: 8, Columns: W },
        },
        predicted,
      ),
    )
    const rec = recorder(() => new Uint8Array(10))
    await compressPdfImages(src, { quality: 0.5, maxEdge: 4000, stripMetadata: false }, rec.encode)
    expect(rec.calls).toHaveLength(1)
    const img = rec.calls[0].img
    expect(img.kind).toBe('rgba')
    if (img.kind === 'rgba') {
      expect([...img.data.slice(0, 3)]).toEqual([...pixels.slice(0, 3)])
      const last = W * W - 1
      expect([...img.data.slice(last * 4, last * 4 + 3)]).toEqual([...pixels.slice(last * 3, last * 3 + 3)])
    }
  })

  it('passes JPEGs through untouched and skips CMYK JPEGs', async () => {
    const src = await buildPdf((doc) => {
      addImage(doc, { Width: 16, Height: 16, ColorSpace: 'DeviceRGB', BitsPerComponent: 8, Filter: 'DCTDecode' }, fakeJpeg(3), false)
      addImage(doc, { Width: 16, Height: 16, ColorSpace: 'DeviceCMYK', BitsPerComponent: 8, Filter: 'DCTDecode' }, fakeJpeg(4), false)
      // Declares RGB but the JPEG itself is 4-component: must be skipped too.
      addImage(doc, { Width: 16, Height: 16, ColorSpace: 'DeviceRGB', BitsPerComponent: 8, Filter: 'DCTDecode' }, fakeJpeg(4), false)
    })
    const rec = recorder(() => new Uint8Array(10))
    const { stats } = await compressPdfImages(src, { quality: 0.5, maxEdge: 4000, stripMetadata: false }, rec.encode)
    expect(stats.imagesTotal).toBe(3)
    expect(rec.calls).toHaveLength(1)
    expect(rec.calls[0].img.kind).toBe('jpeg')
    if (rec.calls[0].img.kind === 'jpeg') expect(rec.calls[0].img.bytes[9]).toBe(0xc0)
    expect(stats.imagesRecompressed).toBe(1)
  })

  it('never resizes masked images and leaves the soft mask alone', async () => {
    const src = await buildPdf((doc) => {
      const smask = addImage(doc, { Width: 64, Height: 64, ColorSpace: 'DeviceGray', BitsPerComponent: 8 }, noise(64 * 64))
      addImage(doc, { ...RGB_DICT, SMask: smask }, noise(64 * 64 * 3))
    })
    const rec = recorder(() => new Uint8Array(10))
    const { bytes, stats } = await compressPdfImages(src, { quality: 0.5, maxEdge: 16, stripMetadata: false }, rec.encode)
    expect(rec.calls).toHaveLength(1)
    expect([rec.calls[0].width, rec.calls[0].height]).toEqual([64, 64])
    expect(stats.imagesRecompressed).toBe(1)
    const imgs = await imageStreams(bytes)
    const gray = imgs.find((s) => name(s, 'ColorSpace') === 'DeviceGray')
    expect(gray && name(gray, 'Filter')).toBe('FlateDecode')
    const base = imgs.find((s) => name(s, 'Filter') === 'DCTDecode')
    expect(base?.dict.has(PDFName.of('SMask'))).toBe(true)
  })

  it('skips stencil masks, inverted Decode arrays and unsupported filters', async () => {
    const src = await buildPdf((doc) => {
      addImage(doc, { Width: 256, Height: 256, ImageMask: true }, noise(256 * 32))
      addImage(doc, { ...RGB_DICT, Decode: [1, 0, 1, 0, 1, 0] }, noise(64 * 64 * 3))
      addImage(doc, { ...RGB_DICT, Filter: 'JPXDecode' }, noise(8000), false)
    })
    const rec = recorder(() => new Uint8Array(10))
    const { stats } = await compressPdfImages(src, { quality: 0.5, maxEdge: 4000, stripMetadata: false }, rec.encode)
    expect(stats.imagesTotal).toBe(3)
    expect(rec.calls).toHaveLength(0)
  })

  it('strips XMP metadata when asked', async () => {
    const src = await buildPdf((doc) => {
      const xmp = doc.context.register(doc.context.stream(noise(3000), { Type: 'Metadata', Subtype: 'XML' }))
      doc.catalog.set(PDFName.of('Metadata'), xmp)
    })
    const rec = recorder(() => null)
    const kept = await compressPdfImages(src, { quality: 0.5, maxEdge: 4000, stripMetadata: false }, rec.encode)
    const stripped = await compressPdfImages(src, { quality: 0.5, maxEdge: 4000, stripMetadata: true }, rec.encode)
    expect(kept.bytes.length).toBeGreaterThan(stripped.bytes.length + 2500)
    expect((await PDFDocument.load(stripped.bytes)).catalog.has(PDFName.of('Metadata'))).toBe(false)
  })
})

describe('analyzePdf()', () => {
  it('counts images and recompression candidates', async () => {
    const src = await buildPdf((doc) => {
      addImage(doc, { Width: 64, Height: 64, ColorSpace: 'DeviceRGB', BitsPerComponent: 8 }, noise(64 * 64 * 3))
      addImage(doc, { Width: 64, Height: 64, ColorSpace: 'DeviceRGB', BitsPerComponent: 8, Filter: 'JPXDecode' }, noise(5000), false)
    })
    const a = await analyzePdf(src)
    expect(a.pageCount).toBe(1)
    expect(a.imageCount).toBe(2)
    expect(a.candidateCount).toBe(1)
    expect(a.candidateBytes).toBeGreaterThan(10000)
    expect(a.imageBytes).toBeGreaterThan(a.candidateBytes)
    expect(a.encrypted).toBe(false)
  })
})
