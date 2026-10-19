// Client-side PDF compression on top of pdf-lib's object model.
//
// Two layers:
//  1. Structural clean-up — drop objects nothing references any more (stale
//     incremental-update garbage, leftover object-stream containers that the
//     parser keeps around), optionally strip XMP / PieceInfo / thumbnails, and
//     re-save with object streams.
//  2. Image recompression — decode each image XObject (JPEG passthrough, or raw
//     Flate/LZW/… samples with PNG/TIFF predictors in the common colour
//     spaces), re-encode it as a smaller JPEG through an injected encoder (a
//     canvas in the browser), and swap the stream in only when it really
//     shrinks. Anything we can't decode *safely* is left untouched.
//
// This file has no DOM dependency so the decoding logic is unit-testable in
// Node; the canvas encoder and the page rasterizer live in pdfCompressBrowser.ts.
import {
  EncryptedPDFError,
  PDFArray,
  PDFBool,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFStream,
  PDFString,
  decodePDFRawStream,
  type PDFContext,
  type PDFObject,
} from '@cantoo/pdf-lib'

// ---------------------------------------------------------------------------
// Presets

export interface ImageSettings {
  /** JPEG quality 0–1 for re-encoded images. */
  quality: number
  /** Longest edge in pixels; bigger images are downscaled to fit. */
  maxEdge: number
}

export interface RasterSettings {
  /** Render resolution when flattening pages to images. */
  dpi: number
  /** JPEG quality 0–1 for the page images. */
  quality: number
}

export type PresetId = 'light' | 'medium' | 'strong'
export const PRESET_IDS: PresetId[] = ['light', 'medium', 'strong']

export const PRESETS: Record<PresetId, { image: ImageSettings; raster: RasterSettings }> = {
  light: { image: { quality: 0.8, maxEdge: 2400 }, raster: { dpi: 200, quality: 0.8 } },
  medium: { image: { quality: 0.65, maxEdge: 1600 }, raster: { dpi: 150, quality: 0.7 } },
  strong: { image: { quality: 0.5, maxEdge: 1100 }, raster: { dpi: 100, quality: 0.6 } },
}

/** Gentlest → strongest; output size is expected to shrink along the ladder. */
export const IMAGE_LADDER: ImageSettings[] = [
  { quality: 0.85, maxEdge: 2800 },
  { quality: 0.8, maxEdge: 2400 },
  { quality: 0.7, maxEdge: 2000 },
  { quality: 0.65, maxEdge: 1600 },
  { quality: 0.55, maxEdge: 1300 },
  { quality: 0.5, maxEdge: 1100 },
  { quality: 0.4, maxEdge: 900 },
  { quality: 0.3, maxEdge: 700 },
]

export const RASTER_LADDER: RasterSettings[] = [
  { dpi: 200, quality: 0.8 },
  { dpi: 150, quality: 0.7 },
  { dpi: 120, quality: 0.65 },
  { dpi: 100, quality: 0.6 },
  { dpi: 80, quality: 0.5 },
  { dpi: 72, quality: 0.4 },
]

/** A re-encoded image must be at least this much smaller to replace the original. */
const MIN_SAVING_RATIO = 0.9
/** Streams below this many bytes are not worth touching (icons, bullets, …). */
const MIN_IMAGE_BYTES = 4096

export { formatBytes } from '@/utils/format'

// ---------------------------------------------------------------------------
// Loading

export class PdfPasswordError extends Error {
  constructor() {
    super('PDF is password protected')
    this.name = 'PdfPasswordError'
  }
}

/** Load a PDF, transparently handling owner-password-only files (empty user
 *  password). Throws PdfPasswordError when a real password is needed/wrong. */
export async function loadPdf(
  bytes: Uint8Array,
  password?: string,
): Promise<{ doc: PDFDocument; encrypted: boolean }> {
  try {
    return { doc: await PDFDocument.load(bytes, { updateMetadata: false }), encrypted: false }
  } catch (e) {
    if (!(e instanceof EncryptedPDFError)) throw e
  }
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false, password: password ?? '' })
    return { doc, encrypted: true }
  } catch {
    throw new PdfPasswordError()
  }
}

