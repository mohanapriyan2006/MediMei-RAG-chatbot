/* eslint-disable react-refresh/only-export-components */
import { createContext, useMemo, useState, useEffect, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { Document } from '../types/document'
import { useAuth } from '../hooks/useAuth'
import { useTask } from '../hooks/useTask'
import {
  listDocuments,
  saveDocument,
  deleteDocument as deleteStoredDocument,
  renameDocument as renameStoredDocument,
} from '../services/documentStore'
import { extractDocument } from '../services/documentExtractor'

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

  // Load documents on mount / when user changes
  useEffect(() => {
    if (!user) {
      setDocuments([])
      return
    }
    setDocuments(listDocuments())
  }, [user])

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
    const name = file.name
      .replace(/\.(pdf|docx|doc|png|jpg|jpeg|webp|bmp|tiff|tif)$/i, '')
      .replace(/[-_]/g, ' ')
      .trim()
    const tempDoc: Document = {
      id: tempId,
      name: name || file.name,
      filename: file.name,
      status: 'processing',
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      stage: 'Reading file',
      progress: 10,
      progressDetail: 'Preparing extraction',
    }
    setDocuments((prev) => [tempDoc, ...prev])

    const started = await startTask(
      'document',
      { name: tempDoc.name, tempId },
      async (signal) => {
        if (signal.aborted) throw new DOMException('Cancelled by user', 'AbortError')
        const extracted = await extractDocument(file, (msg) => {
          setDocuments((prev) =>
            prev.map((d) =>
              d.id === tempId
                ? { ...d, stage: msg, progress: Math.min(d.progress ?? 10 + 10, 90) }
                : d,
            ),
          )
        })

        const readyDoc: Document = {
          id: crypto.randomUUID(),
          name: name || file.name,
          filename: file.name,
          status: 'ready',
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          pageCount: extracted.pageCount,
          source: extracted.fullText,
          html: extracted.html,
          progress: 100,
          stage: 'Ready',
          progressDetail: 'Extraction complete',
        }

        saveDocument(readyDoc)
        setDocuments((prev) =>
          prev.map((d) => (d.id === tempId ? readyDoc : d)),
        )
        toast.success(`Successfully uploaded "${readyDoc.name}"`)
        return readyDoc
      },
    )

    if (!started) {
      toast.error('Another task is in progress. Please wait or switch to that page.')
      setDocuments((prev) => prev.filter((d) => d.id !== tempId))
    }
  }

  const deleteDocument = (id: string) => {
    deleteStoredDocument(id)
    setDocuments((prev) => prev.filter((d) => d.id !== id))
    toast.success('Document deleted')
  }

  const renameDocument = (id: string, name: string) => {
    if (!name.trim()) return
    const updated = renameStoredDocument(id, name.trim())
    if (!updated) return
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, name: name.trim() } : d)),
    )
    toast.success('Document renamed')
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