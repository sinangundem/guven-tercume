import { countWords, detectLanguageCode, ocrLanguageCodes } from './languages.ts'

export type FileKind = 'pdf' | 'docx' | 'txt' | 'image'
export type Extraction = { wordCount: number; detectedLanguage: string | null }

const extensionKinds: Record<string, FileKind> = {
  pdf: 'pdf', docx: 'docx', txt: 'txt', jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', bmp: 'image',
}
const maxDocumentBytes = 25 * 1024 * 1024
const maxImageBytes = 12 * 1024 * 1024
const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

export function getFileKind(file: File): FileKind | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return extensionKinds[extension] ?? null
}

export function isOcrSupported(languageCode: string) {
  return languageCode in ocrLanguageCodes
}

async function extractPdfText(file: File) {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  try {
    const document = await loadingTask.promise
    if (document.numPages > 500) throw new Error('PDF 500 sayfadan uzun olamaz.')
    const pages: string[] = []
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
      page.cleanup()
    }
    return pages.join('\n')
  } finally {
    await loadingTask.destroy()
  }
}

async function extractDocxText(file: File) {
  const { default: JSZip } = await import('jszip')
  const archive = await JSZip.loadAsync(await file.arrayBuffer())
  const documentFile = archive.file('word/document.xml')
  if (!documentFile) throw new Error('DOCX belgesinde metin içeriği bulunamadı.')
  const xml = await documentFile.async('string')
  const parsed = new DOMParser().parseFromString(xml, 'application/xml')
  const nodes = parsed.getElementsByTagNameNS(wordNamespace, 't')
  return Array.from(nodes, (node) => node.textContent ?? '').join(' ')
}

async function extractImageText(file: File, languageCode: string, onProgress: (ratio: number) => void) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker(ocrLanguageCodes[languageCode], 1, {
    logger: (message) => {
      if (message.status === 'recognizing text') onProgress(message.progress)
    },
  })
  try {
    const { data } = await worker.recognize(file)
    return data.text
  } finally {
    await worker.terminate()
  }
}

export async function analyzeFile(
  file: File,
  options: { ocrLanguage?: string; onProgress?: (ratio: number) => void } = {},
): Promise<Extraction> {
  const kind = getFileKind(file)
  if (!kind) throw new Error('PDF, DOCX, TXT veya fotoğraf (JPG, PNG, WEBP) yükleyin.')
  if (file.size > (kind === 'image' ? maxImageBytes : maxDocumentBytes)) {
    throw new Error(kind === 'image' ? 'Fotoğraf en fazla 12 MB olabilir.' : 'Dosya en fazla 25 MB olabilir.')
  }

  let text: string
  if (kind === 'pdf') text = await extractPdfText(file)
  else if (kind === 'docx') text = await extractDocxText(file)
  else if (kind === 'txt') text = await file.text()
  else {
    if (!options.ocrLanguage || !isOcrSupported(options.ocrLanguage)) {
      throw new Error('Fotoğraf okuma bu dil için desteklenmiyor. PDF, DOCX veya TXT yükleyin.')
    }
    text = await extractImageText(file, options.ocrLanguage, options.onProgress ?? (() => {}))
  }

  const wordCount = countWords(text)
  if (wordCount < 1) {
    throw new Error(
      kind === 'pdf'
        ? 'PDF içinde okunabilir metin bulunamadı. Taranmış PDF yerine sayfanın fotoğrafını yükleyin.'
        : 'Belgede okunabilir metin bulunamadı.',
    )
  }
  return { wordCount, detectedLanguage: detectLanguageCode(text) }
}