// ---------------------------------------------------------------------------
// Sample decoding (pure)

/** Undo the PNG (10–15) and TIFF (2) predictors used with Flate/LZW
 *  DecodeParms. Returns the plain sample rows. */
export function undoPredictor(
  data: Uint8Array,
  predictor: number,
  colors: number,
  bpc: number,
  columns: number,
): Uint8Array {
  if (predictor <= 1) return data
  const bpp = Math.max(1, Math.ceil((colors * bpc) / 8))
  const rowLen = Math.ceil((colors * bpc * columns) / 8)
  if (rowLen <= 0) return data

  if (predictor === 2) {
    // TIFF predictor: horizontal differencing. Only the 8-bit case is common.
    if (bpc !== 8) throw new Error('TIFF predictor requires 8 bits per component')
    const rows = Math.floor(data.length / rowLen)
    const out = data.slice(0, rows * rowLen)
    for (let r = 0; r < rows; r++) {
      const off = r * rowLen
      for (let i = bpp; i < rowLen; i++) out[off + i] = (out[off + i] + out[off + i - bpp]) & 0xff
    }
    return out
  }

  // PNG predictors: every row is prefixed with its filter-type byte.
  const rows = Math.floor(data.length / (rowLen + 1))
  const out = new Uint8Array(rows * rowLen)
  let prev: Uint8Array = new Uint8Array(rowLen)
  for (let r = 0; r < rows; r++) {
    const ft = data[r * (rowLen + 1)]
    const src = data.subarray(r * (rowLen + 1) + 1, (r + 1) * (rowLen + 1))
    const row = out.subarray(r * rowLen, (r + 1) * rowLen)
    for (let i = 0; i < rowLen; i++) {
      const a = i >= bpp ? row[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      const x = src[i]
      let v: number
      switch (ft) {
        case 0:
          v = x
          break
        case 1:
          v = x + a
          break
        case 2:
          v = x + b
          break
        case 3:
          v = x + ((a + b) >> 1)
          break
        case 4: {
          const p = a + b - c
          const pa = Math.abs(p - a)
          const pb = Math.abs(p - b)
          const pc = Math.abs(p - c)
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
          break
        }
        default:
          throw new Error(`Unknown PNG filter type ${ft}`)
      }
      row[i] = v & 0xff
    }
    prev = row
  }
  return out
}

export type BaseColorKind = 'gray' | 'rgb' | 'cmyk'

export type ColorSpaceInfo =
  | { kind: BaseColorKind; ncomp: 1 | 3 | 4 }
  | {
      kind: 'indexed'
      ncomp: 1
      base: { kind: BaseColorKind; ncomp: 1 | 3 | 4 }
      hival: number
      palette: Uint8Array
    }

const GRAY: ColorSpaceInfo = { kind: 'gray', ncomp: 1 }
const RGB: ColorSpaceInfo = { kind: 'rgb', ncomp: 3 }
const CMYK: ColorSpaceInfo = { kind: 'cmyk', ncomp: 4 }

/** Resolve an image's /ColorSpace into something we can convert to RGB.
 *  Returns null for spaces we don't handle (Lab, Separation, DeviceN, Pattern). */
export function describeColorSpace(
  cs: PDFObject | undefined,
  context: PDFContext,
  depth = 0,
): ColorSpaceInfo | null {
  if (!cs || depth > 4) return null
  if (cs instanceof PDFRef) return describeColorSpace(context.lookup(cs), context, depth + 1)

  if (cs instanceof PDFName) {
    switch (cs.decodeText()) {
      case 'DeviceGray':
      case 'G':
      case 'CalGray':
        return GRAY
      case 'DeviceRGB':
      case 'RGB':
      case 'CalRGB':
        return RGB
      case 'DeviceCMYK':
      case 'CMYK':
        return CMYK
      default:
        return null
    }
  }

  if (cs instanceof PDFArray) {
    if (cs.size() === 0) return null
    const family = cs.lookup(0)
    if (!(family instanceof PDFName)) return null
    switch (family.decodeText()) {
      case 'ICCBased': {
        const s = cs.lookup(1)
        if (!(s instanceof PDFStream)) return null
        const n = s.dict.lookup(PDFName.of('N'))
        const nn = n instanceof PDFNumber ? n.asNumber() : NaN
        if (nn === 1) return GRAY
        if (nn === 3) return RGB
        if (nn === 4) return CMYK
        return describeColorSpace(s.dict.get(PDFName.of('Alternate')), context, depth + 1)
      }
      case 'CalRGB':
        return RGB
      case 'CalGray':
        return GRAY
      case 'Indexed':
      case 'I': {
        const base = describeColorSpace(cs.lookup(1), context, depth + 1)
        if (!base || base.kind === 'indexed') return null
        const hv = cs.lookup(2)
        const hival = hv instanceof PDFNumber ? hv.asNumber() : -1
        if (hival < 0 || hival > 255) return null
        const lk = cs.lookup(3)
        let palette: Uint8Array
        if (lk instanceof PDFString || lk instanceof PDFHexString) palette = lk.asBytes()
        else if (lk instanceof PDFRawStream) palette = decodePDFRawStream(lk).decode()
        else return null
        return { kind: 'indexed', ncomp: 1, base, hival, palette }
      }
      default:
        return null
    }
  }
  return null
}

/** True when /Decode is absent or equals the default range for this space.
 *  Non-default Decode arrays (inverted images, etc.) are left alone. */
export function isDefaultDecode(
  decode: PDFObject | undefined,
  cs: ColorSpaceInfo,
  bpc: number,
): boolean {
  if (decode === undefined) return true
  if (!(decode instanceof PDFArray)) return false
  const vals = decode.asArray().map((v) => (v instanceof PDFNumber ? v.asNumber() : NaN))
  const expected =
    cs.kind === 'indexed'
      ? [0, (1 << bpc) - 1]
      : Array.from({ length: cs.ncomp * 2 }, (_, i) => i % 2)
  return vals.length === expected.length && vals.every((v, i) => v === expected[i])
}

/** Expand packed PDF image samples into opaque RGBA pixels. Rows are padded to
 *  byte boundaries as per the spec; short data is treated as zeros. */
export function samplesToRGBA(
  data: Uint8Array,
  width: number,
  height: number,
  bpc: number,
  cs: ColorSpaceInfo,
): Uint8ClampedArray<ArrayBuffer> {
  const ncomp = cs.ncomp
  const rowBytes = Math.ceil((width * ncomp * bpc) / 8)
  const out = new Uint8ClampedArray(width * height * 4)
  const maxVal = (1 << Math.min(bpc, 8)) - 1
  const palette = cs.kind === 'indexed' ? cs.palette : null
  const baseKind: BaseColorKind = cs.kind === 'indexed' ? cs.base.kind : cs.kind
  const baseN = cs.kind === 'indexed' ? cs.base.ncomp : cs.ncomp
  const comps = new Uint8Array(4)
  const at = (i: number) => (i < data.length ? data[i] : 0)

  for (let y = 0; y < height; y++) {
    let bitPos = y * rowBytes * 8
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < ncomp; c++) {
        let raw: number
        if (bpc === 8) {
          raw = at(bitPos >> 3)
          bitPos += 8
        } else if (bpc === 16) {
          raw = at(bitPos >> 3) // keep the high byte
          bitPos += 16
        } else {
          const shift = 8 - bpc - (bitPos & 7)
          raw = (at(bitPos >> 3) >> shift) & maxVal
          bitPos += bpc
        }
        // Indexed samples are palette indices, not intensities: leave them raw.
        comps[c] = palette || maxVal === 255 ? raw : Math.round((raw * 255) / maxVal)
      }

      let src: Uint8Array = comps
      let off = 0
      if (palette && cs.kind === 'indexed') {
        src = palette
        off = Math.min(comps[0], cs.hival) * baseN
      }

      let r: number
      let g: number
      let b: number
      if (baseKind === 'gray') {
        r = g = b = src[off] ?? 0
      } else if (baseKind === 'rgb') {
        r = src[off] ?? 0
        g = src[off + 1] ?? 0
        b = src[off + 2] ?? 0
      } else {
        const k = src[off + 3] ?? 0
        r = ((255 - (src[off] ?? 0)) * (255 - k)) / 255
        g = ((255 - (src[off + 1] ?? 0)) * (255 - k)) / 255
        b = ((255 - (src[off + 2] ?? 0)) * (255 - k)) / 255
      }
      const o = (y * width + x) * 4
      out[o] = r
      out[o + 1] = g
      out[o + 2] = b
      out[o + 3] = 255
    }
  }
  return out
}

