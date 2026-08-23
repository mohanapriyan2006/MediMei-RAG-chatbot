import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, MessageSquare, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../../hooks/useUI'
import { useConversations } from '../../hooks/useConversations'
import { useDocuments } from '../../hooks/useDocuments'

interface SearchResult {
  id: string
  title: string
  subtitle: string
  type: 'chat' | 'document'
}

export function GlobalSearchPanel() {
  const { searchOpen, closeSearch } = useUI()
  const { conversations, selectConversation } = useConversations()
  const { documents } = useDocuments()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (searchOpen) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [searchOpen])

  useEffect(() => {
    if (!searchOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearch()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen, closeSearch])

  const results = useMemo<SearchResult[]>(() => {
    const q = query.toLowerCase().trim()
    const chatResults: SearchResult[] = conversations
      .filter((c) => !q || c.title.toLowerCase().includes(q))
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        title: c.title,
        subtitle: 'Chat',
        type: 'chat' as const,
      }))

    const docResults: SearchResult[] = documents
      .filter(
        (d) =>
          !q ||
          d.name.toLowerCase().includes(q) ||
          d.filename.toLowerCase().includes(q),
      )
      .slice(0, 5)
      .map((d) => ({
        id: d.id,
        title: d.name,
        subtitle: d.filename,
        type: 'document' as const,
      }))

    return [...chatResults, ...docResults]
  }, [query, conversations, documents])

  const empty = query.length > 0 && results.length === 0

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'chat') {
      selectConversation(result.id)
      navigate(`/chat/${result.id}`)
    } else {
      navigate('/documents')
    }
    closeSearch()
  }

  if (!searchOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm pt-[15vh] px-4"
      onClick={closeSearch}
      role="dialog"
      aria-label="Global search"
      aria-modal="true"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="z-50 w-full max-w-md pb-6 overflow-hidden rounded-xl border border-border bg-surface shadow-card animate-fade-in"
      >
        <div className="flex h-10 items-center gap-2 border-b border-border p-6">
          <Search className="h-3.5 w-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats and documents…"
            aria-label="Search chats and documents"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-muted"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="flex h-5 w-5 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-highlight hover:text-fg"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>

        {empty ? (
          <div className="flex flex-col items-center justify-center gap-1 px-4 py-8">
            <span className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-surface-highlight text-fg-muted">
              <Search className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-[13px] font-medium text-fg">No results found</span>
            <span className="text-[12px] text-fg-muted">Adjust your search to try again</span>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto p-1">
            {results.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                type="button"
                onClick={() => handleResultClick(result)}
                className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition-colors hover:bg-surface-highlight"
              >
                {result.type === 'chat' ? (
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-fg">{result.title}</div>
                  <div className="truncate text-[11px] text-fg-muted">{result.subtitle}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
