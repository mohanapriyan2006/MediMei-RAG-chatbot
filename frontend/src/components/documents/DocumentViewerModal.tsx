import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, FileText, Maximize2, Minimize2, Download, BookOpen, Layers } from 'lucide-react'
import type { Document } from '../../types/document'
import { fetchDocumentFile, fetchDocumentChunks, getDocumentViewUrl, type DocumentChunkRecord } from '../../api/viewer'
import * as mammoth from 'mammoth'

interface DocumentViewerModalProps {
  document: Document | null
  open: boolean
  onClose: () => void
}

function getFileType(filename?: string): 'pdf' | 'docx' | 'doc' | 'image' | 'unknown' {
  if (!filename) return 'unknown'
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'doc') return 'doc'
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif'].includes(ext || '')) return 'image'
  return 'unknown'
}

export function DocumentViewerModal({ document, open, onClose }: DocumentViewerModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [docChunks, setDocChunks] = useState<DocumentChunkRecord[]>([])
  const [selectedPage, setSelectedPage] = useState<number>(1)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const docName = document?.name || document?.filename || 'Document'
  const fileType = useMemo(
    () => (document ? getFileType(document.filename || document.name) : 'unknown'),
    [document],
  )

  useEffect(() => {
    if (!open || !document) return

    let cancelled = false
    let objectUrl: string | null = null

    setLoading(true)
    setError(null)
    setHtml(null)
    setPdfUrl(null)
    setImageUrl(null)
    setDocChunks([])
    setSelectedPage(1)

    const load = async () => {
      try {
        if (fileType === 'pdf') {
          const blob = await fetchDocumentFile(document.id)
          if (cancelled) return
          objectUrl = URL.createObjectURL(blob)
          setPdfUrl(objectUrl)
        } else if (fileType === 'image') {
          const blob = await fetchDocumentFile(document.id)
          if (cancelled) return
          objectUrl = URL.createObjectURL(blob)
          setImageUrl(objectUrl)
          // Also fetch extracted OCR text chunks for evidence reading below
          const chunks = await fetchDocumentChunks(document.id)
          if (chunks && chunks.length > 0 && !cancelled) {
            setDocChunks(chunks)
          }
        } else {
          // Attempt mammoth conversion first
          let mammothSucceeded = false
          try {
            const blob = await fetchDocumentFile(document.id)
            if (!cancelled) {
              const arrayBuffer = await blob.arrayBuffer()
              const result = await mammoth.convertToHtml({ arrayBuffer })
              if (result.value && result.value.trim().length > 0) {
                setHtml(result.value)
                mammothSucceeded = true
              }
            }
          } catch {
            mammothSucceeded = false
          }

          // If mammoth couldn't convert, fetch structured extracted chunks from DB
          if (!mammothSucceeded && !cancelled) {
            const chunks = await fetchDocumentChunks(document.id)
            if (chunks && chunks.length > 0) {
              setDocChunks(chunks)
            } else {
              setError('Preview is not available for this file. Please download the document.')
            }
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const chunks = await fetchDocumentChunks(document.id)
          if (chunks && chunks.length > 0) {
            setDocChunks(chunks)
          } else {
            setError(err instanceof Error ? err.message : 'Failed to load document')
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [open, document, fileType])

  // Group chunks by page number
  const pagesMap = useMemo(() => {
    const map = new Map<number, DocumentChunkRecord[]>()
    for (const chunk of docChunks) {
      const p = chunk.page_no || 1
      if (!map.has(p)) map.set(p, [])
      map.get(p)!.push(chunk)
    }
    return map
  }, [docChunks])

  const availablePages = useMemo(() => Array.from(pagesMap.keys()).sort((a, b) => a - b), [pagesMap])

  if (!open || !document) return null

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm ${
        isFullscreen ? '' : 'p-4'
      }`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`View ${docName}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex w-full flex-col overflow-hidden border border-border bg-surface shadow-hover transition-all duration-200 ${
          isFullscreen ? 'fixed inset-0 h-screen w-screen rounded-none' : 'h-[88vh] max-w-5xl rounded-3xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-surface/90">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="min-w-0 truncate text-sm font-bold text-fg" title={docName}>
                  {docName}
                </h2>
                <span className="rounded-pill bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary shrink-0">
                  {fileType.toUpperCase()} Document
                </span>
              </div>
              <p className="truncate text-[11px] text-fg-muted mt-0.5">
                {document.pageCount ? `${document.pageCount} pages` : 'Prescribing reference file'}
                {document.uploadedAt ? ` • Uploaded ${new Date(document.uploadedAt).toLocaleDateString()}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <a
              href={getDocumentViewUrl(document.id)}
              download={document.filename || docName}
              target="_blank"
              rel="noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-highlight hover:text-fg"
              aria-label="Download original document"
              title="Download original document"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => setIsFullscreen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-highlight hover:text-fg"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-highlight hover:text-fg"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="relative flex-1 overflow-hidden bg-background p-4 flex flex-col">
          {loading && (
            <div className="flex h-full flex-col items-center justify-center gap-2.5 text-fg-muted">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <span className="text-xs font-semibold text-fg">Loading document…</span>
              <span className="text-[11px] text-fg-muted">Parsing {fileType.toUpperCase()} file contents</span>
            </div>
          )}

          {/* PDF Viewer */}
          {!loading && !error && fileType === 'pdf' && pdfUrl && (
            <iframe
              title={docName}
              src={pdfUrl}
              className="h-full w-full rounded-2xl border border-border bg-white shadow-xs"
            />
          )}

          {/* Image Viewer */}
          {!loading && !error && fileType === 'image' && imageUrl && (
            <div className="flex h-full w-full flex-col items-center justify-center overflow-auto rounded-2xl border border-border bg-black/5 p-4 shadow-xs">
              <img
                src={imageUrl}
                alt={docName}
                className="max-h-full max-w-full rounded-xl object-contain shadow-md"
              />
            </div>
          )}

          {/* Word HTML Viewer */}
          {!loading && !error && html && (
            <div className="h-full w-full overflow-y-auto rounded-2xl border border-border bg-white p-8 text-black shadow-xs">
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="border-b border-gray-200 pb-3 mb-4 flex items-center justify-between text-xs text-gray-500">
                  <span className="font-semibold">{docName}</span>
                  <span>Word Document Preview</span>
                </div>
                <div
                  className="prose prose-sm max-w-none leading-relaxed text-gray-800 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:bg-gray-50 [&_td]:border [&_td]:border-gray-300 [&_td]:p-2"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            </div>
          )}

          {/* Structured Document Pages & Sections View (for DOC / DOCX fallback) */}
          {!loading && !html && !pdfUrl && docChunks.length > 0 && (
            <div className="h-full w-full flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
              {/* Page Navigator Pills */}
              {availablePages.length > 1 && (
                <div className="flex items-center gap-1.5 border-b border-border/80 bg-surface-warm/40 px-4 py-2.5 overflow-x-auto shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-fg-muted mr-1.5 flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    <span>Pages:</span>
                  </span>
                  {availablePages.map((p) => {
                    const isCurrent = selectedPage === p
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSelectedPage(p)}
                        className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold transition-all ${
                          isCurrent
                            ? 'bg-primary text-white shadow-xs'
                            : 'bg-surface text-fg-secondary hover:bg-surface-highlight border border-border/60'
                        }`}
                      >
                        <span>Page {p}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Page Content Body */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-white text-black">
                <div className="max-w-3xl mx-auto space-y-6">
                  {(pagesMap.get(selectedPage) || docChunks).map((chunk, idx) => (
                    <div
                      key={chunk.chunk_id || idx}
                      className="rounded-2xl p-5 border border-gray-200 bg-gray-50/50"
                    >
                      <div className="flex items-center justify-between border-b border-gray-200/80 pb-2 mb-3">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-primary" />
                          <span className="font-bold text-xs text-primary">{chunk.section || 'Document Section'}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-gray-500">Page {chunk.page_no}</span>
                      </div>
                      <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap font-serif">
                        {chunk.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!loading && error && docChunks.length === 0 && !html && !pdfUrl && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-fg-muted p-6">
              <p className="max-w-md text-sm font-semibold text-danger">{error}</p>
              <a
                href={getDocumentViewUrl(document.id)}
                download={document.filename || docName}
                className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover shadow-xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Document</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>,
    window.document.body,
  )
}

export default DocumentViewerModal