/** Number of components declared in a JPEG's SOF marker (1 gray, 3 YCbCr/RGB,
 *  4 CMYK/YCCK), or null if the header can't be parsed. */
export function jpegComponents(bytes: Uint8Array): number | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let i = 2
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++
      continue
    }
    const m = bytes[i + 1]
    if (m === 0xff) {
      i++ // fill byte
      continue
    }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
      i += 2 // standalone marker
      continue
    }
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return bytes[i + 9] // SOFn: Lf(2) P(1) Y(2) X(2) Nf(1)
    }
    if (m === 0xda || m === 0xd9) return null // scan data before any SOF
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3])
  }
  return null
}

// ---------------------------------------------------------------------------
// Image XObject inspection / decoding

const FILTER_ALIASES: Record<string, string> = {
  Fl: 'FlateDecode',
  LZW: 'LZWDecode',
  AHx: 'ASCIIHexDecode',
  A85: 'ASCII85Decode',
  RL: 'RunLengthDecode',
  CCF: 'CCITTFaxDecode',
  DCT: 'DCTDecode',
}
const IMAGE_FILTERS = new Set(['DCTDecode', 'JPXDecode', 'JBIG2Decode', 'CCITTFaxDecode'])

function numOf(dict: PDFDict, key: string): number | undefined {
  const v = dict.lookup(PDFName.of(key))
  return v instanceof PDFNumber ? v.asNumber() : undefined
}

