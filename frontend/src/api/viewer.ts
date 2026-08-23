const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')

export function getDocumentViewUrl(documentId: string): string {
  return `${BASE_URL}/api/v1/documents/${documentId}/view`
}

export async function fetchDocumentFile(documentId: string): Promise<Blob> {
  const token = localStorage.getItem('labelproof_token')
  const res = await fetch(getDocumentViewUrl(documentId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!res.ok) {
    let detail = `API ${res.status}: ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.detail) detail = body.detail
    } catch {
      // ignore
    }
    throw new Error(detail)
  }

  return res.blob()
}

export interface DocumentChunkRecord {
  chunk_id: string
  page_no: number
  section: string
  text: string
}

export async function fetchDocumentChunks(documentId: string): Promise<DocumentChunkRecord[]> {
  const token = localStorage.getItem('labelproof_token')
  try {
    const res = await fetch(`${BASE_URL}/api/v1/documents/${documentId}/chunks`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}
