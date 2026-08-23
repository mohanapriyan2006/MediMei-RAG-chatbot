import React, { useState, useMemo } from 'react'
import {
  Bookmark,
  Search,
  X,
  Edit2,
  Check,
  Trash2,
  Calendar,
  AlertTriangle,
  Layers,
  ChevronRight,
} from 'lucide-react'
import { DeleteConfirmModal } from '../common/DeleteConfirmModal'
import type { SavedComparison } from '../../types/comparison'

interface SavedComparisonsPanelProps {
  savedList: SavedComparison[]
  activeComparisonId?: string | null
  onSelectComparison: (saved: SavedComparison) => void
  onUpdateTitle: (id: string, newTitle: string) => void
  onDeleteComparison: (id: string) => void
  onClose?: () => void
}

export function SavedComparisonsPanel({
  savedList,
  activeComparisonId,
  onSelectComparison,
  onUpdateTitle,
  onDeleteComparison,
  onClose,
}: SavedComparisonsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitleValue, setEditTitleValue] = useState('')
  const [pendingDelete, setPendingDelete] = useState<SavedComparison | null>(null)

  // Filter comparisons based on search query
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return savedList
    const q = searchQuery.toLowerCase().trim()
    return savedList.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.drug1Name.toLowerCase().includes(q) ||
        item.drug2Name.toLowerCase().includes(q),
    )
  }, [savedList, searchQuery])

  const handleStartEdit = (e: React.MouseEvent, item: SavedComparison) => {
    e.stopPropagation()
    setEditingId(item.id)
    setEditTitleValue(item.title)
  }

  const handleSaveEdit = (e: React.MouseEvent | React.FormEvent, id: string) => {
    e.stopPropagation()
    if (editTitleValue.trim()) {
      onUpdateTitle(id, editTitleValue.trim())
    }
    setEditingId(null)
  }

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(null)
  }

  const handleDeleteClick = (e: React.MouseEvent, item: SavedComparison) => {
    e.stopPropagation()
    setPendingDelete(item)
  }

  const handleConfirmDelete = () => {
    if (!pendingDelete) return
    onDeleteComparison(pendingDelete.id)
    setPendingDelete(null)
  }

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return 'Recently'
    }
  }

  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-surface text-fg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bookmark className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                Saved Comparisons
              </h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.2 text-[10px] font-bold text-primary">
                {savedList.length}
              </span>
            </div>
            <p className="text-[11px] text-fg-muted">Quick access to past reports</p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close saved comparisons panel"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-fg-muted hover:bg-surface-highlight hover:text-fg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Input Bar */}
      <div className="border-b border-border/80 p-3 bg-surface-warm/30">
        <div className="relative flex items-center">
          {!searchQuery && (<Search className="absolute right-3 h-3.5 w-3.5 text-fg-muted pointer-events-none" />)}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by drug name or title…"
            aria-label="Search saved comparisons"
            className="w-full rounded-xl border border-border bg-surface pl-10 pr-8 py-2 text-xs text-fg placeholder:text-fg-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 flex h-4 w-4 items-center justify-center rounded-full text-fg-muted hover:text-fg"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Saved Comparisons List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {savedList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center px-4 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/5 text-primary">
              <Bookmark className="h-6 w-6 stroke-[1.5]" />
            </div>
            <div>
              <p className="text-xs font-bold text-fg">No Saved Comparisons</p>
              <p className="mt-1 text-[11px] text-fg-muted leading-relaxed max-w-[220px]">
                Run a medication comparison and click &quot;Save Comparison Report&quot; at the bottom of the table to save it here.
              </p>
            </div>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4 space-y-2">
            <Search className="h-6 w-6 text-fg-muted stroke-[1.5]" />
            <p className="text-xs font-semibold text-fg">No matching comparisons</p>
            <p className="text-[11px] text-fg-muted">
              Try searching with another drug name or keyword.
            </p>
          </div>
        ) : (
          filteredList.map((item) => {
            const isActive = activeComparisonId === item.id
            const isEditing = editingId === item.id
            const warningCount =
              item.result.summary?.warningCount ??
              item.result.attributes.filter(
                (a) => a.drug1.status === 'warning' || a.drug2.status === 'warning',
              ).length
            const totalAttrs = item.result.attributes.length

            return (
              <div
                key={item.id}
                onClick={() => onSelectComparison(item)}
                className={`group relative rounded-2xl border p-3.5 transition-all duration-200 cursor-pointer shadow-xs ${isActive
                  ? 'border-primary bg-primary/5 shadow-subtle ring-1 ring-primary/20'
                  : 'border-border bg-surface hover:border-primary/50 hover:bg-surface-highlight/40 hover:shadow-card'
                  }`}
              >
                {/* Top Row: Title or Edit Input */}
                <div className="flex items-start justify-between gap-2">
                  {isEditing ? (
                    <form
                      onSubmit={(e) => handleSaveEdit(e, item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 flex-1"
                    >
                      <input
                        type="text"
                        value={editTitleValue}
                        onChange={(e) => setEditTitleValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        autoFocus
                        className="flex-1 rounded-lg border border-primary bg-surface px-2 py-1 text-xs font-semibold text-fg focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="submit"
                        title="Save title"
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-white hover:bg-primary-hover"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        title="Cancel"
                        className="flex h-6 w-6 items-center justify-center rounded-md text-fg-muted hover:bg-surface-highlight"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <h4 className="text-xs font-bold text-fg group-hover:text-primary transition-colors line-clamp-1">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => handleStartEdit(e, item)}
                          title="Rename comparison"
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-fg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteClick(e, item)}
                          title="Delete comparison"
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-fg-muted hover:bg-danger/10 hover:text-danger transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Drug Comparison Badges */}
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="rounded-md bg-surface-highlight px-2 py-0.5 text-[11px] font-bold text-primary truncate max-w-[110px]">
                    {item.drug1Name}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                    vs
                  </span>
                  <span className="rounded-md bg-surface-highlight px-2 py-0.5 text-[11px] font-bold text-accent truncate max-w-[110px]">
                    {item.drug2Name}
                  </span>
                </div>

                {/* Footer Info: Stats & Date */}
                <div className="mt-2.5 flex items-center justify-between border-t border-border/50 pt-2 text-[10px] text-fg-muted">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Layers className="h-3 w-3 text-primary" />
                      <span>{totalAttrs} sections</span>
                    </span>
                    {warningCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 font-bold text-warning">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        <span>{warningCount}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 font-medium">
                    <Calendar className="h-2.5 w-2.5" />
                    <span>{formatDate(item.savedAt)}</span>
                  </div>
                </div>

                {/* Active Indicator & Load hint */}
                <div className="mt-2 flex items-center justify-end gap-1 text-[10px] font-bold text-primary group-hover:translate-x-0.5 transition-transform">
                  <span>{isActive ? 'Currently viewing' : 'View report'}</span>
                  <ChevronRight className="h-3 w-3" />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={!!pendingDelete}
        title="Delete comparison?"
        subtitle="This action cannot be undone."
        itemTitle={pendingDelete?.title}
        itemSubtitle={
          pendingDelete ? (
            <span className="font-semibold text-primary">
              {pendingDelete.drug1Name} <span className="text-fg-muted font-normal">vs</span> {pendingDelete.drug2Name}
            </span>
          ) : undefined
        }
        description="Are you sure you want to delete this saved comparison report? You can generate a new comparison between these drugs at any time."
        confirmText="Delete Comparison"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </aside>
  )
}

export default SavedComparisonsPanel