function readFilters(dict: PDFDict): { names: string[]; parms: (PDFDict | undefined)[] } | null {
  const f = dict.lookup(PDFName.of('Filter'))
  const p = dict.lookup(PDFName.of('DecodeParms'))
  const list: PDFObject[] = []
  if (f instanceof PDFName) list.push(f)
  else if (f instanceof PDFArray) {
    for (let i = 0; i < f.size(); i++) {
      const x = f.lookup(i)
      if (x) list.push(x)
    }
  } else if (f !== undefined) return null

  const names: string[] = []
  const parms: (PDFDict | undefined)[] = []
  for (let i = 0; i < list.length; i++) {
    const x = list[i]
    if (!(x instanceof PDFName)) return null
    const n = x.decodeText()
    names.push(FILTER_ALIASES[n] ?? n)
    if (p instanceof PDFArray) {
      const d = i < p.size() ? p.lookup(i) : undefined
      parms.push(d instanceof PDFDict ? d : undefined)
    } else {
      parms.push(i === 0 && p instanceof PDFDict ? p : undefined)
    }
  }
  return { names, parms }
}

/** Why an image XObject was left untouched. */
export type SkipReason = 'mask' | 'stencil' | 'filter' | 'colorspace' | 'decode' | 'tiny' | 'error'

export interface ImageInfo {
  width: number
  height: number
  bpc: number
  cs: ColorSpaceInfo
  filters: string[]
  parms: (PDFDict | undefined)[]
  /** Final filter is DCTDecode: pass the JPEG through to the encoder as-is. */
  isJpeg: boolean
  /** Has an /SMask or stencil /Mask: never resize (mask geometry must stay). */
  hasMask: boolean
}

export type Inspection = { info: ImageInfo; reason?: undefined } | { info: null; reason: SkipReason }

/** Cheap structural check (no decompression) deciding whether we can safely
 *  recompress an image XObject. */
