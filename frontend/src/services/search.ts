import type { Document } from '../types/document'

export interface SearchResult {
  documentId: string
  documentName: string
  text: string
  score: number
}

function getTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2)
}

function getSnippet(text: string, terms: string[]): string {
  const lower = text.toLowerCase()
  const windowSize = 1500
  let bestPos = 0
  let bestCount = 0

  for (let i = 0; i < Math.min(lower.length, lower.length - windowSize + 1); i += 500) {
    const win = lower.slice(i, i + windowSize)
    const count = terms.reduce((acc, term) => acc + (win.split(term).length - 1), 0)
    if (count > bestCount) {
      bestCount = count
      bestPos = i
    }
  }

  return text.slice(bestPos, bestPos + windowSize).trim()
}

export function searchDocuments(query: string, documents: Document[], topK = 5): SearchResult[] {
  const terms = getTerms(query)
  if (terms.length === 0) return []

  const results: SearchResult[] = []
  for (const doc of documents) {
    const text = doc.source || ''
    if (!text) continue
    const lower = text.toLowerCase()
    const score = terms.reduce((acc, term) => acc + (lower.split(term).length - 1), 0)
    if (score > 0) {
      results.push({
        documentId: doc.id,
        documentName: doc.name,
        text: getSnippet(text, terms),
        score,
      })
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, topK)
}