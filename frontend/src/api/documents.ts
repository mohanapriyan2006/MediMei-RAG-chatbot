import { apiFetch } from './client'

export type BackendDocument = Record<string, unknown>

export const fetchDocuments = (signal?: AbortSignal) =>
  apiFetch<BackendDocument[]>('/api/v1/documents', { signal })
export const uploadDocument = (file: File, signal?: AbortSignal) => {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetch<{ document: BackendDocument; message: string }>('/api/v1/documents/upload', { method: 'POST', body: formData, signal })
}
export const deleteDocument = (id: string) =>
  apiFetch<void>(`/api/v1/documents/${id}`, { method: 'DELETE' })

export const updateDocument = (id: string, source: string) =>
  apiFetch<BackendDocument>(`/api/v1/documents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ source }),
  })

export const getDocumentStatus = (id: string, signal?: AbortSignal) =>
  apiFetch<{ document_id: string; status: string; stage: string; progress: number; progress_detail: string; message: string }>(
    `/api/v1/documents/${id}/status`,
    { signal },
  )

export const viewDocumentUrl = (id: string) => {
  const base = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')
  return `${base}/api/v1/documents/${id}/view`
}