export function inspectImage(stream: PDFRawStream, context: PDFContext): Inspection {
  const d = stream.dict
  const width = numOf(d, 'Width')
  const height = numOf(d, 'Height')
  if (!width || !height || width < 1 || height < 1) return { info: null, reason: 'error' }
  if (stream.getContentsSize() < MIN_IMAGE_BYTES) return { info: null, reason: 'tiny' }
  if (d.lookup(PDFName.of('ImageMask')) === PDFBool.True) return { info: null, reason: 'stencil' }

  const filters = readFilters(d)
  if (!filters) return { info: null, reason: 'filter' }
  const imgIdx = filters.names.findIndex((n) => IMAGE_FILTERS.has(n))
  const isJpeg = imgIdx !== -1 && filters.names[imgIdx] === 'DCTDecode' && imgIdx === filters.names.length - 1
  if (imgIdx !== -1 && !isJpeg) return { info: null, reason: 'filter' }

  const bpc = numOf(d, 'BitsPerComponent') ?? (isJpeg ? 8 : 0)
  if (!isJpeg && ![1, 2, 4, 8, 16].includes(bpc)) return { info: null, reason: 'error' }

  const cs = describeColorSpace(d.get(PDFName.of('ColorSpace')), context)
  if (!cs) return { info: null, reason: 'colorspace' }
  // Browsers decode standalone CMYK JPEGs with Adobe's "inverted" convention,
  // which PDF viewers don't apply — colours would come out negated. Skip them.
  if (isJpeg && cs.kind !== 'gray' && cs.kind !== 'rgb') return { info: null, reason: 'colorspace' }
  if (!isDefaultDecode(d.lookup(PDFName.of('Decode')), cs, bpc)) return { info: null, reason: 'decode' }

  // Colour-key masking (/Mask array) keys on exact sample values; lossy
  // re-encoding would break it.
  const mask = d.lookup(PDFName.of('Mask'))
  if (mask instanceof PDFArray) return { info: null, reason: 'mask' }

  return {
    info: {
      width,
      height,
      bpc,
      cs,
      filters: filters.names,
      parms: filters.parms,
      isJpeg,
      hasMask: d.has(PDFName.of('SMask')) || d.has(PDFName.of('Mask')),
    },
  }
}

export type DecodedImage =
  | { kind: 'jpeg'; bytes: Uint8Array; width: number; height: number }
  | { kind: 'rgba'; data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number }

/** Fully decode an inspected image: JPEG bytes, or RGBA pixels. */
export function decodeImage(stream: PDFRawStream, info: ImageInfo, context: PDFContext): DecodedImage | null {
  const pre = info.isJpeg ? info.filters.slice(0, -1) : info.filters
  let bytes = stream.getContents()
  if (pre.length) {
    const tmp = context.obj({})
    tmp.set(PDFName.of('Filter'), context.obj(pre))
    tmp.set(PDFName.of('DecodeParms'), context.obj(pre.map((_, i) => info.parms[i] ?? null)))
    bytes = decodePDFRawStream(PDFRawStream.of(tmp, bytes)).decode()
  }

  if (info.isJpeg) {
    const n = jpegComponents(bytes)
    if (n !== (info.cs.kind === 'gray' ? 1 : 3)) return null
    return { kind: 'jpeg', bytes, width: info.width, height: info.height }
  }

  const lastParms = info.parms[pre.length - 1]
  if (lastParms) {
    const predictor = numOf(lastParms, 'Predictor') ?? 1
    if (predictor > 1) {
      bytes = undoPredictor(
        bytes,
        predictor,
        numOf(lastParms, 'Colors') ?? 1,
        numOf(lastParms, 'BitsPerComponent') ?? 8,
        numOf(lastParms, 'Columns') ?? 1,
      )
    }
  }
  const data = samplesToRGBA(bytes, info.width, info.height, info.bpc, info.cs)
  return { kind: 'rgba', data, width: info.width, height: info.height }
}

// ---------------------------------------------------------------------------
// Document-level passes

export interface EncodedImage {
  bytes: Uint8Array
  width: number
  height: number
}

/** Encodes a decoded image as JPEG at the given size/quality. Returns null to
 *  leave the original untouched. Browser implementation: canvasJpegEncoder. */
export type ImageEncoder = (
  img: DecodedImage,
  width: number,
  height: number,
  quality: number,
) => Promise<EncodedImage | null>

