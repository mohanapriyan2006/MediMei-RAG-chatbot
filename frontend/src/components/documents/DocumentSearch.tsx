import { Search, X } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'

export function DocumentSearch() {
  const { searchQuery, setSearchQuery } = useDocuments()

  return (
    <div className="relative w-full sm:max-w-[260px]">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
        aria-hidden="true"
      />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search documents…"
        className="clinical-input w-full py-2.5 pl-9 pr-3 text-sm placeholder:text-fg-muted"
        aria-label="Search documents"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => setSearchQuery('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded text-fg-subtle transition-colors hover:text-fg-muted"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}









