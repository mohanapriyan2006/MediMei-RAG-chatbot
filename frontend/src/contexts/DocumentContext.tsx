/* eslint-disable react-refresh/only-export-components */
import { createContext, useMemo, useState, useEffect, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { Document } from '../types/document'
import { useAuth } from '../hooks/useAuth'
import { useTask } from '../hooks/useTask'
import {
  fetchDocuments,
  uploadDocument as uploadDocumentApi,
  getDocumentStatus,
  deleteDocument as deleteDocumentApi,
  updateDocument as updateDocumentApi,
} from '../api/documents'

interface DocumentContextValue {
  documents: Document[]
  filteredDocuments: Document[]
  searchQuery: string
  setSearchQuery: (q: string) => void
  uploadDocument: (file: File) => void
  deleteDocument: (id: string) => void
  renameDocument: (id: string, name: string) => void
}

export const DocumentContext = createContext<DocumentContextValue | null>(null)

export function DocumentProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const { user } = useAuth()
  const { startTask } = useTask()

  const mapBackendDoc = (doc: Record<string, unknown>): Document => ({
    id: String(doc.document_id),
    name: String(doc.source || (doc.file_name as string).replace(/\.(pdf|docx|doc|png|jpg|jpeg|webp|bmp|tiff|tif)$/i, '').replace(/[-_]/g, ' ').trim()),
    filename: String(doc.file_name),
    status: doc.status === 'completed' ? 'ready' : doc.status === 'failed' ? 'failed' : 'processing',
    fileSize: Number(doc.file_size || 0),
    pageCount: Number(doc.page_count || 0),
    uploadedAt: String(doc.created_at || new Date().toISOString()),
    stage: (doc.stage as string) || undefined,
    progress: Number(doc.progress || 0),
    progressDetail: (doc.progress_detail as string) || undefined,
  })

  // Load documents on mount / when user changes
  useEffect(() => {
    if (!user) {
      setDocuments([])
      return
    }

    const load = async () => {
      try {
        const res = await fetchDocuments()
        setDocuments(res.map(mapBackendDoc))
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to load documents')
      }
    }

    load()
  }, [user])

  // Poll while documents are processing
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === 'processing')
    if (!hasProcessing || !user) return

    const interval = setInterval(async () => {
      try {
        const res = await fetchDocuments()
        setDocuments(res.map(mapBackendDoc))
      } catch {
        // ignore polling connection errors silently
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [documents, user])

  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents
    const q = searchQuery.toLowerCase()
    return documents.filter(
      (d) =>
        d.name.toLowerCase().includes(q) || d.filename.toLowerCase().includes(q),
    )
  }, [documents, searchQuery])

  const uploadDocument = async (file: File) => {
    const tempId = `temp-${Date.now()}`
    const name = file.name.replace(/\.(pdf|docx|doc|png|jpg|jpeg|webp|bmp|tiff|tif)$/i, '').replace(/[-_]/g, ' ').trim()
    const tempDoc: Document = {
      id: tempId,
      name: name || file.name,
      filename: file.name,
      status: 'processing',
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
    }
    setDocuments((prev) => [tempDoc, ...prev])

    const started = await startTask(
      'document',
      { name: tempDoc.name, tempId },
      async (signal) => {
        const res = await uploadDocumentApi(file, signal)
        const mapped = mapBackendDoc(res.document)
        setDocuments((prev) =>
          prev.map((d) => (d.id === tempId ? mapped : d)),
        )

        const id = mapped.id
        while (true) {
          const status = await getDocumentStatus(id, signal)
          if (status.status === 'completed' || status.status === 'failed') {
            const fresh = await fetchDocuments(signal)
            setDocuments(fresh.map(mapBackendDoc))
            if (status.status === 'completed') {
              toast.success(`Successfully uploaded "${tempDoc.name}"`)
            } else {
              toast.error(`Failed to process "${tempDoc.name}": ${status.progress_detail || 'Unknown error'}`)
            }
            return status
          }
          // Update progress in real-time without full refetch
          setDocuments((prev) =>
            prev.map((d) =>
              d.id === id
                ? {
                    ...d,
                    stage: status.stage || d.stage,
                    progress: status.progress ?? d.progress,
                    progressDetail: status.progress_detail || d.progressDetail,
                  }
                : d,
            ),
          )
          if (signal.aborted) throw new DOMException('Cancelled by user', 'AbortError')
          await new Promise((resolve) => setTimeout(resolve, 3000))
        }
      },
    )

    if (!started) {
      toast.error('Another task is in progress. Please wait or switch to that page.')
      setDocuments((prev) => prev.filter((d) => d.id !== tempId))
    }
  }

  const deleteDocument = async (id: string) => {
    try {
      await deleteDocumentApi(id)
      setDocuments((prev) => prev.filter((d) => d.id !== id))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete document')
    }
  }

  const renameDocument = async (id: string, name: string) => {
    if (!name.trim()) return
    try {
      const updated = await updateDocumentApi(id, name.trim())
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === id
            ? { ...d, name: name.trim(), source: (updated.source as string) || d.source }
            : d,
        ),
      )
      toast.success('Document renamed')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to rename document')
    }
  }

  return (
    <DocumentContext.Provider
      value={{
        documents,
        filteredDocuments,
        searchQuery,
        setSearchQuery,
        uploadDocument,
        deleteDocument,
        renameDocument,
      }}
    >
      {children}
    </DocumentContext.Provider>
  )
}