export interface CompressProgress {
  phase: 'images' | 'pages' | 'saving'
  done: number
  total: number
}
export type ProgressFn = (p: CompressProgress) => void

export interface CompressStats {
  imagesTotal: number
  imagesRecompressed: number
  objectsRemoved: number
}

export interface PassResult {
  bytes: Uint8Array
  stats?: CompressStats
}

export interface ImageCompressOptions extends ImageSettings {
  /** Drop XMP metadata, page thumbnails and app-private PieceInfo. */
  stripMetadata: boolean
  password?: string
  /** Abort between images; the promise rejects with CancelledError. */
  signal?: AbortSignal
}

export class CancelledError extends Error {
  constructor() {
    super('Cancelled')
    this.name = 'CancelledError'
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new CancelledError()
}

interface ImageEntry {
  ref: PDFRef
  stream: PDFRawStream
  inspection: Inspection
}

function collectImages(context: PDFContext): ImageEntry[] {
  const found: [PDFRef, PDFRawStream][] = []
  const maskRefs = new Set<string>()
  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue
    if (obj.dict.lookup(PDFName.of('Subtype')) !== PDFName.of('Image')) continue
    found.push([ref, obj])
    for (const key of ['SMask', 'Mask']) {
      const v = obj.dict.get(PDFName.of(key))
      if (v instanceof PDFRef) maskRefs.add(v.tag)
    }
  }
  // Images that serve as another image's soft mask must stay DeviceGray and
  // pixel-exact, so they are never candidates.
  return found.map(([ref, stream]) => ({
    ref,
    stream,
    inspection: maskRefs.has(ref.tag) ? { info: null, reason: 'mask' } : inspectImage(stream, context),
  }))
}

function replaceImage(context: PDFContext, ref: PDFRef, oldDict: PDFDict, enc: EncodedImage): void {
  const d = oldDict.clone(context)
  for (const k of ['Filter', 'DecodeParms', 'Decode', 'Length', 'ColorSpace', 'BitsPerComponent', 'Width', 'Height', 'ImageMask']) {
    d.delete(PDFName.of(k))
  }
  d.set(PDFName.of('Width'), PDFNumber.of(enc.width))
  d.set(PDFName.of('Height'), PDFNumber.of(enc.height))
  d.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8))
  d.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'))
  d.set(PDFName.of('Filter'), PDFName.of('DCTDecode'))
  context.assign(ref, PDFRawStream.of(d, enc.bytes))
}

/** Remove XMP metadata and app-private data from every object, plus page
 *  thumbnails. None of it affects rendering. */
export function stripMetadata(doc: PDFDocument): void {
  const META = PDFName.of('Metadata')
  const PIECE = PDFName.of('PieceInfo')
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFStream ? obj.dict : obj instanceof PDFDict ? obj : null
    if (!dict) continue
    dict.delete(META)
    dict.delete(PIECE)
  }
  doc.catalog.delete(META)
  doc.catalog.delete(PIECE)
  for (const page of doc.getPages()) page.node.delete(PDFName.of('Thumb'))
}

/** Delete every indirect object not reachable from the trailer. Returns the
 *  number removed. Catches stale incremental-update objects, orphaned
 *  resources, and the object-stream containers the parser keeps around. */
export function gcUnreachable(context: PDFContext): number {
  const seen = new Set<string>()
  const stack: PDFObject[] = []
  const t = context.trailerInfo
  for (const o of [t.Root, t.Info, t.Encrypt, t.ID]) if (o) stack.push(o)

  while (stack.length) {
    const obj = stack.pop()!
    if (obj instanceof PDFRef) {
      if (seen.has(obj.tag)) continue
      seen.add(obj.tag)
      const target = context.lookup(obj)
      if (target) stack.push(target)
    } else if (obj instanceof PDFStream) {
      stack.push(obj.dict)
    } else if (obj instanceof PDFDict) {
      for (const [, v] of obj.entries()) stack.push(v)
    } else if (obj instanceof PDFArray) {
      for (const v of obj.asArray()) stack.push(v)
    }
  }

  let removed = 0
  for (const [ref] of context.enumerateIndirectObjects()) {
    if (!seen.has(ref.tag)) {
      context.delete(ref)
      removed++
    }
  }
  return removed
}

