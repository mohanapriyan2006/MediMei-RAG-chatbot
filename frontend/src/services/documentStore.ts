import type { Document } from '../types/document'

const KEY = 'medimei_documents_v1'

export function listDocuments(): Document[] {
  const raw = localStorage.getItem(KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as Document[]
  } catch {
    return []
  }
}

export function saveDocument(doc: Document): void {
  const docs = listDocuments()
  const idx = docs.findIndex((d) => d.id === doc.id)
  if (idx >= 0) {
    docs[idx] = doc
  } else {
    docs.unshift(doc)
  }
  localStorage.setItem(KEY, JSON.stringify(docs))
}

export function deleteDocument(id: string): void {
  const docs = listDocuments().filter((d) => d.id !== id)
  localStorage.setItem(KEY, JSON.stringify(docs))
}

export function getDocument(id: string): Document | undefined {
  return listDocuments().find((d) => d.id === id)
}

export function renameDocument(id: string, name: string): Document | undefined {
  const docs = listDocuments()
  const idx = docs.findIndex((d) => d.id === id)
  if (idx < 0) return undefined
  docs[idx] = { ...docs[idx], name, source: name }
  localStorage.setItem(KEY, JSON.stringify(docs))
  return docs[idx]
}

export function clearDocuments(): void {
  localStorage.removeItem(KEY)
}