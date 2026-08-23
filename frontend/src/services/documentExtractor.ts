import * as mammoth from 'mammoth'
import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.worker.min.mjs'

export interface ExtractedDocument {
  name: string
  filename: string
  fileSize: number
  pageCount: number
  fullText: string
  html?: string
}

function baseName(file: File): string {
  return file.name
    .replace(/\.(pdf|docx|doc|png|jpg|jpeg|webp|bmp|tiff|tif)$/i, '')
    .replace(/[-_]/g, ' ')
    .trim()
}

async function extractDocx(file: File): Promise<ExtractedDocument> {
  const arrayBuffer = await file.arrayBuffer()
  const [raw, converted] = await Promise.all([
    mammoth.extractRawText({ arrayBuffer }),
    mammoth.convertToHtml({ arrayBuffer }),
  ])
  return {
    name: baseName(file),
    filename: file.name,
    fileSize: file.size,
    pageCount: 1,
    fullText: raw.value,
    html: converted.value,
  }
}

async function extractPdf(file: File, onProgress?: (msg: string) => void): Promise<ExtractedDocument> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  let fullText = ''

  for (let i = 1; i <= pdf.numPages; i++) {
    onProgress?.(`Extracting page ${i} of ${pdf.numPages}`)
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map((item) => item.str ?? '').join(' ')
    fullText += pageText + '\n\n'
  }

  return {
    name: baseName(file),
    filename: file.name,
    fileSize: file.size,
    pageCount: pdf.numPages,
    fullText: fullText.trim(),
  }
}

export async function extractDocument(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<ExtractedDocument> {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
    return extractDocx(file)
  }
  if (lower.endsWith('.pdf')) {
    return extractPdf(file, onProgress)
  }
  // Images and unsupported formats are accepted for the UI preview but have no extractable text.
  return {
    name: baseName(file),
    filename: file.name,
    fileSize: file.size,
    pageCount: 1,
    fullText: '',
  }
}