export interface PdfAnalysis {
  pageCount: number
  imageCount: number
  imageBytes: number
  /** Images we can actually recompress (and their total stream bytes). */
  candidateCount: number
  candidateBytes: number
  encrypted: boolean
}

export async function analyzePdf(bytes: Uint8Array, password?: string): Promise<PdfAnalysis> {
  const { doc, encrypted } = await loadPdf(bytes, password)
  const images = collectImages(doc.context)
  let imageBytes = 0
  let candidateCount = 0
  let candidateBytes = 0
  for (const img of images) {
    const size = img.stream.getContentsSize()
    imageBytes += size
    if (img.inspection.info) {
      candidateCount++
      candidateBytes += size
    }
  }
  return {
    pageCount: doc.getPageCount(),
    imageCount: images.length,
    imageBytes,
    candidateCount,
    candidateBytes,
    encrypted,
  }
}

/** Recompress embedded images, clean up the structure, and re-save. */
export async function compressPdfImages(
  src: Uint8Array,
  opts: ImageCompressOptions,
  encode: ImageEncoder,
  onProgress?: ProgressFn,
): Promise<Required<PassResult>> {
  const { doc } = await loadPdf(src, opts.password)
  const context = doc.context
  const images = collectImages(context)
  let recompressed = 0

  for (let i = 0; i < images.length; i++) {
    throwIfAborted(opts.signal)
    onProgress?.({ phase: 'images', done: i, total: images.length })
    const { ref, stream, inspection } = images[i]
    if (!inspection.info) continue
    try {
      const decoded = decodeImage(stream, inspection.info, context)
      if (!decoded) continue
      const longest = Math.max(decoded.width, decoded.height)
      const scale = longest > opts.maxEdge && !inspection.info.hasMask ? opts.maxEdge / longest : 1
      const w = Math.max(1, Math.round(decoded.width * scale))
      const h = Math.max(1, Math.round(decoded.height * scale))
      const enc = await encode(decoded, w, h, opts.quality)
      if (!enc || enc.bytes.length >= stream.getContentsSize() * MIN_SAVING_RATIO) continue
      replaceImage(context, ref, stream.dict, enc)
      recompressed++
    } catch {
      // Undecodable data or encoder failure: keep the original stream.
    }
  }

  throwIfAborted(opts.signal)
  onProgress?.({ phase: 'saving', done: images.length, total: images.length })
  if (opts.stripMetadata) stripMetadata(doc)
  const objectsRemoved = gcUnreachable(context)
  const bytes = await doc.save({ useObjectStreams: true, updateFieldAppearances: false })
  return {
    bytes,
    stats: { imagesTotal: images.length, imagesRecompressed: recompressed, objectsRemoved },
  }
}

// ---------------------------------------------------------------------------
// Target-size search

export interface SearchOutcome<T> extends PassResult {
  step: T
  stepIndex: number
  fits: boolean
  attempts: number
}

/** Binary-search a gentlest→strongest ladder for the gentlest setting whose
 *  output is at most `target` bytes (output size is assumed to shrink along the
 *  ladder). When nothing fits, the smallest result seen is returned. */
export async function searchLadder<T>(
  ladder: T[],
  target: number,
  run: (step: T, index: number) => Promise<PassResult>,
): Promise<SearchOutcome<T>> {
  if (ladder.length === 0) throw new Error('empty ladder')
  let lo = 0
  let hi = ladder.length - 1
  let best: SearchOutcome<T> | null = null
  let fit: SearchOutcome<T> | null = null
  let attempts = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    attempts++
    const r = await run(ladder[mid], mid)
    const outcome: SearchOutcome<T> = {
      ...r,
      step: ladder[mid],
      stepIndex: mid,
      fits: r.bytes.length <= target,
      attempts,
    }
    if (!best || outcome.bytes.length < best.bytes.length) best = outcome
    if (outcome.fits) {
      fit = outcome
      hi = mid - 1
    } else {
      lo = mid + 1
    }
  }
  const chosen = fit ?? best!
  chosen.attempts = attempts
  return chosen
}
