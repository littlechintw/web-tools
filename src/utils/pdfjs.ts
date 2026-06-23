// Centralized pdf.js setup. pdf.js needs its worker configured once; Vite
// resolves the worker file URL via the `?url` suffix. Import getDocument from
// here in any tool that renders PDF pages.
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export { pdfjsLib }
export const getDocument = pdfjsLib.getDocument
